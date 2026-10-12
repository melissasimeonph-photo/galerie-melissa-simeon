// E-mails envoyés par Resend (https://resend.com). Sans clé (en local), ils sont seulement journalisés.
import { esc, dateFr } from './util.js';
import { collectionParId } from './db.js';

export async function envoyerEmail(env, { collectionId = null, a, objet, texte, bouton = null, etapes = null, programmeA = null }) {
  const destinataires = (Array.isArray(a) ? a : [a]).filter(Boolean);
  if (!destinataires.length) return { ok: false, raison: 'aucun destinataire' };
  const coll = collectionId ? await collectionParId(env, collectionId).catch(() => null) : null;
  const pourMoi = destinataires.every((d) => d.toLowerCase() === String(env.ADMIN_EMAIL).toLowerCase());
  // Un e-mail destiné au client a toujours son bouton vers la galerie
  if (!bouton && coll && !pourMoi) bouton = { texte: coll.type === 'seance' ? 'Voir mes photos' : 'Ouvrir ma galerie', url: lienGalerie(env, coll) };
  let statut = 'simulé';
  if (env.RESEND_API_KEY) {
    // Le design avec photo est réservé aux e-mails des clients ; tes notifications restent sobres
    const pieces = [];
    const html = pourMoi ? gabaritSobre(objet, texte, bouton) : gabarit(env, { objet, texte, bouton, coll, etapes }, pieces);
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { authorization: 'Bearer ' + String(env.RESEND_API_KEY).replace(/\s+/g, ''), 'content-type': 'application/json' },
      body: JSON.stringify({
        from: env.EXPEDITEUR, to: destinataires, reply_to: env.REPONSE_A, subject: objet,
        text: texteBrut(texte, etapes) + (bouton ? '\n\n' + bouton.url : ''), html, ...(pieces.length ? { attachments: pieces } : {}),
        ...(programmeA ? { scheduled_at: new Date(programmeA).toISOString() } : {}),
      }),
    });
    if (r.ok) statut = programmeA ? 'programmé pour ' + new Date(programmeA).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'America/Martinique' }) : 'envoyé';
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

/* ---------- Mise en page, sur le modèle des e-mails du questionnaire mariage ---------- */
// Mêmes couleurs que les e-mails du questionnaire mariage
const C = { fond: '#F4EFE9', carte: '#FBF8F4', ligne: '#E2D8CB', encre: '#2A2016', gris: '#6B5C48', pale: '#9A8B77' };
const TITRE = "'Bricolage Grotesque','Avenir Next','Helvetica Neue',Helvetica,Arial,sans-serif";
const TEXTE = "'Hanken Grotesk','Helvetica Neue',Helvetica,Arial,sans-serif";
const ligneT = (contenu, pad = '0 0 16px') => `<tr><td style="padding:${pad}">${contenu}</td></tr>`;
const tableP = (contenu, style = '') => `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="${style}">${contenu}</table>`;

