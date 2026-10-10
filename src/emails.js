// E-mails envoyés par Resend (https://resend.com). Sans clé (en local), ils sont seulement journalisés.
import { esc, dateFr } from './util.js';

export async function envoyerEmail(env, { collectionId = null, a, objet, texte, bouton = null }) {
  const destinataires = (Array.isArray(a) ? a : [a]).filter(Boolean);
  if (!destinataires.length) return { ok: false, raison: 'aucun destinataire' };
  let statut = 'simulé';
  if (env.RESEND_API_KEY) {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + env.RESEND_API_KEY, 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.EXPEDITEUR, to: destinataires, reply_to: env.REPONSE_A, subject: objet,
        text: texte + (bouton ? '\n\n' + bouton.url : ''), html: gabarit(texte, bouton),
      }),
    });
    if (r.ok) statut = 'envoyé';
    else {
      let detail = '';
      try { const j = await r.json(); detail = (j.message || j.name || '').slice(0, 160); } catch {}
      statut = 'échec (' + r.status + (detail ? ' : ' + detail : '') + ')';
    }
  }
  const ts = Date.now();
  for (const d of destinataires) {
    await env.DB.prepare('INSERT INTO emails (collection_id, ts, destinataire, objet, statut) VALUES (?,?,?,?,?)').bind(collectionId, ts, d, objet, statut).run();
  }
  return { ok: !statut.startsWith('échec'), statut };
}

function gabarit(texte, bouton) {
  const paras = esc(texte).split(/\n{2,}/).map((p) => `<p style="margin:0 0 16px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`).join('');
  const btn = bouton ? `<p style="margin:24px 0"><a href="${esc(bouton.url)}" style="display:inline-block;background:#362023;color:#F4EFE9;text-decoration:none;padding:13px 22px;border-radius:999px;font-weight:600">${esc(bouton.texte)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:#F4EFE9;font-family:'Hanken Grotesk',Helvetica,Arial,sans-serif;color:#362023">
<div style="max-width:560px;margin:0 auto;padding:32px 22px"><p style="font-size:13px;letter-spacing:.12em;text-transform:uppercase;color:#4D6E5F;margin:0 0 22px">Mélissa Siméon · Photographe</p>
<div style="background:#FBF8F4;border:1px solid #E2D8CB;border-radius:18px;padding:26px 24px;font-size:15.5px">${paras}${btn}</div>
<p style="font-size:12px;color:#6B5C48;margin:18px 4px">Martinique · melissasimeon.ph@gmail.com</p></div></body></html>`;
}

export function prenomsDe(nom) {
  const n = String(nom || '').replace(/^(Mariage|Séance couple|Séance famille|Séance maternité|Séance)\s+/i, '');
  return /^Famille\s/i.test(n) ? 'à toute la famille ' + n.replace(/^Famille\s+/i, '') : n.replace(/\s*&\s*/, ' et ');
}
export const lienGalerie = (env, coll) => `https://${env.DOMAINE}/${coll.slug}`;

export function texteRelance(env, coll, etat) {
  const g = coll.reglages, n = etat.album.length, q = g.quota, seance = coll.type === 'seance';
  const corps = seance
    ? `Petit rappel : vos photos vous attendent ! Choisissez celles que vous souhaitez recevoir retouchées : votre formule en comprend ${q}${n ? ` et vous en avez déjà sélectionné ${n}` : ''}. Dès que vous aurez envoyé votre sélection, je commence la retouche.`
    : `Petit rappel : la sélection des photos pour votre album vous attend. ${n ? `Vous en avez déjà choisi ${n} sur ${q}, plus que ${Math.max(0, q - n)} !` : `Vous pouvez en choisir ${q}, directement depuis votre galerie.`} Dès que vous l’aurez validée, je commence la mise en page.`;
  return {
    objet: seance ? 'Vos photos attendent votre sélection' : 'Votre sélection pour l’album vous attend',
    texte: `Bonjour ${prenomsDe(g.nom)},\n\n${corps}\n\nVotre galerie : ${lienGalerie(env, coll)}\nCode d’accès : ${g.code}\n\nÀ très vite,\nMélissa`,
  };
}
export function texteLivraison(env, coll, nb) {
  const g = coll.reglages;
  return {
    objet: 'Vos photos sont prêtes',
    texte: `Bonjour ${prenomsDe(g.nom)},\n\nVos ${nb} photos retouchées sont prêtes ! Vous les retrouvez dans votre galerie, au même endroit et avec le même code, en haute définition et sans filigrane.\n\nElles restent disponibles jusqu’au ${dateFr(g.expiration)} : pensez à les télécharger pour les garder précieusement.\n\nCode d’accès : ${g.code}\n\nMerci encore pour votre confiance,\nMélissa`,
    bouton: { texte: 'Voir mes photos', url: lienGalerie(env, coll) },
  };
}
export function texteExpiration(env, coll, jours) {
  const g = coll.reglages;
  return {
    objet: jours <= 7 ? 'Votre galerie ferme dans quelques jours' : 'Votre galerie ferme dans un mois',
    texte: `Bonjour ${prenomsDe(g.nom)},\n\nVotre galerie photo reste en ligne jusqu’au ${dateFr(g.expiration)}. Pensez à télécharger vos photos en haute définition d’ici là pour les garder en sécurité.\n\nCode d’accès : ${g.code}\n\nSi vous avez besoin de plus de temps, répondez simplement à cet e-mail.\n\nMélissa`,
    bouton: { texte: 'Ouvrir ma galerie', url: lienGalerie(env, coll) },
  };
}
export function texteSelectionRecue(env, coll, etat, nomsPhotos) {
  const g = coll.reglages, n = etat.album.length, k = coll.type === 'seance' ? Math.max(0, n - g.quota) : 0;
  const nbNotes = Object.keys(etat.notes || {}).filter((id) => etat.album.includes(+id)).length;
  return {
    objet: (coll.type === 'seance' ? 'Sélection reçue : ' : 'Sélection d’album validée : ') + g.nom,
    texte: `${g.nom} vient d’envoyer sa sélection : ${n} photo${n > 1 ? 's' : ''}${k ? `, dont ${k} en supplément (${k * g.prixSupp} € à facturer)` : ''}${nbNotes ? `, avec ${nbNotes} note${nbNotes > 1 ? 's' : ''}` : ''}.\n\nPour Lightroom (Filtre de bibliothèque › Texte › Nom de fichier › Contient) :\n${nomsPhotos.join(', ')}`,
    bouton: { texte: 'Ouvrir dans ma vue photographe', url: `https://${env.DOMAINE}/admin/#c=${coll.id}` },
  };
}
