// Tâche quotidienne : archivage des galeries expirées, rappels d'expiration, relances automatiques
import { J } from './util.js';
import { journaliser, etatDe, enregistrerReglages } from './db.js';
import { envoyerEmail, texteRelance, texteExpiration } from './emails.js';
import { destinatairesClient } from './api-admin.js';

export async function tacheQuotidienne(env) {
  const { results } = await env.DB.prepare("SELECT * FROM collections WHERE json_extract(reglages,'$.statut')='publiee'").all();
  const now = Date.now(), aujourdhui = new Date().toISOString().slice(0, 10);
  for (const r of results) {
    const c = { ...r, reglages: JSON.parse(r.reglages) }, g = c.reglages;
    try {
      // 1. Expirée : la galerie passe en « Archivée » (fichiers conservés)
      if (g.expiration && g.expiration < aujourdhui) {
        g.statut = 'archivee'; await enregistrerReglages(env, c);
        await journaliser(env, c.id, 'Système', 'a archivé la galerie (date d’expiration atteinte)');
        continue;
      }
      const dest = await destinatairesClient(env, c);
      // 2. Rappels 30 et 7 jours avant l'expiration
      if (g.rappel !== false && g.expiration && dest.length) {
        const jours = Math.ceil((new Date(g.expiration + 'T12:00:00Z') - now) / J);
        g.rappelsEnvoyes ||= [];
        for (const seuil of [30, 7]) {
          if (jours <= seuil && jours > (seuil === 30 ? 7 : 0) && !g.rappelsEnvoyes.includes(seuil + ':' + g.expiration)) {
            await envoyerEmail(env, { collectionId: c.id, a: dest, ...texteExpiration(env, c, jours) });
            g.rappelsEnvoyes.push(seuil + ':' + g.expiration); await enregistrerReglages(env, c);
            await journaliser(env, c.id, 'Système', `a envoyé le rappel d’expiration (${jours} jours)`);
          }
        }
      }
      // 3. Relance automatique tant que la sélection n'est pas envoyée
      const etat = await etatDe(env, c.id);
      const enAttente = !etat.verrou && g.albumActif !== false && (c.type === 'seance' ? g.phase !== 'livraison' : true);
      if (g.relanceAuto !== false && enAttente && dest.length) {
        const der = await env.DB.prepare('SELECT MAX(ts) ts FROM relances WHERE collection_id=?').bind(c.id).first();
        const depuis = der?.ts || g.publieLe || c.cree_le;
        if (now - depuis >= (g.relanceJours || 14) * J) {
          await envoyerEmail(env, { collectionId: c.id, a: dest, ...texteRelance(env, c, etat) });
          await env.DB.prepare('INSERT INTO relances (collection_id, ts, auto) VALUES (?,?,1)').bind(c.id, now).run();
          await journaliser(env, c.id, 'Système', 'a envoyé une relance automatique');
        }
      }
    } catch (e) {
      console.error('Tâche quotidienne', c.id, e);
    }
  }
}
