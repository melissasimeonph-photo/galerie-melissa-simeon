// Vue photographe : toutes les routes /api/admin/* (protégées par Cloudflare Access + vérification ici)
import { json, erreur, lireJSON, slugifier, idAleatoire, reglagesParDefaut, J } from './util.js';
import { collectionParId, enregistrerReglages, journaliser, photosDe, etatDe, enregistrerEtat, cleR2, supprimerPrefixeR2 } from './db.js';
import { envoyerEmail, texteRelance, texteLivraison, texteGuideAlbum } from './emails.js';

const CHAMPS_MODIFIABLES = ['nom', 'classeur', 'dateEvt', 'statut', 'code', 'codeInvite', 'quota', 'prixSupp', 'supp', 'hd', 'hdInvite', 'web', 'albumActif',
  'expiration', 'rappel', 'relanceAuto', 'relanceJours', 'couv', 'couvPos', 'mur', 'prefixe', 'dossiers', 'grille', 'fichiers', 'tri', 'contacts', 'etoile'];

async function slugLibre(env, base, idActuel = null) {
  let s = slugifier(base) || 'galerie', n = 1, essai = s;
  for (;;) {
    const a = await env.DB.prepare('SELECT id FROM collections WHERE slug=?').bind(essai).first();
    const r = await env.DB.prepare('SELECT collection_id FROM redirections WHERE ancien_slug=?').bind(essai).first();
    if ((!a || a.id === idActuel) && (!r || r.collection_id === idActuel)) return essai;
    essai = `${s}-${++n}`;
  }
}
export async function destinatairesClient(env, c) {
  const { results } = await env.DB.prepare("SELECT email FROM visiteurs WHERE collection_id=? AND role='couple'").bind(c.id).all();
  return [...new Set([...(c.reglages.contacts || []), ...results.map((r) => r.email)].map((e) => String(e).trim().toLowerCase()).filter((e) => e.includes('@')))];
}
const selectionEnAttente = (c, e) => c.reglages.statut === 'publiee' && !e.verrou && c.reglages.albumActif !== false && (c.type === 'seance' ? c.reglages.phase !== 'livraison' : true);

// Séance livrée : on supprime les aperçus filigranés (issus des RAW) devenus inutiles.
// Photos non retenues : fiche et fichiers supprimés. Photos retenues : seul l'aperçu part, la version retouchée reste.
// Une photo retenue dont la retouche n'est pas encore versée garde son aperçu jusqu'à l'envoi du fichier final.
async function nettoyerApercus(env, c, etat) {
  const photos = await photosDe(env, c.id);
  const retirees = photos.filter((p) => !etat.album.includes(p.id));
  const livrees = photos.filter((p) => etat.album.includes(p.id) && p.variantes.hd && p.variantes.apercu);
  const cles = [
    ...retirees.flatMap((p) => Object.keys(p.variantes).map((v) => cleR2(c.id, p.id, v))),
    ...livrees.map((p) => cleR2(c.id, p.id, 'apercu')),
  ];
  for (let i = 0; i < cles.length; i += 1000) await env.PHOTOS.delete(cles.slice(i, i + 1000));
  const stmts = [
    ...retirees.map((p) => env.DB.prepare('DELETE FROM photos WHERE id=? AND collection_id=?').bind(p.id, c.id)),
    ...retirees.map((p) => env.DB.prepare('DELETE FROM favoris WHERE photo_id=? AND collection_id=?').bind(p.id, c.id)),
    ...livrees.map((p) => { const v = { ...p.variantes }; delete v.apercu; return env.DB.prepare('UPDATE photos SET variantes=? WHERE id=?').bind(JSON.stringify(v), p.id); }),
  ];
  for (let i = 0; i < stmts.length; i += 90) await env.DB.batch(stmts.slice(i, i + 90));
  return { retirees: retirees.length, apercus: livrees.length };
}

