// Demandes de devis (mariage) et de réservation (séances) : réception depuis le formulaire, suivi dans la vue photographe
import { json, erreur, lireJSON, idAleatoire, J, egalTempsConstant } from './util.js';
import { envoyerEmail } from './emails.js';

export const STATUTS_DEMANDE = ['nouvelle', 'devis', 'relancee', 'reservee', 'livree', 'perdue'];
// Demandes non abouties effacées après 18 mois (RGPD)
export const CONSERVATION_DEMANDES_JOURS = 548;

const MOIS = { janvier: 1, fevrier: 2, février: 2, mars: 3, avril: 4, mai: 5, juin: 6, juillet: 7, aout: 8, août: 8, septembre: 9, octobre: 10, novembre: 11, decembre: 12, décembre: 12 };
// « 14 mai 2027 », « 14/05/2027 » ou « 2027-05-14 » → « 2027-05-14 »
export function dateISO(txt) {
  const s = String(txt || '').toLowerCase();
  let m = s.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = s.match(/(\d{1,2})\/(\d{1,2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  m = s.match(/(\d{1,2})(?:er)?\s+([a-zéû]+)\s+(\d{4})/);
  if (m && MOIS[m[2]]) return `${m[3]}-${String(MOIS[m[2]]).padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  return null;
}

// Retrouve une réponse dans la liste { label, valeur } envoyée par le formulaire
function champ(champs, re) {
  const c = (champs || []).find((x) => re.test(String(x.label || '')));
  return c ? String(c.valeur || '').trim() : '';
}

async function cleFormulaire(env) {
  let r = await env.DB.prepare("SELECT valeur FROM prefs WHERE cle='_cle_formulaire'").first();
  if (!r) {
    const v = idAleatoire(32);
    await env.DB.prepare("INSERT OR IGNORE INTO prefs (cle, valeur) VALUES ('_cle_formulaire', ?)").bind(v).run();
    r = await env.DB.prepare("SELECT valeur FROM prefs WHERE cle='_cle_formulaire'").first();
  }
  return r.valeur;
}

const ligne = (r) => ({
  id: r.id, recu: r.recu, type: r.type, nom: r.nom, prenom: r.prenom, conjoint: r.conjoint, email: r.email, tel: r.tel,
  dateEvt: r.date_evt, dateTxt: r.date_txt, lieu: r.lieu, source: r.source, budget: r.budget, statut: r.statut,
  devisMontant: r.devis_montant, devisLe: r.devis_le, notes: r.notes, collectionId: r.collection_id, maj: r.maj,
  champs: JSON.parse(r.champs || '[]'), origine: r.origine, relances: JSON.parse(r.relances || '[]'), alerteLe: r.alerte_le,
});

// Champs déduits des réponses du formulaire
function analyser(b) {
  const champs = Array.isArray(b.champs) ? b.champs.filter((c) => c && c.label).map((c) => ({ label: String(c.label).slice(0, 200), valeur: String(c.valeur ?? '').slice(0, 4000) })) : [];
  const type = b.type === 'seance' ? 'seance' : 'mariage';
  const dateTxt = String(b.dateMariage || b.dateSeance || champ(champs, /^date/i) || '').slice(0, 120);
  return {
    type, champs,
    nom: String(b.nom || '').trim().slice(0, 160),
    prenom: String(b.prenom || '').trim().slice(0, 80),
    email: String(b.email || '').trim().toLowerCase().slice(0, 200),
    conjoint: (String(b.conjoint || '') || champ(champs, /conjoint/i)).slice(0, 120),
    tel: (String(b.tel || '') || champ(champs, /t[ée]l[ée]phone|whatsapp/i)).slice(0, 60),
    dateTxt, dateEvt: dateISO(b.dateEvt || dateTxt),
    lieu: champ(champs, /lieu/i).slice(0, 400),
    source: champ(champs, /connue|connu/i).slice(0, 200),
    budget: champ(champs, /budget/i).slice(0, 120),
  };
}

async function inserer(env, d, origine) {
  const id = idAleatoire(12), now = Date.now();
  await env.DB.prepare(`INSERT INTO demandes (id, recu, type, nom, prenom, conjoint, email, tel, date_evt, date_txt, lieu, source, budget, champs, statut, notes, origine, maj)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,'nouvelle','',?,?)`)
    .bind(id, now, d.type, d.nom, d.prenom, d.conjoint, d.email, d.tel, d.dateEvt, d.dateTxt, d.lieu, d.source, d.budget, JSON.stringify(d.champs), origine, now).run();
  return id;
}

// POST /api/demandes : envoyé par le script du formulaire (Google Apps Script), avec la clé partagée
export async function recevoirDemande(env, req) {
  const cle = req.headers.get('x-cle-formulaire') || '';
  if (!egalTempsConstant(cle, await cleFormulaire(env))) return erreur('Clé invalide.', 401);
  const b = await lireJSON(req);
  if (b.piege) return json({ ok: true }); // robot : ignoré sans le dire
  const d = analyser(b);
  if (!d.email && !d.nom) return erreur('Demande vide.');
  // Même personne, même date, il y a moins de 10 minutes : doublon (double clic, nouvel essai)
  const dbl = await env.DB.prepare('SELECT id FROM demandes WHERE email=? AND COALESCE(date_txt,\'\')=? AND recu>?').bind(d.email, d.dateTxt, Date.now() - 10 * 60e3).first();
  if (dbl) return json({ ok: true, id: dbl.id, doublon: true });
  const id = await inserer(env, d, 'formulaire');
  return json({ ok: true, id });
}

// Vue photographe : /admin/api/demandes[/id[/action]]
export async function routerDemandes(env, req, p) {
  const m = req.method;
  if (!p[1]) {
    if (m === 'GET') {
      const { results } = await env.DB.prepare('SELECT * FROM demandes ORDER BY recu DESC').all();
      return json(results.map(ligne));
    }
    if (m === 'POST') {
      // Ajout à la main (demande reçue par Instagram, WhatsApp, téléphone…)
      const b = await lireJSON(req);
      const d = analyser({ ...b, champs: b.message ? [{ label: 'Message', valeur: b.message }] : [] });
      if (!d.nom) return erreur('Indiquez au moins un nom.');
      d.source = String(b.source || '').slice(0, 200);
      const id = await inserer(env, d, 'manuel');
      return json({ ok: true, id });
    }
  }
  const r = await env.DB.prepare('SELECT * FROM demandes WHERE id=?').bind(p[1]).first();
  if (!r) return erreur('Demande introuvable.', 404);
  if (m === 'GET') return json(ligne(r));
  // Relance du client par e-mail (texte relu et modifié dans la vue photographe)
  if (m === 'POST' && p[2] === 'relance') {
    const b = await lireJSON(req);
    if (!r.email) return erreur('Aucune adresse e-mail pour ce client.');
    const objet = String(b.objet || '').trim().slice(0, 200), texte = String(b.texte || '').trim().slice(0, 6000);
    if (!objet || !texte) return erreur('L’objet et le message sont obligatoires.');
    const env2 = await envoyerEmail(env, { a: r.email, objet, texte });
    if (!env2.ok) return erreur('E-mail non envoyé : ' + env2.statut, 502);
    const relances = JSON.parse(r.relances || '[]'); relances.push(Date.now());
    const statut = ['nouvelle', 'devis'].includes(r.statut) ? 'relancee' : r.statut;
    await env.DB.prepare('UPDATE demandes SET relances=?, statut=?, maj=? WHERE id=?').bind(JSON.stringify(relances), statut, Date.now(), r.id).run();
    return json(ligne(await env.DB.prepare('SELECT * FROM demandes WHERE id=?').bind(r.id).first()));
  }
  if (m === 'DELETE') { await env.DB.prepare('DELETE FROM demandes WHERE id=?').bind(r.id).run(); return json({ ok: true }); }
  if (m === 'PATCH') {
    const b = await lireJSON(req), maj = {};
    if (b.statut !== undefined) {
      if (!STATUTS_DEMANDE.includes(b.statut)) return erreur('Étape inconnue.');
      maj.statut = b.statut;
      if (b.statut === 'devis' && !r.devis_le) maj.devis_le = Date.now();
    }
    if (b.notes !== undefined) maj.notes = String(b.notes).slice(0, 8000);
    if (b.devisMontant !== undefined) maj.devis_montant = String(b.devisMontant).slice(0, 40);
    if (b.devisLe !== undefined) maj.devis_le = b.devisLe ? +b.devisLe : null;
    if (b.collectionId !== undefined) maj.collection_id = b.collectionId || null;
    for (const [k, v] of [['nom', 160], ['conjoint', 120], ['email', 200], ['tel', 60], ['lieu', 400], ['source', 200]]) if (b[k] !== undefined) maj[k] = String(b[k]).slice(0, v);
    if (b.dateEvt !== undefined) { maj.date_evt = b.dateEvt || null; if (b.dateEvt) maj.date_txt = new Date(b.dateEvt + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); }
    const cles = Object.keys(maj);
    if (cles.length) {
      await env.DB.prepare(`UPDATE demandes SET ${cles.map((k) => k + '=?').join(', ')}, maj=? WHERE id=?`).bind(...cles.map((k) => maj[k]), Date.now(), r.id).run();
    }
    return json(ligne(await env.DB.prepare('SELECT * FROM demandes WHERE id=?').bind(r.id).first()));
  }
  return erreur('Action inconnue.', 404);
}

// Clé à coller dans le script du formulaire (affichée dans la vue photographe)
export async function cleAffichee(env) { return cleFormulaire(env); }

// Tâche quotidienne : effacement des demandes non abouties après 18 mois
export async function purgerDemandes(env) {
  const limite = Date.now() - CONSERVATION_DEMANDES_JOURS * J;
  await env.DB.prepare("DELETE FROM demandes WHERE recu<? AND collection_id IS NULL AND statut IN ('nouvelle','devis','relancee','perdue')").bind(limite).run();
}

// Délai (en jours) avant de signaler un devis sans réponse ; réglable dans la vue photographe
export async function delaiRelance(env) {
  const r = await env.DB.prepare("SELECT valeur FROM prefs WHERE cle='relanceDevisJours'").first();
  const n = r ? parseInt(JSON.parse(r.valeur), 10) : 7;
  return n > 0 && n < 91 ? n : 7;
}

// Tâche quotidienne : un seul e-mail récapitulatif à Mélissa (nouvelles demandes non traitées, devis sans réponse)
export async function alertesDemandes(env) {
  const now = Date.now(), jours = await delaiRelance(env);
  const { results } = await env.DB.prepare("SELECT * FROM demandes WHERE statut IN ('nouvelle','devis','relancee')").all();
  const nouvelles = [], sansReponse = [];
  for (const d of results) {
    const relances = JSON.parse(d.relances || '[]');
    if (d.statut === 'nouvelle') {
      // Pas encore traitée après 2 jours : signalée une seule fois
      if (now - d.recu >= 2 * J && !d.alerte_le) nouvelles.push(d);
    } else {
      const dernier = Math.max(d.devis_le || 0, relances.length ? relances[relances.length - 1] : 0) || d.maj || d.recu;
      if (now - dernier >= jours * J && (!d.alerte_le || d.alerte_le < dernier)) sansReponse.push({ d, dernier });
    }
  }
  if (!nouvelles.length && !sansReponse.length) return;
  const nom = (d) => (d.conjoint && !String(d.nom || '').includes(d.conjoint) ? `${d.nom} & ${d.conjoint}` : d.nom) || d.email;
  const quand = (d) => d.date_txt ? ` (${d.type === 'seance' ? 'séance' : 'mariage'} le ${d.date_txt})` : '';
  const lignes = [];
  if (sansReponse.length) lignes.push(`Devis sans réponse depuis ${jours} jours ou plus :\n` + sansReponse.map(({ d, dernier }) => `• ${nom(d)}${quand(d)} : dernier contact il y a ${Math.floor((now - dernier) / J)} jours`).join('\n'));
  if (nouvelles.length) lignes.push('Demandes reçues il y a plus de 2 jours, pas encore traitées :\n' + nouvelles.map((d) => `• ${nom(d)}${quand(d)}`).join('\n'));
  const n = nouvelles.length + sansReponse.length;
  await envoyerEmail(env, {
    a: env.ADMIN_EMAIL,
    objet: `${n} demande${n > 1 ? 's' : ''} à relancer`,
    texte: lignes.join('\n\n') + '\n\nDepuis la fiche de chaque demande, le bouton « Relancer par e-mail » prépare le message pour vous.',
    bouton: { texte: 'Ouvrir mes demandes', url: `https://${env.DOMAINE}/admin/#demandes` },
  });
  const ids = [...nouvelles.map((d) => d.id), ...sansReponse.map((x) => x.d.id)];
  for (const id of ids) await env.DB.prepare('UPDATE demandes SET alerte_le=? WHERE id=?').bind(now, id).run();
}
