// Tâche quotidienne : archivage des galeries expirées, rappels d'expiration, relances automatiques, effacement des données anciennes
import { J } from './util.js';
import { purgerDemandes } from './demandes.js';
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
  await purgerDonnees(env);
  await purgerDemandes(env);
}

// Confidentialité : les données des visiteurs (e-mails, visites, favoris, téléchargements) sont effacées
// 3 mois après l'expiration d'une galerie restée archivée. Les essais de connexion (adresses IP) après 1 jour.
export const CONSERVATION_JOURS = 90;
async function purgerDonnees(env) {
  try {
    const limite = new Date(Date.now() - CONSERVATION_JOURS * J).toISOString().slice(0, 10);
    const { results } = await env.DB.prepare("SELECT id FROM collections WHERE json_extract(reglages,'$.statut')='archivee' AND json_extract(reglages,'$.expiration') < ? AND json_extract(reglages,'$.donneesPurgees') IS NULL").bind(limite).all();
    const ids = JSON.stringify(results.map((r) => r.id));
    const st = (sql) => env.DB.prepare(sql).bind(ids);
    const lots = [env.DB.prepare('DELETE FROM tentatives WHERE depuis < ?').bind(Date.now() - J)];
    if (results.length) lots.push(
      st('DELETE FROM visiteurs WHERE collection_id IN (SELECT value FROM json_each(?1))'),
      st('DELETE FROM favoris WHERE collection_id IN (SELECT value FROM json_each(?1))'),
      st('UPDATE telechargements SET email=NULL WHERE collection_id IN (SELECT value FROM json_each(?1))'),
      st("UPDATE journal SET qui = CASE WHEN qui LIKE '%(invité)%' THEN 'Un invité' ELSE 'Un visiteur' END WHERE qui LIKE '%@%' AND collection_id IN (SELECT value FROM json_each(?1))"),
      st("UPDATE collections SET reglages = json_set(reglages, '$.donneesPurgees', strftime('%Y-%m-%d','now')) WHERE id IN (SELECT value FROM json_each(?1))"),
    );
    await env.DB.batch(lots);
    if (results.length) console.log('Données visiteurs effacées pour', results.length, 'galerie(s)');
  } catch (e) {
    console.error('Purge des données', e);
  }
}
