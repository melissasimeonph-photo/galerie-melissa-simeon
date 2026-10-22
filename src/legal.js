// Pages « Mentions légales » et « Confidentialité » (une seule page, deux ancres)
const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export function pageLegale(env, ancre) {
  const contact = env.REPONSE_A || 'melissasimeon.ph@gmail.com';
  const mail = `<a href="mailto:${esc(contact)}">${esc(contact)}</a>`;
  const html = `<!doctype html><html lang="fr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="robots" content="noindex"><title>${ancre === 'confidentialite' ? 'Confidentialité' : 'Mentions légales'} · Mélissa Siméon Photographie</title>
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml"><link rel="stylesheet" href="/assets/polices.css">
<style>
:root{--fond:#FFFFFF;--carte:#F7F7F6;--ligne:#EAEAE8;--encre:#2A2016;--gris:#6A6A6A}
*{box-sizing:border-box}
body{margin:0;background:var(--fond);color:var(--encre);font-family:"Hanken Grotesk",system-ui,-apple-system,"Segoe UI",sans-serif;font-size:16px;line-height:1.6;-webkit-font-smoothing:antialiased}
main{max-width:760px;margin:0 auto;padding:48px 20px 72px}
.haut{display:flex;align-items:center;gap:12px;margin-bottom:36px;font-family:"Bricolage Grotesque",sans-serif;font-size:16px}
.haut img{width:38px}
h1{font-family:"Bricolage Grotesque",sans-serif;font-weight:400;font-size:clamp(32px,6vw,44px);line-height:1.1;letter-spacing:-.01em;margin:0 0 8px}
h2{font-family:"Bricolage Grotesque",sans-serif;font-weight:600;font-size:19px;margin:30px 0 8px}
section{background:var(--carte);border:1px solid var(--ligne);border-radius:20px;padding:8px 28px 28px;margin:22px 0}
p,ul{margin:0 0 12px}ul{padding-left:20px}li{margin:4px 0}
.maj{color:var(--gris);font-size:14px;margin-top:28px}
a{color:inherit;text-underline-offset:2px}
nav{display:flex;gap:18px;font-size:14px;color:var(--gris);margin-bottom:6px}
@media (max-width:560px){section{padding:4px 18px 20px;border-radius:16px}main{padding-top:32px}}
</style></head><body><main>
<div class="haut"><img src="/assets/logo.svg" alt="">Mélissa Siméon · Photographie</div>
<nav><a href="#mentions">Mentions légales</a><a href="#confidentialite">Confidentialité</a></nav>

<section id="mentions">
<h1>Mentions légales</h1>
<h2>Éditrice du site</h2>
<p>Mélissa Siméon, entrepreneuse individuelle (EI), exerçant sous le nom « Mélissa Siméon Photographie ».<br>
Adresse : ${esc(env.ADRESSE || 'Schœlcher (97233), Martinique')}<br>
SIRET : 944 920 917 00019<br>
Contact : ${mail}</p>
<h2>Directrice de la publication</h2>
<p>Mélissa Siméon.</p>
<h2>Hébergement</h2>
<p>Cloudflare, Inc., 101 Townsend St, San Francisco, CA 94107, États-Unis (cloudflare.com).</p>
<h2>Propriété intellectuelle</h2>
<p>Les photographies présentées dans les galeries sont des œuvres protégées par le droit d’auteur, dont Mélissa Siméon est l’autrice. Elles sont remises aux clients pour un usage privé, dans les conditions prévues par leur contrat. Toute utilisation commerciale ou modification sans accord écrit préalable est interdite. En cas de publication sur les réseaux sociaux, merci de mentionner @melissasimeon.ph.</p>
<p>Chaque galerie est privée : elle n’est accessible qu’avec un code et n’est pas référencée par les moteurs de recherche.</p>
</section>

<section id="confidentialite">
<h1>Confidentialité</h1>
<h2>Responsable du traitement</h2>
<p>Mélissa Siméon (coordonnées ci-dessus). Pour toute question sur vos données : ${mail}.</p>
<h2>Données collectées</h2>
<ul>
<li>l’adresse e-mail saisie pour ouvrir une galerie, la date et le nombre de vos visites ;</li>
<li>vos favoris, votre sélection de photos (album ou retouches) et vos éventuelles notes ;</li>
<li>les téléchargements effectués depuis la galerie ;</li>
<li>pour les clients, l’adresse e-mail communiquée lors de la réservation, utilisée pour envoyer le lien de la galerie et les e-mails qui s’y rapportent ;</li>
<li>pour les demandes de devis ou de réservation, les informations saisies dans le formulaire de demande (coordonnées, date et déroulé de l’événement, préférences), utilisées pour vous répondre et préparer la prestation ;</li>
<li>de façon temporaire, l’adresse IP utilisée pour limiter les essais de code (effacée au bout de 24 heures).</li>
</ul>
<h2>Pourquoi</h2>
<p>Uniquement pour vous donner accès à la galerie privée, conserver vos favoris et votre sélection, assurer la livraison des photos et vous envoyer les e-mails liés à la galerie (envoi, rappel avant expiration, rappel de sélection). Aucune publicité, aucune revente, aucune mesure d’audience.</p>
<h2>Base légale</h2>
<p>L’exécution du contrat de prestation photographique pour les clients ; l’intérêt légitime de permettre aux invités d’accéder à la galerie que les clients ont choisi de partager avec eux.</p>
<h2>Durée de conservation</h2>
<p>Les données des visiteurs (e-mails de connexion, visites, favoris, téléchargements) sont effacées automatiquement trois mois après la date d’expiration de la galerie. Les coordonnées des clients sont conservées dans leur dossier client, pour la durée de la relation et des obligations légales. Les demandes de devis ou de réservation qui n’aboutissent pas sont effacées automatiquement au bout de 18 mois.</p>
<h2>Qui y a accès</h2>
<p>Mélissa Siméon uniquement. Le site s’appuie sur deux prestataires techniques : Cloudflare (hébergement du site et des photos) et Resend (envoi des e-mails), situés aux États-Unis. Ces transferts sont encadrés par les garanties prévues par le RGPD (clauses contractuelles types de la Commission européenne et cadre de protection des données UE–États-Unis).</p>
<h2>Cookies</h2>
<p>Le site utilise un seul cookie, strictement nécessaire : il garde votre accès ouvert à la galerie (30 jours au plus, supprimé si vous vous déconnectez). La taille d’affichage des photos que vous choisissez est mémorisée dans votre navigateur. Aucun cookie publicitaire ni de mesure d’audience : aucun consentement n’est donc nécessaire. Les polices d’écriture sont hébergées sur le site lui-même.</p>
<h2>Vos droits</h2>
<p>Vous pouvez accéder à vos données, les faire rectifier ou effacer, vous opposer à leur traitement, en demander la limitation ou la portabilité, en écrivant à ${mail}. Vous pouvez aussi adresser une réclamation à la CNIL (cnil.fr).</p>
<p class="maj">Dernière mise à jour : octobre 2026.</p>
</section>
</main></body></html>`;
  return new Response(html, { headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
