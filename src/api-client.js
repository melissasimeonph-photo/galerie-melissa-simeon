// Côté client : accès à la galerie, favoris, sélection, téléchargements
import { json, erreur, lireJSON, egalTempsConstant, J, slugNom } from './util.js';
import { signerJeton, nomCookie, empreinteCode, sessionClient, tentativeAutorisee, verifierAdmin } from './auth.js';
import { collectionParSlug, journaliser, photosDe, etatDe, enregistrerEtat, cleR2 } from './db.js';
import { envoyerEmail, texteSelectionRecue } from './emails.js';
import { planZip, fluxZip } from './zip.js';

export const estSeanceSel = (c) => c.type === 'seance' && c.reglages.phase !== 'livraison';
const estLivree = (c) => c.type === 'seance' && c.reglages.phase === 'livraison';

export function permissions(c, sess) {
  const g = c.reglages, couple = sess.r === 'couple', sel = estSeanceSel(c);
  return {
    role: sess.r,
    telecharger: !sel,
    hd: !sel && (couple ? g.hd !== false : !!g.hdInvite),
    web: !sel && (couple || g.web !== false),
    favoris: couple && !sel,
    selection: couple && g.albumActif !== false && !estLivree(c),
    partager: !sel,
  };
}
const qui = (s) => (s.r === 'couple' ? s.e : s.e + ' (invité)');

// Liste des photos telle que le client la voit (ordre des catégories, noms renommés à la livraison)
export async function photosClient(env, c, etat) {
  const g = c.reglages, ordreDossier = Object.fromEntries(g.dossiers.map((d, i) => [d.id, i]));
  let ph = (await photosDe(env, c.id)).filter((p) => p.dossier in ordreDossier);
  ph.sort((a, b) => (ordreDossier[a.dossier] - ordreDossier[b.dossier]) || (g.tri === 'desc' ? -1 : 1) * a.nom.localeCompare(b.nom, 'fr', { numeric: true }));
  if (estLivree(c)) {
    ph = ph.filter((p) => etat.album.includes(p.id) && p.variantes.hd);
    const chrono = [...ph].sort((a, b) => a.nom.localeCompare(b.nom, 'fr', { numeric: true })), w = Math.max(2, String(chrono.length).length);
    const pre = g.prefixe || slugNom(g.nom.replace(/^(Séance( (couple|famille|maternité|grossesse))?|Mariage|Famille|Maternité)\s+/i, ''));
    const rang = new Map(chrono.map((p, i) => [p.id, String(i + 1).padStart(w, '0')]));
    ph = ph.map((p) => ({ ...p, nomClient: `${pre}-${rang.get(p.id)}.jpg` }));
  } else ph = ph.map((p) => ({ ...p, nomClient: p.nom }));
  return ph;
}
const varianteAffichage = (c, v) => (estSeanceSel(c) ? 'apercu' : v);

