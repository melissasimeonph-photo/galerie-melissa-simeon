// Galerie Mélissa Siméon — point d'entrée du Worker Cloudflare
import { erreur, esc } from './util.js';
import { exigerAdmin, verifierAdmin } from './auth.js';
import { routerAdmin } from './api-admin.js';
import { routerClient } from './api-client.js';
import { collectionParSlug } from './db.js';
import { tacheQuotidienne } from './cron.js';

const SECURITE = {
  'x-frame-options': 'DENY',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'strict-origin-when-cross-origin',
  'permissions-policy': 'camera=(), microphone=(), geolocation=()',
};
function avecSecurite(r) {
  const h = new Headers(r.headers);
  for (const [k, v] of Object.entries(SECURITE)) if (!h.has(k)) h.set(k, v);
  return new Response(r.body, { status: r.status, statusText: r.statusText, headers: h });
}

async function pageClient(env, req, url, slug) {
  const c = await collectionParSlug(env, slug);
  if (!c) return pageSimple(env, 'Galerie introuvable', 'Vérifiez l’adresse reçue par e-mail, ou contactez Mélissa (melissasimeon.ph@gmail.com).', 404);
  if (c.redirige) return Response.redirect(`${url.origin}/${c.slug}${url.pathname.replace(/^\/[^/]+/, '')}`, 301);
  const g = c.reglages;
  const pub = { nom: g.nom, type: c.type, dateEvt: g.dateEvt, slug: c.slug, mur: g.mur !== false, phase: g.phase || null };
  const r = await env.ASSETS.fetch(new URL('/client.html', url));
  let html = await r.text();
  // Aperçu du lien dans les messageries et réseaux (Open Graph / X)
  const titre = g.nom + ' · Mélissa Siméon';
  const descr = c.type === 'seance' ? 'Votre galerie photo · Mélissa Siméon, photographe en Martinique' : `Les photos du mariage de ${String(g.nom).replace(/^mariage\s+(de\s+)?/i, '')} · Mélissa Siméon, photographe de mariage en Martinique`;
  const lien = `${url.origin}/${c.slug}`;
  const image = g.partage ? `${url.origin}/img/${c.slug}/partage?v=${g.partage.v}` : g.banniere ? `${url.origin}/img/${c.slug}/${c.type === 'seance' && g.phase !== 'livraison' ? 'email-flou' : 'email'}?v=${g.banniere}` : '';
  const meta = [
    ['og:type', 'website'], ['og:site_name', 'Mélissa Siméon · Photographe'], ['og:locale', 'fr_FR'], ['og:title', titre], ['og:description', descr], ['og:url', lien],
    ...(image ? [['og:image', image], ['og:image:secure_url', image], ['og:image:type', 'image/jpeg'], ...(g.partage ? [['og:image:width', '1200'], ['og:image:height', '630']] : []), ['og:image:alt', titre]] : []),
  ].map(([k, v]) => `<meta property="${k}" content="${esc(v)}">`).join('\n') +
    `\n<meta name="description" content="${esc(descr)}">\n<meta name="twitter:card" content="${image ? 'summary_large_image' : 'summary'}">\n<meta name="twitter:title" content="${esc(titre)}">\n<meta name="twitter:description" content="${esc(descr)}">` +
    (image ? `\n<meta name="twitter:image" content="${esc(image)}">` : '') + '\n';
  html = html.replace('</head>', meta + '</head>');
  html = html.replace('/*__COLLECTION__*/null', JSON.stringify(pub).replace(/</g, '\\u003c')).replace(/__TITRE__/g, esc(g.nom + ' · Mélissa Siméon'));
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' } });
}
async function pageSimple(env, titre, texte, status = 200, pied = '') {
  const html = `<!doctype html><html lang="fr"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(titre)}</title>
<link rel="stylesheet" href="/assets/simple.css"><main><img src="/assets/logo.svg" alt="" width="72"><h1>${esc(titre)}</h1><p>${esc(texte)}</p></main>${pied}</html>`;
  return new Response(html, { status, headers: { 'content-type': 'text/html; charset=utf-8' } });
}

export default {
  async fetch(req, env, ctx) {
    const url = new URL(req.url);
    const chemin = url.pathname;
    try {
      if (chemin.startsWith('/admin/api/')) {
        const refus = await exigerAdmin(env, req);
        return avecSecurite(refus || (await routerAdmin(env, req, url, ctx)));
      }
      if (chemin === '/admin' || chemin.startsWith('/admin/')) {
        if (!(await verifierAdmin(env, req))) return avecSecurite(await pageSimple(env, 'Accès réservé', 'Cette partie est réservée à la photographe.', 403));
        if (chemin === '/admin') return Response.redirect(url.origin + '/admin/', 302);
        return avecSecurite(await env.ASSETS.fetch(new URL('/admin/index.html', url)));
      }
      if (/^\/(api\/g|img|dl|zip)\//.test(chemin)) return avecSecurite(await routerClient(env, req, url, ctx));
      if (chemin === '/' ) return avecSecurite(await pageSimple(env, 'Galeries de Mélissa Siméon', 'Ouvrez le lien de votre galerie reçu par e-mail pour retrouver vos photos.', 200, '<a class="pied" href="/admin/">Espace photographe</a>'));
      if (chemin.startsWith('/assets/')) return env.ASSETS.fetch(req);
      const m = chemin.match(/^\/([a-z0-9-]+)(?:\/photo\/\d+)?\/?$/);
      if (m) return avecSecurite(await pageClient(env, req, url, m[1]));
      return avecSecurite(await pageSimple(env, 'Page introuvable', 'Cette adresse n’existe pas.', 404));
    } catch (e) {
      console.error(e);
      return erreur('Une erreur est survenue. Réessayez dans un instant.', 500);
    }
  },
  async scheduled(evt, env, ctx) {
    ctx.waitUntil(tacheQuotidienne(env));
  },
};
