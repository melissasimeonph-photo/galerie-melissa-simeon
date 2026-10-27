# Construit public/client.html, public/admin/index.html et public/assets/app.{js,css}
import pathlib, hashlib
R = pathlib.Path(__file__).resolve().parent
P = R.parent / 'public'
logo = (R / 'logo.svg').read_text(encoding='utf-8').strip()
js = (R / 'app.js').read_text(encoding='utf-8').replace('{{LOGO_JS}}', logo)
css = (R / 'app.css').read_text(encoding='utf-8')
corps = (R / 'body.html').read_text(encoding='utf-8').replace('{{LOGO}}', logo)
v = hashlib.sha1((js + css).encode()).hexdigest()[:8]
(P / 'assets').mkdir(parents=True, exist_ok=True)
(P / 'admin').mkdir(parents=True, exist_ok=True)
(P / 'assets' / 'app.js').write_text(js, encoding='utf-8')
(P / 'assets' / 'app.css').write_text(css, encoding='utf-8')
def page(titre, mode, extra='', tete=''):
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#FFFFFF">
<title>{titre}</title>
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
{tete}<link rel="preload" href="/assets/polices/hanken-grotesk-latin-wght-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="preload" href="/assets/polices/bricolage-grotesque-latin-opsz-normal.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/assets/polices.css">
<link rel="stylesheet" href="/assets/app.css?v={v}">
<script>window.MODE='{mode}';{extra}</script>
</head>
<body>
{corps}
<script src="/assets/app.js?v={v}"></script>
</body>
</html>
'''
(P / 'client.html').write_text(page('__TITRE__', 'client', 'window.COLL=/*__COLLECTION__*/null;'), encoding='utf-8')
(P / 'admin' / 'index.html').write_text(page('Mes galeries · Mélissa Siméon', 'admin', tete='''<link rel="manifest" href="/assets/app/admin.webmanifest">
<link rel="apple-touch-icon" href="/assets/app/icone-180.png">
<meta name="apple-mobile-web-app-capable" content="yes">
<meta name="mobile-web-app-capable" content="yes">
<meta name="apple-mobile-web-app-title" content="Mes galeries">
<meta name="apple-mobile-web-app-status-bar-style" content="default">
'''), encoding='utf-8')
print('ok', v)
