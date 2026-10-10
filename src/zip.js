// ZIP en flux, sans compression (les JPEG sont déjà compressés).
// Le CRC et la taille de chaque fichier sont calculés à l'envoi, donc le Worker ne fait que
// recopier les octets depuis R2 : très peu de calcul, même pour une galerie de plusieurs Go.
// Gère le format ZIP64 au-delà de 4 Go.

const enc = new TextEncoder();
const MAX32 = 0xffffffff;

function dosDateHeure(d = new Date()) {
  const t = (d.getHours() << 11) | (d.getMinutes() << 5) | (d.getSeconds() >> 1);
  const j = ((d.getFullYear() - 1980) << 9) | ((d.getMonth() + 1) << 5) | d.getDate();
  return [t, j];
}
class Tampon {
  constructor(n) { this.b = new Uint8Array(n); this.v = new DataView(this.b.buffer); this.i = 0; }
  u16(x) { this.v.setUint16(this.i, x, true); this.i += 2; return this; }
  u32(x) { this.v.setUint32(this.i, x >>> 0, true); this.i += 4; return this; }
  u64(x) { this.v.setUint32(this.i, x % 0x100000000, true); this.v.setUint32(this.i + 4, Math.floor(x / 0x100000000), true); this.i += 8; return this; }
  octets(a) { this.b.set(a, this.i); this.i += a.length; return this; }
}

// fichiers : [{ nom, taille, crc, cle }]
export function planZip(fichiers) {
  let offset = 0;
  const entrees = fichiers.map((f) => {
    const nom = enc.encode(f.nom);
    const z64 = f.taille >= MAX32;
    const locale = 30 + nom.length + (z64 ? 20 : 0);
    const e = { ...f, nomB: nom, z64, offset, locale };
    offset += locale + f.taille;
    return e;
  });
  const debutCentral = offset;
  let central = 0;
  for (const e of entrees) {
    e.z64c = e.z64 || e.offset >= MAX32;
    e.extraC = e.z64c ? 4 + (e.z64 ? 16 : 0) + (e.offset >= MAX32 ? 8 : 0) : 0;
    central += 46 + e.nomB.length + e.extraC;
  }
  const zip64 = debutCentral >= MAX32 || central >= MAX32 || entrees.length >= 0xffff || entrees.some((e) => e.z64c);
  const fin = (zip64 ? 56 + 20 : 0) + 22;
  return { entrees, debutCentral, central, zip64, total: debutCentral + central + fin };
}

export function fluxZip(env, plan) {
  // Flux natif de longueur fixe : les octets venant de R2 sont recopiés sans passer par du JavaScript,
  // ce qui ne consomme quasiment pas de temps CPU (limite de 10 ms sur l'offre gratuite).
  const { readable, writable } = typeof FixedLengthStream === 'function' ? new FixedLengthStream(plan.total) : new TransformStream();
  const [heure, jour] = dosDateHeure();
  (async () => {
    let w = writable.getWriter();
    try {
      for (const e of plan.entrees) {
        const t = new Tampon(e.locale);
        t.u32(0x04034b50).u16(e.z64 ? 45 : 20).u16(0x0800).u16(0).u16(heure).u16(jour).u32(e.crc)
          .u32(e.z64 ? MAX32 : e.taille).u32(e.z64 ? MAX32 : e.taille).u16(e.nomB.length).u16(e.z64 ? 20 : 0).octets(e.nomB);
        if (e.z64) t.u16(1).u16(16).u64(e.taille).u64(e.taille);
        await w.write(t.b);
        const obj = await env.PHOTOS.get(e.cle);
        if (!obj) throw new Error('Fichier manquant : ' + e.cle);
        w.releaseLock();
        await obj.body.pipeTo(writable, { preventClose: true });
        w = writable.getWriter();
      }
      const c = new Tampon(plan.central);
      for (const e of plan.entrees) {
        c.u32(0x02014b50).u16(45).u16(e.z64c ? 45 : 20).u16(0x0800).u16(0).u16(heure).u16(jour).u32(e.crc)
          .u32(e.z64 ? MAX32 : e.taille).u32(e.z64 ? MAX32 : e.taille).u16(e.nomB.length).u16(e.extraC).u16(0).u16(0).u16(0).u32(0)
          .u32(e.offset >= MAX32 ? MAX32 : e.offset).octets(e.nomB);
        if (e.z64c) {
          c.u16(1).u16(e.extraC - 4);
          if (e.z64) c.u64(e.taille).u64(e.taille);
          if (e.offset >= MAX32) c.u64(e.offset);
        }
      }
      await w.write(c.b);
      const n = plan.entrees.length;
      const f = new Tampon((plan.zip64 ? 76 : 0) + 22);
      if (plan.zip64) {
        const pos64 = plan.debutCentral + plan.central;
        f.u32(0x06064b50).u64(44).u16(45).u16(45).u32(0).u32(0).u64(n).u64(n).u64(plan.central).u64(plan.debutCentral);
        f.u32(0x07064b50).u32(0).u64(pos64).u32(1);
      }
      f.u32(0x06054b50).u16(0).u16(0).u16(Math.min(n, 0xffff)).u16(Math.min(n, 0xffff))
        .u32(plan.central >= MAX32 ? MAX32 : plan.central).u32(plan.debutCentral >= MAX32 ? MAX32 : plan.debutCentral).u16(0);
      await w.write(f.b);
      await w.close();
    } catch (err) {
      try { await w.abort(err); } catch {}
    }
  })();
  return readable;
}