export async function routerClient(env, req, url, ctx) {
  const parts = url.pathname.split('/').filter(Boolean); // ['api','g',slug,action] | ['img',slug,id,var] | ['dl',slug,id] | ['zip',slug]
  const slug = parts[0] === 'api' ? parts[2] : parts[1];
  const c = await collectionParSlug(env, slug);
  if (!c) return erreur('Galerie introuvable.', 404);
  const g = c.reglages;

  // Mur flouté de la page d'accès : visible sans code
  if (parts[0] === 'img' && parts[2] === 'mur') {
    if (g.mur === false) return new Response(null, { status: 404 });
    const o = await env.PHOTOS.get(`c/${c.id}/mur.jpg`);
    return o ? new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=3600' } }) : new Response(null, { status: 404 });
  }

  // Bannière des e-mails (photo de couverture mise en forme) : visible sans code, comme dans l'e-mail
  if (parts[0] === 'img' && (parts[2] === 'email' || parts[2] === 'email-flou')) {
    const o = await env.PHOTOS.get(`c/${c.id}/${parts[2]}.jpg`);
    return o ? new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'public, max-age=86400' } }) : new Response(null, { status: 404 });
  }

  if (parts[0] === 'api' && parts[3] === 'acces' && req.method === 'POST') {
    const { email = '', code = '' } = await lireJSON(req);
    const ip = req.headers.get('cf-connecting-ip') || 'local';
    if (!(await tentativeAutorisee(env, `acces:${ip}:${c.id}`))) return erreur('Trop d’essais. Réessayez dans un quart d’heure.', 429);
    const em = String(email).trim().toLowerCase();
    if (!/^\S+@\S+\.\S+$/.test(em)) return erreur('Indiquez votre adresse e-mail pour accéder à la galerie.');
    const cd = String(code).trim();
    const role = egalTempsConstant(cd, g.code) ? 'couple' : egalTempsConstant(cd, g.codeInvite) ? 'invite' : null;
    if (!role) return erreur('Ce code ne correspond pas. Vérifiez l’e-mail envoyé par Mélissa.', 401);
    if (g.statut === 'cachee') return erreur('Cette galerie n’est pas disponible pour le moment. Contactez Mélissa pour en savoir plus (melissasimeon.ph@gmail.com).', 403);
    if (g.statut === 'archivee') return erreur('Cette galerie a expiré. Contactez Mélissa si vous souhaitez la rouvrir (melissasimeon.ph@gmail.com).', 403);
    if (role === 'invite' && estSeanceSel(c)) return erreur('Les photos ne sont pas encore prêtes. Revenez quand elles seront livrées.', 403);
    const jeton = await signerJeton(env, { c: c.id, e: em, r: role, x: Date.now() + 30 * J, v: await empreinteCode(role === 'couple' ? g.code : g.codeInvite) });
    const now = Date.now();
    await env.DB.prepare(`INSERT INTO visiteurs (collection_id, email, role, premiere, derniere) VALUES (?,?,?,?,?)
      ON CONFLICT(collection_id, email) DO UPDATE SET derniere=excluded.derniere, visites=visites+1, role=excluded.role`).bind(c.id, em, role, now, now).run();
    await journaliser(env, c.id, role === 'couple' ? em : em + ' (invité)', 'a ouvert la galerie');
    return json({ ok: true, role }, 200, { 'set-cookie': `${nomCookie(c.id)}=${jeton}; Path=/; Max-Age=${30 * 86400}; HttpOnly; Secure; SameSite=Lax` });
  }

  // Tout le reste exige une session (ou la photographe, pour l'aperçu)
  let s = await sessionClient(env, req, c);
  if (!s && (await verifierAdmin(env, req)) && url.searchParams.get('apercu') === '1') s = { c: c.id, e: 'apercu', r: 'couple', apercu: true };
  if (!s) return erreur('Session expirée : saisissez à nouveau votre code.', 401);
  if (g.statut !== 'publiee' && !s.apercu) return erreur('Cette galerie n’est plus disponible.', 403);
  const perm = permissions(c, s);
  const etat = await etatDe(env, c.id);

  if (parts[0] === 'img') {
    const p = await env.DB.prepare('SELECT * FROM photos WHERE id=? AND collection_id=?').bind(+parts[2], c.id).first();
    if (!p) return new Response(null, { status: 404 });
    const vars = JSON.parse(p.variantes);
    let v = varianteAffichage(c, parts[3] === 'mini' ? 'mini' : 'web');
    if (!vars[v]) v = vars.apercu && estSeanceSel(c) ? 'apercu' : vars.web ? 'web' : 'mini';
    if (estSeanceSel(c) && v !== 'apercu') return new Response(null, { status: 404 });
    const o = await env.PHOTOS.get(cleR2(c.id, p.id, v));
    if (!o) return new Response(null, { status: 404 });
    return new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=86400', etag: o.httpEtag } });
  }

  if (parts[0] === 'dl') {
    const q = url.searchParams.get('q') === 'hd' ? 'hd' : 'web';
    if (!perm.telecharger || (q === 'hd' && !perm.hd) || (q === 'web' && !perm.web)) return erreur('Téléchargement non autorisé.', 403);
    const liste = await photosClient(env, c, etat);
    const p = liste.find((x) => x.id === +parts[2]);
    if (!p || !p.variantes[q]) return erreur('Photo introuvable.', 404);
    const o = await env.PHOTOS.get(cleR2(c.id, p.id, q));
    if (!o) return erreur('Fichier introuvable.', 404);
    ctx.waitUntil(enregistrerDl(env, c.id, s, p.id, 'photo', q, 1));
    return new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'content-length': String(o.size), 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(p.nomClient)}` } });
  }

  if (parts[0] === 'zip') {
    const q = url.searchParams.get('q') === 'hd' ? 'hd' : 'web', portee = url.searchParams.get('portee') || 'tout';
    if (!perm.telecharger || (q === 'hd' && !perm.hd) || (q === 'web' && !perm.web)) return erreur('Téléchargement non autorisé.', 403);
    let liste = await photosClient(env, c, etat);
    if (portee === 'album') liste = liste.filter((p) => etat.album.includes(p.id));
    else if (portee === 'fav') {
      const { results } = await env.DB.prepare('SELECT DISTINCT photo_id FROM favoris WHERE collection_id=? AND email=?').bind(c.id, s.e).all();
      const ids = new Set(results.map((r) => r.photo_id)); liste = liste.filter((p) => ids.has(p.id));
    } else if (portee !== 'tout') liste = liste.filter((p) => p.dossier === portee);
    liste = liste.filter((p) => p.variantes[q] && p.variantes[q].crc !== undefined);
    if (!liste.length) return erreur('Aucune photo à télécharger.', 404);
    const nomsVus = new Set();
    const fichiers = liste.map((p) => {
      const dossier = estLivree(c) ? '' : (g.dossiers.find((d) => d.id === p.dossier)?.nom || '') + '/';
      let n = dossier + p.nomClient; while (nomsVus.has(n)) n = n.replace(/(\.jpg)?$/, '-bis.jpg'); nomsVus.add(n);
      return { nom: n, taille: p.variantes[q].o, crc: p.variantes[q].crc, cle: cleR2(c.id, p.id, q) };
    });
    const plan = planZip(fichiers);
    const nomZip = slugNom(g.nom) + (portee === 'tout' ? '' : '-' + slugNom(portee === 'fav' ? 'favoris' : portee === 'album' ? 'selection-album' : g.dossiers.find((d) => d.id === portee)?.nom || portee)) + (q === 'web' ? '-web' : '') + '.zip';
    ctx.waitUntil(enregistrerDl(env, c.id, s, null, portee, q, fichiers.length).then(async () => {
      if (s.r === 'couple' && q === 'hd' && portee === 'tout') { g.sauvegarde = Date.now(); await env.DB.prepare('UPDATE collections SET reglages=? WHERE id=?').bind(JSON.stringify(g), c.id).run(); }
    }));
    return new Response(fluxZip(env, plan), { headers: { 'content-type': 'application/zip', 'content-length': String(plan.total), 'content-disposition': `attachment; filename*=UTF-8''${encodeURIComponent(nomZip)}` } });
  }

  // ---- API JSON ----
  const action = parts[3];
  if (action === 'donnees' && req.method === 'GET') {
    const liste = await photosClient(env, c, etat);
    const { results: favs } = await env.DB.prepare('SELECT liste, photo_id FROM favoris WHERE collection_id=? AND email=?').bind(c.id, s.e).all();
    const listes = {};
    for (const f of favs) { (listes[f.liste] ||= []); if (f.photo_id) listes[f.liste].push(f.photo_id); }
    if (!listes['Mes favoris']) listes['Mes favoris'] = [];
    return json({
      perm,
      collection: {
        nom: g.nom, type: c.type, dateEvt: g.dateEvt, slug: c.slug, expiration: g.expiration, phase: g.phase,
        couv: g.couv, couvPos: g.couvPos, quota: g.quota, prixSupp: g.prixSupp, supp: g.supp !== false,
        dossiers: g.dossiers.map(({ id, nom, desc }) => ({ id, nom, desc })), domaine: env.DOMAINE,
      },
      photos: liste.map((p) => ({ id: p.id, nom: p.nomClient, dossier: p.dossier, w: p.w, h: p.h, mo: p.variantes.hd ? Math.round(p.variantes.hd.o / 1e5) / 10 : 0, web: p.variantes.web ? Math.round(p.variantes.web.o / 1e5) / 10 : 0 })),
      etat: perm.selection || estLivree(c) ? etat : { album: [], notes: {}, verrou: false },
      listes,
    });
  }
  if (req.method !== 'POST') return erreur('Méthode non prise en charge.', 405);
  if (s.apercu) return json({ ok: true, apercu: true });
  const b = await lireJSON(req);

  if (action === 'favori') {
    if (!perm.favoris) return erreur('Favoris indisponibles.', 403);
    const liste = String(b.liste || 'Mes favoris').slice(0, 30);
    if (b.on) {
      await env.DB.prepare('INSERT OR IGNORE INTO favoris VALUES (?,?,?,?)').bind(c.id, s.e, liste, +b.photoId).run();
      await journaliser(env, c.id, qui(s), 'a ajouté une photo à ses favoris');
    } else await env.DB.prepare('DELETE FROM favoris WHERE collection_id=? AND email=? AND liste=? AND photo_id=?').bind(c.id, s.e, liste, +b.photoId).run();
    return json({ ok: true });
  }
  if (action === 'liste') {
    if (!perm.favoris) return erreur('Favoris indisponibles.', 403);
    await env.DB.prepare('INSERT OR IGNORE INTO favoris VALUES (?,?,?,0)').bind(c.id, s.e, String(b.nom || '').slice(0, 30)).run();
    return json({ ok: true });
  }
  if (action === 'album' || action === 'note' || action === 'valider') {
    if (!perm.selection) return erreur('Sélection indisponible.', 403);
    if (etat.verrou) return erreur('Votre sélection est envoyée. Écrivez à Mélissa pour la modifier.', 409);
    const now = Date.now();
    if (action === 'album') {
      const id = +b.photoId, i = etat.album.indexOf(id);
      if (b.on && i < 0) {
        if (etat.album.length >= g.quota && (c.type !== 'seance' || g.supp === false)) return erreur(`Vous avez atteint les ${g.quota} photos. Retirez-en une pour en choisir une autre.`, 409);
        const ok = await env.DB.prepare('SELECT 1 FROM photos WHERE id=? AND collection_id=?').bind(id, c.id).first();
        if (!ok) return erreur('Photo introuvable.', 404);
        etat.album.push(id); etat.debut ||= now;
        await journaliser(env, c.id, qui(s), 'a ajouté une photo à la sélection');
      } else if (!b.on && i > -1) {
        etat.album.splice(i, 1);
        await journaliser(env, c.id, qui(s), 'a retiré une photo de la sélection');
      }
      etat.maj = now;
    } else if (action === 'note') {
      const id = +b.photoId, t = String(b.texte || '').trim().slice(0, 400);
      if (t) etat.notes[id] = t; else delete etat.notes[id];
      if (t && !etat.album.includes(id)) { etat.album.push(id); etat.debut ||= now; }
      etat.maj = now;
    } else {
      if (!etat.album.length) return erreur('Sélectionnez au moins une photo.');
      etat.verrou = true; etat.valide = now;
      const k = c.type === 'seance' ? Math.max(0, etat.album.length - g.quota) : 0;
      await journaliser(env, c.id, qui(s), `a envoyé sa sélection (${etat.album.length} photos${k ? ', dont ' + k + ' en supplément' : ''})`);
      const noms = (await photosDe(env, c.id)).filter((p) => etat.album.includes(p.id)).map((p) => p.nom.replace(/\.[^.]+$/, ''));
      ctx.waitUntil(envoyerEmail(env, { collectionId: c.id, a: env.ADMIN_EMAIL, ...texteSelectionRecue(env, c, etat, noms) }));
    }
    await enregistrerEtat(env, c.id, etat);
    return json({ ok: true, etat });
  }
  if (action === 'partage') { await journaliser(env, c.id, qui(s), 'a partagé ' + (b.photo ? 'une photo' : 'la galerie')); return json({ ok: true }); }
  return erreur('Action inconnue.', 404);
}

async function enregistrerDl(env, cid, s, photoId, portee, q, nb) {
  await env.DB.prepare('INSERT INTO telechargements (collection_id, email, role, photo_id, portee, qualite, nb, ts) VALUES (?,?,?,?,?,?,?,?)')
    .bind(cid, s.e, s.r, photoId, portee, q, nb, Date.now()).run();
  const quoi = photoId ? 'une photo' : portee === 'tout' ? 'la galerie complète' : portee === 'fav' ? 'ses favoris' : portee === 'album' ? 'sa sélection' : 'une catégorie';
  await journaliser(env, cid, qui(s), `a téléchargé ${quoi} en ${q === 'hd' ? 'HD' : 'taille web'}`);
}
