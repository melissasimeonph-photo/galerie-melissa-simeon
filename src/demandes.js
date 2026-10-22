// Demandes de devis (mariage) et de réservation (séances) : réception depuis le formulaire, suivi dans la vue photographe
import { json, erreur, lireJSON, idAleatoire, J, egalTempsConstant } from './util.js';

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
  champs: JSON.parse(r.champs || '[]'), origine: r.origine,
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
