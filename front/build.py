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
def page(titre, mode, extra=''):
    return f'''<!doctype html>
<html lang="fr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">
<meta name="robots" content="noindex, nofollow">
<meta name="theme-color" content="#F4EFE9">
<title>{titre}</title>
<link rel="icon" href="/assets/logo.svg" type="image/svg+xml">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,300;12..96,400;12..96,600&family=Hanken+Grotesk:wght@400;500;600&display=swap">
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
(P / 'admin' / 'index.html').write_text(page('Mes galeries · Mélissa Siméon', 'admin'), encoding='utf-8')
print('ok', v)
