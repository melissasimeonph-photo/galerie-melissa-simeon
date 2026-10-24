-- Relances des devis et alertes quotidiennes
ALTER TABLE demandes ADD COLUMN relances TEXT NOT NULL DEFAULT '[]';
ALTER TABLE demandes ADD COLUMN alerte_le INTEGER;
