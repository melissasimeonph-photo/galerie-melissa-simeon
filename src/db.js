// Accès à la base D1
export async function collectionParSlug(env, slug) {
  let r = await env.DB.prepare('SELECT * FROM collections WHERE slug=?').bind(slug).first();
  if (!r) {
    const red = await env.DB.prepare('SELECT collection_id FROM redirections WHERE ancien_slug=?').bind(slug).first();
    if (red) {
      const c = await collectionParId(env, red.collection_id);
      if (c) return { ...c, redirige: true };
    }
    return null;
  }
  return deplier(r);
}
export async function collectionParId(env, id) {
  const r = await env.DB.prepare('SELECT * FROM collections WHERE id=?').bind(id).first();
  return r ? deplier(r) : null;
}
function deplier(r) { return { ...r, reglages: JSON.parse(r.reglages) }; }

export async function enregistrerReglages(env, coll) {
  await env.DB.prepare('UPDATE collections SET reglages=?, slug=?, maj_le=? WHERE id=?')
    .bind(JSON.stringify(coll.reglages), coll.slug, Date.now(), coll.id).run();
}

export async function journaliser(env, collectionId, qui, quoi) {
  await env.DB.prepare('INSERT INTO journal (collection_id, ts, qui, quoi) VALUES (?,?,?,?)').bind(collectionId, Date.now(), qui, quoi).run();
}

export async function photosDe(env, collectionId) {
  const { results } = await env.DB.prepare('SELECT * FROM photos WHERE collection_id=? ORDER BY dossier, ordre, nom').bind(collectionId).all();
  return results.map((p) => ({ ...p, variantes: JSON.parse(p.variantes || '{}') }));
}

export async function etatDe(env, collectionId) {
  const r = await env.DB.prepare('SELECT * FROM etats WHERE collection_id=?').bind(collectionId).first();
  if (!r) return { album: [], notes: {}, verrou: false, debut: null, maj: null, valide: null };
  return { album: JSON.parse(r.album), notes: JSON.parse(r.notes), verrou: !!r.verrou, debut: r.debut, maj: r.maj, valide: r.valide };
}
export async function enregistrerEtat(env, collectionId, e) {
  await env.DB.prepare(`INSERT INTO etats (collection_id, album, notes, verrou, debut, maj, valide) VALUES (?,?,?,?,?,?,?)
    ON CONFLICT(collection_id) DO UPDATE SET album=excluded.album, notes=excluded.notes, verrou=excluded.verrou, debut=excluded.debut, maj=excluded.maj, valide=excluded.valide`)
    .bind(collectionId, JSON.stringify(e.album), JSON.stringify(e.notes), e.verrou ? 1 : 0, e.debut, e.maj, e.valide).run();
}

export const cleR2 = (collectionId, photoId, variante) => `c/${collectionId}/${photoId}/${variante}.jpg`;

export async function supprimerPrefixeR2(env, prefixe) {
  let curseur;
  do {
    const l = await env.PHOTOS.list({ prefix: prefixe, cursor: curseur, limit: 1000 });
    if (l.objects.length) await env.PHOTOS.delete(l.objects.map((o) => o.key));
    curseur = l.truncated ? l.cursor : undefined;
  } while (curseur);
}
