// Miniatures dans les e-mails de notification : liens signés, lisibles sans connexion (la messagerie charge l'image)
import { idAleatoire, egalTempsConstant } from './util.js';
import { cleR2 } from './db.js';

async function cle(env) {
  let r = await env.DB.prepare("SELECT valeur FROM prefs WHERE cle='_cle_vignettes'").first();
  if (!r) {
    await env.DB.prepare("INSERT OR IGNORE INTO prefs (cle, valeur) VALUES ('_cle_vignettes', ?)").bind(idAleatoire(32)).run();
    r = await env.DB.prepare("SELECT valeur FROM prefs WHERE cle='_cle_vignettes'").first();
  }
  return r.valeur;
}
async function signer(env, collId, photoId) {
  const k = await crypto.subtle.importKey('raw', new TextEncoder().encode(await cle(env)), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const s = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(`${collId}/${photoId}`)));
  return [...s.slice(0, 12)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export async function urlVignette(env, collId, photoId) {
  return `https://${env.DOMAINE}/vignette/${collId}/${photoId}/${await signer(env, collId, photoId)}.jpg`;
}
// GET /vignette/<collection>/<photo>/<signature>.jpg
export async function servirVignette(env, chemin) {
  const m = chemin.match(/^\/vignette\/([a-z0-9]+)\/(\d+)\/([a-f0-9]{24})\.jpg$/);
  if (!m) return new Response('Introuvable', { status: 404 });
  const [, collId, photoId, sig] = m;
  if (!egalTempsConstant(sig, await signer(env, collId, photoId))) return new Response('Lien invalide', { status: 403 });
  const p = await env.DB.prepare('SELECT variantes FROM photos WHERE collection_id=? AND id=?').bind(collId, +photoId).first();
  if (!p) return new Response('Introuvable', { status: 404 });
  const v = JSON.parse(p.variantes || '{}');
  const q = v.mini ? 'mini' : v.apercu ? 'apercu' : v.web ? 'web' : null;
  const o = q && (await env.PHOTOS.get(cleR2(collId, +photoId, q)));
  if (!o) return new Response('Introuvable', { status: 404 });
  return new Response(o.body, { headers: { 'content-type': 'image/jpeg', 'cache-control': 'private, max-age=31536000' } });
}