// Sépare le message en : paragraphes, infos pratiques (code, date) et signature
function analyser(texte) {
  const infos = [];
  const garder = [];
  for (const l of String(texte || '').split('\n')) {
    const t = l.trim();
    let m;
    if ((m = t.match(/^(?:votre\s+)?code d[’']accès\s*:\s*(.+)$/i))) { infos.push(['Votre code d’accès', m[1]]); continue; }
    if ((m = t.match(/^code (?:pour )?(?:vos )?invités\s*:\s*(.+)$/i))) { infos.push(['Code pour vos invités', m[1]]); continue; }
    if ((m = t.match(/^la galerie reste en ligne jusqu[’']au (.+?)\.?$/i))) { infos.push(['En ligne jusqu’au', m[1]]); continue; }
    if (/^(votre galerie\s*:\s*)?https?:\/\/\S+$/i.test(t)) continue;
    garder.push(l);
  }
  const paras = garder.join('\n').split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  let signature = null;
  const dernier = paras[paras.length - 1] || '';
  if (/\n\s*Mélissa\s*$/.test(dernier) || /^Mélissa$/.test(dernier)) signature = paras.pop();
  return { paras, infos, signature };
}

// Version texte : les étapes s'insèrent avant la signature
function texteBrut(texte, etapes) {
  if (!etapes) return texte;
  const liste = etapes.map((e, i) => `${i + 1}. ${e.titre} : ${e.texte}`).join('\n\n');
  const i = texte.lastIndexOf('\n\n');
  return i > 0 ? texte.slice(0, i) + '\n\n' + liste + texte.slice(i) : texte + '\n\n' + liste;
}

function gabaritSobre(objet, texte, bouton) {
  const paras = esc(texte).split(/\n{2,}/).map((p) => `<p style="margin:0 0 14px;line-height:1.6">${p.replace(/\n/g, '<br>')}</p>`).join('');
  const btn = bouton ? `<p style="margin:20px 0 0"><a href="${esc(bouton.url)}" style="display:inline-block;background:${C.encre};color:${C.fond};text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:600">${esc(bouton.texte)}</a></p>` : '';
  return `<!doctype html><html><body style="margin:0;background:${C.fond};font-family:${TEXTE};color:${C.encre};font-size:15px">
<div style="max-width:560px;margin:0 auto;padding:28px 18px"><p style="margin:0 0 6px;font-size:12px;letter-spacing:.1em;text-transform:uppercase;color:${C.gris}">Ma galerie · notification</p>
<h1 style="margin:0 0 16px;font-family:${TITRE};font-weight:400;font-size:24px">${esc(objet)}</h1>${paras}${btn}</div></body></html>`;
}

function gabarit(env, { objet, texte, bouton, coll, etapes = null }, pieces = null) {
  const { paras, infos, signature } = analyser(texte);
  // Avec « pieces », chaque image est jointe à l'e-mail et affichée sans téléchargement (cid:)
  const img = (url, id, nom) => { if (!pieces) return url; pieces.push({ path: url, filename: nom, content_id: id }); return 'cid:' + id; };
  const seance = coll && coll.type === 'seance';
  const g = coll ? coll.reglages : {};
  const base = `https://${env.DOMAINE}`;
  // Séance en cours de sélection : photo floutée ; mariage ou séance livrée : photo nette
  const flou = seance && g.phase !== 'livraison';
  const v = flou ? g.banniereFlou : g.banniere;
  const banniere = coll && v ? `${base}/img/${coll.slug}/${flou ? 'email-flou' : 'email'}?v=${v}` : null;

  const entete = `<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
<td style="vertical-align:middle;padding-right:10px"><img src="${img(`${base}/assets/email/logo.png`, 'logo', 'logo.png')}" width="30" alt="" style="display:block;width:30px;height:auto;border:0"></td>
<td style="vertical-align:middle;font-family:${TEXTE}"><div style="font-family:${TITRE};font-weight:600;font-size:17px;line-height:1.15;color:${C.encre}">Mélissa Siméon</div>
<div style="font-size:13px;line-height:1.3;color:${C.gris}">${seance ? 'Photographe, Martinique' : 'Photographe de mariage, Martinique'}</div></td></tr></table>`;

  const photo = banniere ? `<a href="${esc(bouton ? bouton.url : base)}"><img src="${img(banniere, 'photo', 'photo.jpg')}" width="560" alt="${esc(g.nom || '')}" style="display:block;width:100%;max-width:560px;height:auto;border:0"></a>` : '';
  const titre = `<h1 style="margin:0;font-family:${TITRE};font-weight:700;font-size:40px;line-height:1.02;letter-spacing:-1.4px;color:${C.encre}">${esc(objet)}</h1>`;
  const corps = paras.map((p) => `<p style="margin:0 0 14px;font-family:${TEXTE};font-size:17px;line-height:1.55;color:${C.gris}">${esc(p).replace(/\n/g, '<br>')}</p>`).join('');

  const icone = (k) => /invités/i.test(k) ? 'invites' : /jusqu/i.test(k) ? 'calendrier' : 'cle';
  const carte = infos.length ? tableP(`<tr><td style="padding:2px 18px">${tableP(infos.map(([k, v], i) => {
    const bord = i ? `border-top:1px solid ${C.ligne};` : '', ic = icone(k);
    return `<tr><td style="width:22px;padding:16px 0;${bord}vertical-align:middle"><img src="${img(`${base}/assets/email/${ic}.png`, ic, ic + '.png')}" width="22" alt="" style="display:block;width:22px;height:22px;border:0"></td>`
      + `<td style="padding:14px 0 14px 14px;${bord}vertical-align:middle;font-family:${TEXTE}"><div style="font-size:13px;color:${C.gris}">${esc(k)}</div><div style="font-size:16px;font-weight:600;color:${C.encre}">${esc(v)}</div></td></tr>`;
  }).join(''))}</td></tr>`,
    `background:${C.carte};border:1px solid ${C.ligne};border-radius:18px`) : '';

  // Étapes numérotées (ex. : explication de la sélection pour l'album)
  const blocEtapes = etapes && etapes.length ? tableP(`<tr><td style="padding:4px 18px">${tableP(etapes.map((e, i) =>
    `<tr><td style="width:30px;padding:16px 0;${i ? `border-top:1px solid ${C.ligne};` : ''}vertical-align:top"><div style="width:30px;height:30px;line-height:30px;border-radius:50%;background:${C.encre};color:${C.fond};text-align:center;font-family:${TITRE};font-weight:600;font-size:15px">${i + 1}</div></td>`
    + `<td style="padding:15px 0 16px 14px;${i ? `border-top:1px solid ${C.ligne};` : ''}vertical-align:top;font-family:${TEXTE}"><div style="font-size:16px;font-weight:600;color:${C.encre};margin-bottom:4px">${esc(e.titre)}</div><div style="font-size:15px;line-height:1.55;color:${C.gris}">${esc(e.texte)}</div></td></tr>`).join(''))}</td></tr>`,
    `background:${C.carte};border:1px solid ${C.ligne};border-radius:18px`) : '';

  const btn = bouton ? tableP(`<tr><td style="padding:0 8px 0 24px;vertical-align:middle"><a href="${esc(bouton.url)}" style="font-family:${TEXTE};font-weight:600;font-size:16px;color:${C.fond};text-decoration:none;display:block">${esc(bouton.texte)}</a></td>
<td width="52" style="width:52px;padding:0;vertical-align:middle"><a href="${esc(bouton.url)}"><img src="${img(`${base}/assets/email/fleche.png`, 'fleche', 'fleche.png')}" width="52" alt="" style="display:block;width:52px;height:52px;border:0;border-radius:0 999px 999px 0"></a></td></tr>`,
    `background:${C.encre};border-radius:999px`) : '';

  const sign = signature ? `<p style="margin:0;font-family:${TEXTE};font-size:16px;line-height:1.5;color:${C.encre}">${esc(signature).replace(/\n\s*Mélissa\s*$/, '<br><strong>Mélissa</strong>').replace(/\n/g, '<br>')}</p>` : '';

  return `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light only"><style>:root{color-scheme:light only;supported-color-schemes:light only}</style>
<link href="https://${env.DOMAINE}/assets/polices.css" rel="stylesheet"></head>
<body style="margin:0;padding:0;background:${C.fond}"><div style="display:none;max-height:0;overflow:hidden;color:${C.fond}">${esc(paras[1] || paras[0] || objet)}</div>
${tableP(`<tr><td align="center" style="padding:28px 16px 40px">${tableP(
    ligneT(entete, '0 0 22px') +
    (photo ? ligneT(photo, '0 0 30px') : '') +
    ligneT(titre, '0 0 18px') +
    (corps ? ligneT(corps, '0 0 10px') : '') +
    (blocEtapes ? ligneT(blocEtapes, '0 0 22px') : '') +
    (carte ? ligneT(carte, '0 0 22px') : '') +
    (btn ? ligneT(btn, '0 0 28px') : '') +
    (sign ? ligneT(sign, '0') : '') +
    ligneT(`<p style="margin:0;padding-top:26px;border-top:1px solid ${C.ligne};font-family:${TEXTE};font-size:13px;line-height:1.5;color:${C.pale}">Mélissa Siméon, ${seance ? 'photographe' : 'photographe de mariage'} en Martinique · <a href="https://www.instagram.com/melissasimeon.ph/" style="color:${C.gris}">@melissasimeon.ph</a></p>`, '32px 0 0'),
    'max-width:560px')}</td></tr>`, `background:${C.fond}`)}
</body></html>`;
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
    texte: `Bonjour ${prenomsDe(g.nom)},\n\nMerci encore pour votre confiance, c’était un vrai plaisir de vous photographier.\n\nVos ${nb} photos retouchées sont prêtes ! Vous les retrouvez dans votre galerie, au même endroit et avec le même code, en haute définition et sans filigrane.\n\nElles restent disponibles jusqu’au ${dateFr(g.expiration)} : pensez à les télécharger pour les garder précieusement.\n\nCode d’accès : ${g.code}\n\nBelle découverte,\nMélissa`,
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
export { gabarit as _gabaritPourApercu };

// Mariage : explication de la sélection pour le livre photo, envoyée 5 minutes après la galerie
export function texteGuideAlbum(env, coll) {
  const g = coll.reglages;
  return {
    objet: '📖 Votre livre photo',
    texte: `Bonjour ${prenomsDe(g.nom)},\n\nVoici comment se passe la sélection ⬇️\n\nVotre code d’accès : ${g.code}\n\nÀ très vite,\nMélissa`,
    etapes: [
      { titre: 'Votre sélection', texte: `Dans la galerie, cliquez sur le bouton « + Ajouter à l’album » en bas à droite de chaque photo que vous souhaitez voir dans votre livre. Vous pouvez en choisir jusqu’à ${g.quota}. Une jauge vous indique où vous en êtes, et vous pouvez ajouter ou retirer des photos autant que vous le souhaitez.` },
      { titre: 'La validation', texte: 'Une fois votre sélection terminée, pensez bien à cliquer sur « Valider » dans la galerie. C’est ce qui m’envoie votre sélection par e-mail : sans cette étape, je ne la reçois pas !' },
      { titre: 'Ma mise en page', texte: 'À partir de votre sélection, je construis le livre pour qu’il raconte votre journée comme une histoire.' },
      { titre: 'L’impression', texte: 'J’envoie ensuite le livre à l’impression. Les délais dépendent de l’imprimeur et de l’acheminement jusqu’en Martinique, je ne peux donc pas m’engager sur une date de livraison précise, mais je vous tiendrai informés à chaque étape.' },
    ],
    bouton: { texte: 'Commencer ma sélection', url: lienGalerie(env, coll) },
  };
}
