-- Demandes de devis (mariage) et de réservation (séances), suivies dans la vue photographe
CREATE TABLE IF NOT EXISTS demandes (
  id TEXT PRIMARY KEY,
  recu INTEGER NOT NULL,
  type TEXT NOT NULL DEFAULT 'mariage',
  nom TEXT, prenom TEXT, conjoint TEXT, email TEXT, tel TEXT,
  date_evt TEXT, date_txt TEXT, lieu TEXT, source TEXT, budget TEXT,
  champs TEXT NOT NULL DEFAULT '[]',
  statut TEXT NOT NULL DEFAULT 'nouvelle',
  devis_montant TEXT, devis_le INTEGER,
  notes TEXT NOT NULL DEFAULT '',
  collection_id TEXT,
  origine TEXT,
  maj INTEGER
);
CREATE INDEX IF NOT EXISTS demandes_recu ON demandes (recu);
