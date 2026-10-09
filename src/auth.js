// Accès : jetons clients signés (cookie) et vérification Cloudflare Access pour la vue photographe
import { erreur } from './util.js';

const enc = new TextEncoder();
const b64url = (buf) => btoa(String.fromCharCode(...new Uint8Array(buf))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const deb64url = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/') + '==='.slice((s.length + 3) % 4)), (c) => c.charCodeAt(0));

async function cleHmac(secret) {
  return crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify']);
}

// ---- Jetons clients ----
// Contenu : { c: id collection, e: email, r: 'couple' | 'invite', x: expiration (ms), v: version du code }
export async function signerJeton(env, donnees) {
  const corps = b64url(enc.encode(JSON.stringify(donnees)));
  const sig = await crypto.subtle.sign('HMAC', await cleHmac(env.SESSION_SECRET), enc.encode(corps));
  return corps + '.' + b64url(sig);
}
export async function lireJeton(env, jeton) {
  if (!jeton || !jeton.includes('.')) return null;
  const [corps, sig] = jeton.split('.');
  const ok = await crypto.subtle.verify('HMAC', await cleHmac(env.SESSION_SECRET), deb64url(sig), enc.encode(corps));
  if (!ok) return null;
  try {
    const d = JSON.parse(new TextDecoder().decode(deb64url(corps)));
    if (!d.x || d.x < Date.now()) return null;
    return d;
  } catch { return null; }
}
export function lireCookie(req, nom) {
  const c = req.headers.get('cookie') || '';
  const m = c.match(new RegExp('(?:^|;\\s*)' + nom + '=([^;]+)'));
  return m ? decodeURIComponent(m[1]) : null;
}
export const nomCookie = (collectionId) => 'g_' + collectionId;

// Une session client n'est valable que si le code n'a pas changé depuis (v = empreinte du code)
export async function empreinteCode(code) {
  const h = await crypto.subtle.digest('SHA-256', enc.encode('code:' + code));
  return b64url(h).slice(0, 10);
}
export async function sessionClient(env, req, coll) {
  const d = await lireJeton(env, lireCookie(req, nomCookie(coll.id)));
  if (!d || d.c !== coll.id) return null;
  const code = d.r === 'invite' ? coll.reglages.codeInvite : coll.reglages.code;
  if (d.v !== await empreinteCode(code)) return null;
  return d;
}

// ---- Cloudflare Access (vue photographe) ----
let certsCache = { at: 0, cles: null };
async function certsAccess(env) {
  if (certsCache.cles && Date.now() - certsCache.at < 3600e3) return certsCache.cles;
  const r = await fetch(`https://${env.ACCESS_EQUIPE}.cloudflareaccess.com/cdn-cgi/access/certs`);
  const j = await r.json();
  certsCache = { at: Date.now(), cles: j.keys || [] };
  return certsCache.cles;
}
export async function verifierAdmin(env, req) {
  if (env.DEV === '1') return { email: env.ADMIN_EMAIL };
  if (!env.ACCESS_EQUIPE || !env.ACCESS_AUD) return null;
  const jwt = req.headers.get('cf-access-jwt-assertion') || lireCookie(req, 'CF_Authorization');
  if (!jwt) return null;
  const [h, p, s] = jwt.split('.');
  if (!s) return null;
  let entete, charge;
  try { entete = JSON.parse(new TextDecoder().decode(deb64url(h))); charge = JSON.parse(new TextDecoder().decode(deb64url(p))); } catch { return null; }
  const jwk = (await certsAccess(env)).find((k) => k.kid === entete.kid);
  if (!jwk) return null;
  const cle = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', cle, deb64url(s), enc.encode(h + '.' + p));
  if (!ok) return null;
  const aud = Array.isArray(charge.aud) ? charge.aud : [charge.aud];
  if (!aud.includes(env.ACCESS_AUD)) return null;
  if (charge.exp * 1000 < Date.now()) return null;
  if (String(charge.email || '').toLowerCase() !== env.ADMIN_EMAIL.toLowerCase()) return null;
  return { email: charge.email };
}
export async function exigerAdmin(env, req) {
  const a = await verifierAdmin(env, req);
  return a ? null : erreur('Accès réservé à la photographe.', 403);
}

// ---- Limite de tentatives sur la page d'accès (10 essais / 15 min par adresse IP et galerie) ----
export async function tentativeAutorisee(env, cle) {
  const now = Date.now();
  const r = await env.DB.prepare('SELECT nb, depuis FROM tentatives WHERE cle=?').bind(cle).first();
  if (!r || now - r.depuis > 15 * 60e3) {
    await env.DB.prepare('INSERT OR REPLACE INTO tentatives (cle, nb, depuis) VALUES (?, 1, ?)').bind(cle, now).run();
    return true;
  }
  if (r.nb >= 10) return false;
  await env.DB.prepare('UPDATE tentatives SET nb = nb + 1 WHERE cle=?').bind(cle).run();
  return true;
}
