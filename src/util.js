// Petits outils partagés
export const J = 86400000;

export function json(data, status = 200, headers = {}) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...headers },
  });
}
export function erreur(message, status = 400) { return json({ erreur: message }, status); }

export async function lireJSON(req) {
  try { return await req.json(); } catch { return {}; }
}

export function slugifier(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
    .replace(/&/g, '-et-').replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').replace(/-{2,}/g, '-').slice(0, 60);
}
export function slugNom(s) {
  return String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/\s*&\s*|\s+et\s+/gi, '-').replace(/[^A-Za-z0-9-]+/g, '-').replace(/-{2,}/g, '-').replace(/^-|-$/g, '');
}
export function idAleatoire(n = 10) {
  const a = 'abcdefghijkmnopqrstuvwxyz23456789';
  const b = crypto.getRandomValues(new Uint8Array(n));
  return Array.from(b, (x) => a[x % a.length]).join('');
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export function dateFr(iso) {
  if (!iso) return '';
  const d = new Date(iso + 'T12:00:00Z');
  return d.getUTCDate() + (d.getUTCDate() === 1 ? 'er' : '') + ' ' + MOIS[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
}
export function egalTempsConstant(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

// Galerie d'événement (entreprise, association…) : un seul code d'accès pour tout le monde.
// Les anciennes collections sans indicateur sont reconnues à leur classeur « Événements ».
export function estEvenement(c) {
  if (!c || c.type === 'seance') return false;
  const g = c.reglages || {};
  return g.evenement === undefined ? g.classeur === 'Événements' : !!g.evenement;
}

// Galerie sans code : le lien suffit, les lignes et mentions de code disparaissent des e-mails
export function sansMentionCode(texte) {
  return String(texte || '')
    .replace(/Ce lien et ce code peuvent être partagés librement([^:\n]*?)\s*:[^\n]*/g, 'Ce lien peut être partagé librement$1.')
    .replace(/,? au même endroit et avec le même code/g, ', au même endroit')
    .split('\n').filter((l) => !/^\s*(votre\s+)?code\b[^:]*:/i.test(l)).join('\n')
    .replace(/\n{3,}/g, '\n\n');
}
// Code qui « signe » une session client : sans code, une valeur fixe (réactiver le code déconnecte tout le monde)
export function codeSession(g, role) { return g.sansCode ? '·libre·' : role === 'invite' ? g.codeInvite : g.code; }

// Réglages par défaut selon le type de collection
export function reglagesParDefaut(type, base = {}) {
  const seance = type === 'seance';
  const evt = !seance && !!base.evenement;
  const code = base.code || String(1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000));
  const exp = new Date(Date.now() + (seance ? 90 : 182) * J).toISOString().slice(0, 10);
  return {
    nom: base.nom || (seance ? 'Nouvelle séance' : evt ? 'Nouvel événement' : 'Nouveau mariage'),
    evenement: evt,
    classeur: base.classeur ?? (seance ? 'Couple' : evt ? 'Événements' : 'Mariages'),
    dateEvt: base.dateEvt || new Date().toISOString().slice(0, 10),
    statut: 'cachee',
    code, sansCode: !!base.sansCode,
    codeInvite: evt ? code : base.codeInvite || ('invites-' + idAleatoire(4)),
    quota: Math.max(1, Math.min(500, parseInt(base.quota, 10) || (seance ? 15 : 60))),
    sousType: seance && ['couple', 'maternite', 'famille'].includes(base.sousType) ? base.sousType : null,
    prixSupp: 10, supp: true,
    hd: true, hdInvite: false, web: true,
    albumActif: seance ? true : !evt && base.albumActif !== false,
    expiration: base.expiration || exp,
    rappel: true, relanceAuto: seance || (!evt && base.albumActif !== false), relanceJours: 14,
    couv: null, couvPos: '50% 50%',
    mur: true, phase: seance ? 'selection' : null,
    prefixe: null, livre: null,
    dossiers: seance ? [{ id: 'seance', nom: 'Séance', desc: '' }] : evt ? [{ id: 'photos', nom: 'Photos', desc: '' }] : [{ id: 'ceremonie', nom: 'Cérémonie', desc: '' }],
    grille: 'grande', fichiers: true, tri: 'asc',
    contacts: base.contacts || [],
    rappelsEnvoyes: [],
  };
}
