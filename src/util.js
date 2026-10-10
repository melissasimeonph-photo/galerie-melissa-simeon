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

// Réglages par défaut selon le type de collection
export function reglagesParDefaut(type, base = {}) {
  const seance = type === 'seance';
  const exp = new Date(Date.now() + (seance ? 90 : 182) * J).toISOString().slice(0, 10);
  return {
    nom: base.nom || (seance ? 'Nouvelle séance' : 'Nouveau mariage'),
    classeur: base.classeur ?? (seance ? 'Couple' : 'Mariages'),
    dateEvt: base.dateEvt || new Date().toISOString().slice(0, 10),
    statut: 'cachee',
    code: base.code || String(1000 + (crypto.getRandomValues(new Uint16Array(1))[0] % 9000)),
    codeInvite: base.codeInvite || ('invites-' + idAleatoire(4)),
    quota: seance ? 15 : 60,
    prixSupp: 10, supp: true,
    hd: true, hdInvite: false, web: true,
    albumActif: seance ? true : base.albumActif !== false,
    expiration: base.expiration || exp,
    rappel: true, relanceAuto: seance || base.albumActif !== false, relanceJours: 14,
    couv: null, couvPos: '50% 50%',
    mur: true, phase: seance ? 'selection' : null,
    prefixe: null, livre: null,
    dossiers: seance ? [{ id: 'seance', nom: 'Séance', desc: '' }] : [{ id: 'ceremonie', nom: 'Cérémonie', desc: '' }],
    grille: 'grande', fichiers: true, tri: 'asc',
    contacts: base.contacts || [],
    rappelsEnvoyes: [],
  };
}