export async function routerAdmin(env, req, url, ctx) {
  const p = url.pathname.replace(/^\/admin\/api\/?/, '').split('/').filter(Boolean);
  const m = req.method;

  if (p[0] === 'prefs') {
    if (m === 'GET') {
      const { results } = await env.DB.prepare("SELECT cle, valeur FROM prefs WHERE cle NOT LIKE '\\_%' ESCAPE '\\'").all();
      return json(Object.fromEntries(results.map((r) => [r.cle, JSON.parse(r.valeur)])));
    }
    const b = await lireJSON(req);
    for (const [k, v] of Object.entries(b)) if (!k.startsWith('_')) await env.DB.prepare('INSERT OR REPLACE INTO prefs (cle, valeur) VALUES (?,?)').bind(k, JSON.stringify(v)).run();
    return json({ ok: true });
  }

  if (p[0] === 'collections' && !p[1]) {
    if (m === 'GET') {
      const { results: cols } = await env.DB.prepare('SELECT * FROM collections ORDER BY cree_le DESC').all();
      const { results: agg } = await env.DB.prepare("SELECT collection_id, COUNT(*) n, MIN(id) premiere, SUM(COALESCE(json_extract(variantes,'$.hd.o'),0)+COALESCE(json_extract(variantes,'$.web.o'),0)+COALESCE(json_extract(variantes,'$.mini.o'),0)+COALESCE(json_extract(variantes,'$.apercu.o'),0)) o FROM photos GROUP BY collection_id").all();
      const { results: etats } = await env.DB.prepare('SELECT * FROM etats').all();
      const { results: rel } = await env.DB.prepare('SELECT collection_id, MAX(ts) ts FROM relances GROUP BY collection_id').all();
      const A = Object.fromEntries(agg.map((a) => [a.collection_id, a])), E = Object.fromEntries(etats.map((e) => [e.collection_id, e])), R = Object.fromEntries(rel.map((r) => [r.collection_id, r.ts]));
      return json(cols.map((c) => {
        const g = JSON.parse(c.reglages), e = E[c.id];
        const album = e ? JSON.parse(e.album) : [];
        return { id: c.id, slug: c.slug, type: c.type, cree: c.cree_le, reglages: g, photos: A[c.id]?.n || 0, octets: A[c.id]?.o || 0,
          premiere: A[c.id]?.premiere || null, nsel: album.length, verrou: !!e?.verrou, valide: e?.valide || null, derniereRelance: R[c.id] || null };
      }));
    }
    if (m === 'POST') {
      const b = await lireJSON(req);
      const type = b.type === 'seance' ? 'seance' : 'mariage';
      const g = reglagesParDefaut(type, b);
      const id = idAleatoire(12), now = Date.now();
      const slug = await slugLibre(env, b.slug || g.nom.replace(/^(Mariage|Séance couple|Séance|Famille)\s+/i, ''));
      await env.DB.prepare('INSERT INTO collections (id, slug, type, reglages, cree_le, maj_le) VALUES (?,?,?,?,?,?)').bind(id, slug, type, JSON.stringify(g), now, now).run();
      await journaliser(env, id, 'Vous', 'avez créé la collection');
      return json({ id, slug });
    }
  }

  if (p[0] === 'img') {
    // Variante demandée, sinon la plus proche disponible (une séance n'a que des aperçus avant la livraison)
    const ordre = { mini: ['mini', 'apercu', 'web', 'hd'], web: ['web', 'apercu', 'mini', 'hd'], apercu: ['apercu', 'mini', 'web'], hd: ['hd', 'web'] }[p[3]] || ['web', 'mini', 'apercu'];
    for (const v of ordre) {
      const o = await env.PHOTOS.get(cleR2(p[1], p[2], v));
      if (o) return new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=3600' } });
    }
    return new Response(null, { status: 404 });
  }

  if (p[0] === 'photos' && p[1]) {
    const ph = await env.DB.prepare('SELECT * FROM photos WHERE id=?').bind(+p[1]).first();
    if (!ph) return erreur('Photo introuvable.', 404);
    const vars = JSON.parse(ph.variantes);
    if (m === 'PUT' && p[2]) {
      const v = p[2];
      if (!['hd', 'web', 'mini', 'apercu'].includes(v)) return erreur('Variante inconnue.');
      const o = await env.PHOTOS.put(cleR2(ph.collection_id, ph.id, v), req.body, { httpMetadata: { contentType: 'image/jpeg' } });
      const crc = url.searchParams.get('crc');
      vars[v] = { o: o.size, ...(crc !== null ? { crc: +crc } : {}) };
      const w = +url.searchParams.get('w') || ph.w, h = +url.searchParams.get('h') || ph.h;
      const coll = v === 'hd' && vars.apercu ? await collectionParId(env, ph.collection_id) : null;
      if (coll && coll.type === 'seance' && coll.reglages.phase === 'livraison') {
        await env.PHOTOS.delete(cleR2(ph.collection_id, ph.id, 'apercu')); delete vars.apercu;
      }
      await env.DB.prepare('UPDATE photos SET variantes=?, w=?, h=? WHERE id=?').bind(JSON.stringify(vars), w, h, ph.id).run();
      return json({ ok: true, variantes: vars });
    }
    if (m === 'PATCH') {
      const b = await lireJSON(req);
      await env.DB.prepare('UPDATE photos SET dossier=COALESCE(?,dossier), ordre=COALESCE(?,ordre) WHERE id=?').bind(b.dossier ?? null, b.ordre ?? null, ph.id).run();
      return json({ ok: true });
    }
    if (m === 'DELETE') {
      await env.PHOTOS.delete(Object.keys(vars).map((v) => cleR2(ph.collection_id, ph.id, v)));
      await env.DB.prepare('DELETE FROM photos WHERE id=?').bind(ph.id).run();
      const e = await etatDe(env, ph.collection_id);
      if (e.album.includes(ph.id)) { e.album = e.album.filter((x) => x !== ph.id); delete e.notes[ph.id]; await enregistrerEtat(env, ph.collection_id, e); }
      return json({ ok: true });
    }
  }

  if (p[0] !== 'collections' || !p[1]) return erreur('Route inconnue.', 404);
  const c = await collectionParId(env, p[1]);
  if (!c) return erreur('Collection introuvable.', 404);
  const g = c.reglages, action = p[2];

  if (!action) {
    if (m === 'GET') {
      const [photos, etat] = await Promise.all([photosDe(env, c.id), etatDe(env, c.id)]);
      const q = (sql) => env.DB.prepare(sql).bind(c.id).all().then((r) => r.results);
      const [journal, emails, visiteurs, dl, favs, relances] = await Promise.all([
        q('SELECT ts, qui, quoi FROM journal WHERE collection_id=? ORDER BY ts DESC LIMIT 150'),
        q('SELECT ts, destinataire, objet, statut FROM emails WHERE collection_id=? ORDER BY ts DESC LIMIT 100'),
        q('SELECT email, role, premiere, derniere, visites FROM visiteurs WHERE collection_id=? ORDER BY derniere DESC'),
        q('SELECT email, role, photo_id, portee, qualite, nb, ts FROM telechargements WHERE collection_id=? ORDER BY ts DESC LIMIT 2000'),
        q('SELECT email, liste, photo_id FROM favoris WHERE collection_id=? AND photo_id>0'),
        q('SELECT ts, auto FROM relances WHERE collection_id=? ORDER BY ts DESC'),
      ]);
      return json({ id: c.id, slug: c.slug, type: c.type, cree: c.cree_le, reglages: g, photos, etat, journal, emails, visiteurs, telechargements: dl, favoris: favs, relances, domaine: env.DOMAINE });
    }
    if (m === 'PATCH') {
      const b = await lireJSON(req);
      for (const k of CHAMPS_MODIFIABLES) if (k in b) g[k] = b[k];
      if (c.type === 'mariage' && g.albumActif === false) g.relanceAuto = false; // sans album, pas de relance de sélection
      if (g.statut === 'publiee' && !g.publieLe) g.publieLe = Date.now();
      if (!g.code || !g.codeInvite) return erreur('Les deux codes doivent être remplis.');
      if (g.code === g.codeInvite) return erreur('Le code invités doit être différent du code couple.');
      if (b.slug !== undefined) {
        const s = slugifier(b.slug);
        if (!s) return erreur('L’adresse de la collection ne peut pas être vide.');
        if (s !== c.slug) {
          const libre = await slugLibre(env, s, c.id);
          if (libre !== s) return erreur('Cette adresse est déjà prise par une autre collection.', 409);
          await env.DB.prepare('INSERT OR REPLACE INTO redirections (ancien_slug, collection_id) VALUES (?,?)').bind(c.slug, c.id).run();
          await env.DB.prepare('DELETE FROM redirections WHERE ancien_slug=?').bind(s).run();
          c.slug = s;
        }
      }
      await enregistrerReglages(env, c);
      return json({ ok: true, slug: c.slug, reglages: g });
    }
    if (m === 'DELETE') {
      await supprimerPrefixeR2(env, `c/${c.id}/`);
      for (const t of ['photos', 'etats', 'favoris', 'visiteurs', 'journal', 'telechargements', 'emails', 'relances', 'redirections'])
        await env.DB.prepare(`DELETE FROM ${t} WHERE collection_id=?`).bind(c.id).run();
      await env.DB.prepare('DELETE FROM collections WHERE id=?').bind(c.id).run();
      return json({ ok: true });
    }
  }

  if (m === 'POST' && action === 'dupliquer') {
    const g2 = { ...g, nom: g.nom + ' (copie)', statut: 'cachee', couv: null, banniere: null, banniereFlou: null, guideAlbum: null, phase: c.type === 'seance' ? 'selection' : null, livre: null, sauvegarde: null, rappelsEnvoyes: [], contacts: [] };
    const id = idAleatoire(12), now = Date.now(), slug = await slugLibre(env, c.slug + '-copie');
    await env.DB.prepare('INSERT INTO collections (id, slug, type, reglages, cree_le, maj_le) VALUES (?,?,?,?,?,?)').bind(id, slug, c.type, JSON.stringify(g2), now, now).run();
    return json({ id, slug });
  }

  if (m === 'POST' && action === 'photos') {
    // Crée la fiche d'une photo avant l'envoi de ses fichiers.
    // Pour une séance livrée, « final: true » rattache le fichier retouché à la photo choisie (même nom de fichier).
    const b = await lireJSON(req);
    const nom = String(b.nom || '').slice(0, 200);
    if (b.final) {
      const base = (s) => s.replace(/\.[^.]+$/, '').toUpperCase().replace(/[-_ ](MODIFIER|EDIT|EDITED|RETOUCHE|FINAL|HD|\d{1,2})$/, '').replace(/\s*\(\d+\)$/, '');
      const { results } = await env.DB.prepare('SELECT id, nom FROM photos WHERE collection_id=?').bind(c.id).all();
      const t = results.find((r) => base(r.nom) === base(nom));
      return t ? json({ id: t.id, nom: t.nom }) : erreur('Aucune photo de la sélection ne porte ce nom.', 404);
    }
    const dossier = g.dossiers.some((d) => d.id === b.dossier) ? b.dossier : g.dossiers[0]?.id;
    const max = await env.DB.prepare('SELECT COALESCE(MAX(ordre),0) m FROM photos WHERE collection_id=? AND dossier=?').bind(c.id, dossier).first();
    const r = await env.DB.prepare('INSERT INTO photos (collection_id, dossier, nom, w, h, ordre, cree_le) VALUES (?,?,?,?,?,?,?)')
      .bind(c.id, dossier, nom, +b.w || null, +b.h || null, (max?.m || 0) + 1, Date.now()).run();
    return json({ id: r.meta.last_row_id });
  }

  if (m === 'POST' && action === 'ordre') {
    const b = await lireJSON(req);
    const stmts = (b.ids || []).map((id, i) => env.DB.prepare('UPDATE photos SET ordre=?, dossier=COALESCE(?,dossier) WHERE id=? AND collection_id=?').bind(i + 1, b.dossier ?? null, +id, c.id));
    if (stmts.length) await env.DB.batch(stmts);
    return json({ ok: true });
  }

  if (m === 'PUT' && action === 'mur') {
    await env.PHOTOS.put(`c/${c.id}/mur.jpg`, req.body, { httpMetadata: { contentType: 'image/jpeg' } });
    return json({ ok: true });
  }

  if (m === 'PUT' && action === 'banniere') {
    const flou = url.searchParams.get('flou') === '1';
    await env.PHOTOS.put(`c/${c.id}/${flou ? 'email-flou' : 'email'}.jpg`, req.body, { httpMetadata: { contentType: 'image/jpeg' } });
    g[flou ? 'banniereFlou' : 'banniere'] = Date.now(); await enregistrerReglages(env, c);
    return json({ ok: true });
  }

  if (m === 'POST' && action === 'relance') {
    const etat = await etatDe(env, c.id);
    if (!selectionEnAttente(c, etat)) return erreur('Aucune sélection en attente pour cette collection.', 409);
    const b = await lireJSON(req), a = await destinatairesClient(env, c);
    if (!a.length) return erreur('Aucune adresse e-mail client connue : ajoutez-la dans Partager › Par e-mail.', 409);
    const t = texteRelance(env, c, etat);
    const r = await envoyerEmail(env, { collectionId: c.id, a, objet: b.objet || t.objet, texte: b.texte || t.texte });
    await env.DB.prepare('INSERT INTO relances (collection_id, ts, auto) VALUES (?,?,0)').bind(c.id, Date.now()).run();
    await journaliser(env, c.id, 'Vous', `avez envoyé une relance : « ${b.objet || t.objet} »`);
    return json({ ok: true, statut: r.statut, destinataires: a });
  }

  if (m === 'POST' && action === 'email') {
    const b = await lireJSON(req);
    const a = (b.a || []).map((x) => String(x).trim().toLowerCase()).filter((x) => x.includes('@'));
    if (!a.length) return erreur('Ajoutez au moins une adresse e-mail.');
    if (b.memoriser) { g.contacts = [...new Set([...(g.contacts || []), ...a])]; await enregistrerReglages(env, c); }
    const r = await envoyerEmail(env, { collectionId: c.id, a, objet: String(b.objet || '').slice(0, 200), texte: String(b.texte || ''), bouton: b.bouton ? { texte: 'Voir la galerie', url: `https://${env.DOMAINE}/${c.slug}` } : null });
    await journaliser(env, c.id, 'Vous', `avez envoyé : « ${b.objet} »`);
    // Mariage : 30 minutes après la galerie, l'e-mail qui explique la sélection pour le livre (une seule fois par collection)
    let guide = null;
    if (c.type === 'mariage' && g.albumActif !== false && !g.guideAlbum && r.ok) {
      const etat = await etatDe(env, c.id);
      if (!etat.valide) {
        const quand = Date.now() + 30 * 60e3;
        guide = await envoyerEmail(env, { collectionId: c.id, a, ...texteGuideAlbum(env, c), programmeA: quand });
        if (guide.ok) {
          g.guideAlbum = quand; await enregistrerReglages(env, c);
          await journaliser(env, c.id, 'Vous', `e-mail « Ensuite, votre livre photo » ${guide.statut}`);
        }
      }
    }
    return json({ ok: true, statut: r.statut, guide: guide && guide.statut });
  }

  if (m === 'POST' && action === 'livrer') {
    if (c.type !== 'seance') return erreur('Réservé aux séances.');
    const b = await lireJSON(req), etat = await etatDe(env, c.id);
    const photos = (await photosDe(env, c.id)).filter((x) => etat.album.includes(x.id));
    const prets = photos.filter((x) => x.variantes.hd);
    if (!prets.length) return erreur('Aucune photo retouchée n’a encore été téléversée.', 409);
    g.phase = 'livraison'; g.livre = Date.now(); g.prefixe = b.prefixe || g.prefixe || null;
    if (b.prolonger !== false) g.expiration = new Date(Date.now() + 90 * J).toISOString().slice(0, 10);
    etat.verrou = true; await enregistrerEtat(env, c.id, etat);
    await enregistrerReglages(env, c);
    const a = await destinatairesClient(env, c);
    const r = a.length ? await envoyerEmail(env, { collectionId: c.id, a, ...texteLivraison(env, c, prets.length) }) : { statut: 'aucun destinataire' };
    await journaliser(env, c.id, 'Vous', `avez livré ${prets.length} photos retouchées`);
    // Photos retouchées versées et e-mail parti : les aperçus filigranés n'ont plus d'utilité
    const n = await nettoyerApercus(env, c, etat);
    await journaliser(env, c.id, 'Vous', `aperçus filigranés supprimés : ${n.retirees} photo${n.retirees > 1 ? 's' : ''} non retenue${n.retirees > 1 ? 's' : ''} retirée${n.retirees > 1 ? 's' : ''} de la galerie`);
    return json({ ok: true, statut: r.statut, nb: prets.length, manquantes: photos.length - prets.length });
  }

  if (m === 'POST' && action === 'rouvrir') {
    if (c.type === 'seance' && g.phase === 'livraison') return erreur('Les photos sont déjà livrées : la sélection ne peut plus être rouverte.', 409);
    const etat = await etatDe(env, c.id);
    etat.verrou = false; etat.valide = null;
    await enregistrerEtat(env, c.id, etat);
    await journaliser(env, c.id, 'Vous', 'avez rouvert la sélection');
    return json({ ok: true });
  }

  return erreur('Action inconnue.', 404);
}
