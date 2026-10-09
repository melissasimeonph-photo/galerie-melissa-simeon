-- Collections : une ligne par galerie (mariage ou séance), réglages en JSON
CREATE TABLE collections (
  id TEXT PRIMARY KEY,
  slug TEXT UNIQUE NOT NULL,
  type TEXT NOT NULL DEFAULT 'mariage',
  reglages TEXT NOT NULL,
  cree_le INTEGER NOT NULL,
  maj_le INTEGER NOT NULL
);
-- Anciennes adresses, pour rediriger après un changement d'URL
CREATE TABLE redirections (ancien_slug TEXT PRIMARY KEY, collection_id TEXT NOT NULL);

-- Photos ; les fichiers sont dans R2 sous c/<collection>/<photo>/<variante>.jpg
CREATE TABLE photos (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  collection_id TEXT NOT NULL,
  dossier TEXT NOT NULL,
  nom TEXT NOT NULL,
  w INTEGER, h INTEGER,
  ordre INTEGER NOT NULL DEFAULT 0,
  variantes TEXT NOT NULL DEFAULT '{}',
  cree_le INTEGER NOT NULL
);
CREATE INDEX photos_coll ON photos (collection_id, dossier, ordre);

-- Sélection (album ou séance), partagée par le couple
CREATE TABLE etats (
  collection_id TEXT PRIMARY KEY,
  album TEXT NOT NULL DEFAULT '[]',
  notes TEXT NOT NULL DEFAULT '{}',
  verrou INTEGER NOT NULL DEFAULT 0,
  debut INTEGER, maj INTEGER, valide INTEGER
);

-- Favoris, par personne et par liste
CREATE TABLE favoris (
  collection_id TEXT NOT NULL, email TEXT NOT NULL, liste TEXT NOT NULL, photo_id INTEGER NOT NULL,
  PRIMARY KEY (collection_id, email, liste, photo_id)
);

CREATE TABLE visiteurs (
  collection_id TEXT NOT NULL, email TEXT NOT NULL, role TEXT NOT NULL,
  premiere INTEGER NOT NULL, derniere INTEGER NOT NULL, visites INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (collection_id, email)
);

CREATE TABLE journal (id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id TEXT NOT NULL, ts INTEGER NOT NULL, qui TEXT NOT NULL, quoi TEXT NOT NULL);
CREATE INDEX journal_coll ON journal (collection_id, ts);

CREATE TABLE telechargements (
  id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id TEXT NOT NULL, email TEXT, role TEXT,
  photo_id INTEGER, portee TEXT, qualite TEXT, nb INTEGER NOT NULL DEFAULT 1, ts INTEGER NOT NULL
);
CREATE INDEX dl_coll ON telechargements (collection_id, ts);

CREATE TABLE emails (id INTEGER PRIMARY KEY AUTOINCREMENT, collection_id TEXT, ts INTEGER NOT NULL, destinataire TEXT, objet TEXT, statut TEXT);
CREATE TABLE relances (collection_id TEXT NOT NULL, ts INTEGER NOT NULL, auto INTEGER NOT NULL DEFAULT 0);

-- Anti force brute sur la page d'accès
CREATE TABLE tentatives (cle TEXT PRIMARY KEY, nb INTEGER NOT NULL, depuis INTEGER NOT NULL);

-- Préférences de la vue photographe (favoris de collections, panneau replié…)
CREATE TABLE prefs (cle TEXT PRIMARY KEY, valeur TEXT NOT NULL);
