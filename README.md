# Galerie Mélissa Siméon

Galeries photo privées pour les mariages et les séances (couple, famille, maternité), hébergées sur Cloudflare.

- **Adresse clients** : `https://galerie.melissa-simeon.com/<adresse-de-la-collection>`
- **Vue photographe** : `https://galerie.melissa-simeon.com/admin/` (protégée par Cloudflare Access, accès réservé à melissasimeon.ph@gmail.com)

## Comment c'est construit

| Élément | Rôle |
|---|---|
| Cloudflare Worker (`src/`) | Le site : accès clients, API, téléchargements ZIP, e-mails, tâche quotidienne |
| R2 `galerie-photos` | Les fichiers photo : `c/<collection>/<photo>/{hd,web,mini,apercu}.jpg` et `c/<collection>/mur.jpg` |
| D1 `galerie` | Collections, sélections, favoris, visiteurs, activité, e-mails, relances |
| `public/` | Pages et fichiers statiques (générés par `front/build.py`) |
| `front/` | Sources de l'interface : `app.js`, `app.css`, `body.html` |
| Resend | Envoi des e-mails depuis `galerie@melissa-simeon.com` |

Les versions web (2048 px) et miniatures (800 px) sont créées dans le navigateur au moment de l'envoi, ainsi que le CRC des fichiers : le Worker ne fait que recopier les octets pour les ZIP, même pour plusieurs Go.

Pour les séances, les aperçus sont extraits des RAW directement dans le navigateur, réduits à 1600 px et filigranés : les RAW ne quittent jamais l'ordinateur.

## Tâche quotidienne (9 h, heure de Martinique)

- archive les galeries arrivées à expiration ;
- envoie les rappels 30 et 7 jours avant l'expiration ;
- relance automatiquement les clients dont la sélection n'est pas envoyée (toutes les 2 semaines par défaut).

## Mettre à jour

Modifier `front/` puis lancer `python3 front/build.py` pour régénérer `public/`. Tout envoi sur la branche `main` est déployé automatiquement par Cloudflare.

## Réglages Cloudflare

Variables dans `wrangler.toml` : `DOMAINE`, `ADMIN_EMAIL`, `EXPEDITEUR`, `REPONSE_A`, `ACCESS_EQUIPE`, `ACCESS_AUD`.

Secrets (Workers › galerie-melissa-simeon › Settings › Variables and Secrets) :
- `SESSION_SECRET` : longue chaîne aléatoire, signe les accès clients ;
- `RESEND_API_KEY` : clé d'envoi Resend.

## Développement local

```bash
npm install
npx wrangler d1 migrations apply galerie --local
python3 front/build.py
npx wrangler dev   # .dev.vars : SESSION_SECRET=… et DEV=1 (désactive la vérification Access, en local uniquement)
```
