// Genera src/game/world/traversal.json midiendo los GLB (public/models/rig10 + public/models/scenario/additions.glb).
// Uso: node scripts/extract-traversal.mjs [--check]   (--check: falla si el JSON del repo difiere del generado)
// Reproducible: mismo GLB => mismo JSON (se redondea a mm). Falla en voz alta si una forma no es la esperada.
// Qué mide y por qué: docs/traversal-inventory.md. Nada de esto es as-built (ver docs/scenario-additions.md).
import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { NodeIO } from '@gltf-transform/core'
import { ALL_EXTENSIONS } from '@gltf-transform/extensions'
import { MeshoptDecoder } from 'meshoptimizer'

const RIG = 'public/models/rig10/'
const ADD = 'public/models/scenario/additions.glb'
const OUT = 'src/game/world/traversal.json'
const r3 = (v) => Math.round(v * 1000) / 1000
const v3 = (a) => a.map(r3)
const fail = (msg) => {
  throw new Error(`extract-traversal: ${msg}`)
}
const expect = (cond, msg) => cond || fail(msg)

await MeshoptDecoder.ready
const io = new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({ 'meshopt.decoder': MeshoptDecoder })
const sources = {}

// ---------- carga: triángulos en coordenadas de mundo, con el nombre del nodo ----------
const mul = (m, p) => [
  m[0] * p[0] + m[4] * p[1] + m[8] * p[2] + m[12],
  m[1] * p[0] + m[5] * p[1] + m[9] * p[2] + m[13],
  m[2] * p[0] + m[6] * p[1] + m[10] * p[2] + m[14],
]
async function load(path) {
  sources[path] = createHash('sha256').update(readFileSync(path)).digest('hex')
  const doc = await io.read(path)
  const tris = [] // {node, a, b, c}
  const nodes = []
  for (const n of doc.getRoot().listNodes()) {
    nodes.push(n)
    const mesh = n.getMesh()
    if (!mesh || n.getName().endsWith('_aristas')) continue
    const M = n.getWorldMatrix()
    for (const p of mesh.listPrimitives()) {
      if (p.getMode() !== 4) continue
      const pos = p.getAttribute('POSITION')
      const idx = p.getIndices()
      const cnt = idx ? idx.getCount() : pos.getCount()
      const v = (i) => mul(M, pos.getElement(idx ? idx.getScalar(i) : i, []))
      for (let t = 0; t < cnt; t += 3) tris.push({ node: n.getName(), a: v(t), b: v(t + 1), c: v(t + 2) })
    }
  }
  return { tris, nodes }
}
const has = (s) => (t) => t.node.includes(s)
const not = (f) => (t) => !f(t)
const and = (...fs) => (t) => fs.every((f) => f(t))

function normalY(t) {
  const u = [t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]]
  const w = [t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]]
  const n = [u[1] * w[2] - u[2] * w[1], u[2] * w[0] - u[0] * w[2], u[0] * w[1] - u[1] * w[0]]
  const L = Math.hypot(...n)
  return L ? { ny: n[1] / L, area: L / 2 } : { ny: 0, area: 0 }
}

// Componentes planas hacia arriba (|n.y| > 0.97) agrupadas por altura (±3 cm) y bbox XZ en contacto (5 cm).
function flats(tris, filter, ylo = -99, yhi = 99) {
  const comps = []
  for (const t of tris) {
    if (!filter(t)) continue
    const { ny, area } = normalY(t)
    if (ny < 0.97) continue
    const y = (t.a[1] + t.b[1] + t.c[1]) / 3
    if (y < ylo || y > yhi) continue
    const q = { y, A: area, x0: Math.min(t.a[0], t.b[0], t.c[0]), x1: Math.max(t.a[0], t.b[0], t.c[0]), z0: Math.min(t.a[2], t.b[2], t.c[2]), z1: Math.max(t.a[2], t.b[2], t.c[2]) }
    const hit = comps.filter((c) => Math.abs(c.y - q.y) < 0.03 && q.x0 <= c.x1 + 0.05 && q.x1 >= c.x0 - 0.05 && q.z0 <= c.z1 + 0.05 && q.z1 >= c.z0 - 0.05)
    const c = hit[0] ?? (comps.push({ ...q, A: 0 }), comps[comps.length - 1])
    for (const h of hit.slice(1)) {
      Object.assign(c, { x0: Math.min(c.x0, h.x0), x1: Math.max(c.x1, h.x1), z0: Math.min(c.z0, h.z0), z1: Math.max(c.z1, h.z1), A: c.A + h.A })
      comps.splice(comps.indexOf(h), 1)
    }
    Object.assign(c, { x0: Math.min(c.x0, q.x0), x1: Math.max(c.x1, q.x1), z0: Math.min(c.z0, q.z0), z1: Math.max(c.z1, q.z1), A: c.A + q.A })
  }
  return comps
}

// Muestrea puntos sobre los triángulos (paso ~2,5 cm) dentro de una banda de altura.
function samples(tris, filter, ylo, yhi, step = 0.025) {
  const out = []
  for (const t of tris) {
    if (!filter(t)) continue
    const ys = [t.a[1], t.b[1], t.c[1]]
    if (Math.max(...ys) < ylo || Math.min(...ys) > yhi) continue
    const L = Math.max(Math.hypot(t.b[0] - t.a[0], t.b[1] - t.a[1], t.b[2] - t.a[2]), Math.hypot(t.c[0] - t.a[0], t.c[1] - t.a[1], t.c[2] - t.a[2]), Math.hypot(t.c[0] - t.b[0], t.c[1] - t.b[1], t.c[2] - t.b[2]))
    const n = Math.min(200, Math.max(1, Math.ceil(L / step)))
    for (let i = 0; i <= n; i++)
      for (let j = 0; j <= n - i; j++) {
        const k = n - i - j
        const p = [0, 1, 2].map((d) => (t.a[d] * i + t.b[d] * j + t.c[d] * k) / n)
        if (p[1] >= ylo && p[1] <= yhi) out.push(p)
      }
  }
  return out
}

// Grilla XZ ocupada -> tramos rectos (barandas). Devuelve segmentos {axis, at, from, to}.
function railRuns(pts, res = 0.05, minLen = 0.5) {
  const occ = new Set(pts.map((p) => `${Math.floor(p[0] / res)},${Math.floor(p[2] / res)}`))
  const segs = []
  for (const axis of ['x', 'z']) {
    const lines = new Map() // coordenada fija -> índices ocupados a lo largo
    for (const k of occ) {
      const [i, j] = k.split(',').map(Number)
      const [fixed, along] = axis === 'x' ? [j, i] : [i, j]
      ;(lines.get(fixed) ?? lines.set(fixed, []).get(fixed)).push(along)
    }
    const runs = []
    for (const [fixed, list] of lines) {
      list.sort((a, b) => a - b)
      let s = list[0]
      for (let n = 1; n <= list.length; n++) {
        if (n < list.length && list[n] <= list[n - 1] + 2) continue // tolera 1 celda vacía
        const e = list[n - 1]
        if ((e - s + 1) * res >= minLen) runs.push({ fixed, s, e })
        s = list[n]
      }
    }
    // une filas vecinas con el mismo tramo (un caño ocupa 1-2 celdas de ancho)
    runs.sort((a, b) => a.fixed - b.fixed)
    const used = new Set()
    for (const r of runs) {
      if (used.has(r)) continue
      const group = [r]
      for (const q of runs) if (!used.has(q) && q !== r && Math.abs(q.fixed - group[group.length - 1].fixed) === 1 && Math.abs(q.s - r.s) <= 3 && Math.abs(q.e - r.e) <= 3) group.push(q)
      group.forEach((g) => used.add(g))
      const at = ((group[0].fixed + group[group.length - 1].fixed + 1) / 2) * res
      segs.push({ axis, at, from: Math.min(...group.map((g) => g.s)) * res, to: (Math.max(...group.map((g) => g.e)) + 1) * res })
    }
  }
  // tramos paralelos a <=10 cm que se solapan (pasamanos + panel/rodapié del mismo lado) => uno solo
  for (let i = 0; i < segs.length; i++)
    for (let j = segs.length - 1; j > i; j--) {
      const a = segs[i]
      const b = segs[j]
      if (a.axis !== b.axis || Math.abs(a.at - b.at) > 0.1 + 1e-9 || b.from > a.to || a.from > b.to) continue
      Object.assign(a, { at: (a.at + b.at) / 2, from: Math.min(a.from, b.from), to: Math.max(a.to, b.to) })
      segs.splice(j, 1)
    }
  return segs
}
const railSeg = (s, baseY, topY) =>
  s.axis === 'x'
    ? { a: v3([s.from, baseY, s.at]), b: v3([s.to, baseY, s.at]), height: r3(topY - baseY) }
    : { a: v3([s.at, baseY, s.from]), b: v3([s.at, baseY, s.to]), height: r3(topY - baseY) }

// Caja AABB de los puntos (vértices) de un filtro dentro de una banda.
function aabb(tris, filter, ylo, yhi) {
  const min = [1e9, 1e9, 1e9]
  const max = [-1e9, -1e9, -1e9]
  for (const t of tris)
    if (filter(t))
      for (const p of [t.a, t.b, t.c])
        if (p[1] >= ylo && p[1] <= yhi) for (let i = 0; i < 3; i++) (min[i] = Math.min(min[i], p[i])), (max[i] = Math.max(max[i], p[i]))
  return min[0] > max[0] ? null : { min, max }
}
const solid = (id, partId, kind, min, max, origin = 'glb') => ({
  id,
  partId,
  kind,
  origin,
  center: v3([(min[0] + max[0]) / 2, (min[1] + max[1]) / 2, (min[2] + max[2]) / 2]),
  half: v3([(max[0] - min[0]) / 2, (max[1] - min[1]) / 2, (max[2] - min[2]) / 2]),
})
// Cajas por banda de altura (mástil, BOP): el bbox completo de la pieza tapaba el piso de trabajo.
function bands(id, tris, filter, edges) {
  const out = []
  for (let i = 0; i + 1 < edges.length; i++) {
    const b = aabb(tris, filter, edges[i], edges[i + 1])
    if (b) out.push(solid(`${id}_banda${i}`, id, 'solid', [b.min[0], edges[i], b.min[2]], [b.max[0], edges[i + 1], b.max[2]]))
  }
  return out
}

// Componentes de una grilla de ocupación (obstáculos sobre una cubierta).
function blobs(pts, res = 0.1) {
  const cells = new Map()
  for (const p of pts) {
    const k = `${Math.floor(p[0] / res)},${Math.floor(p[2] / res)}`
    const c = cells.get(k) ?? cells.set(k, { ymax: -1e9 }).get(k)
    c.ymax = Math.max(c.ymax, p[1])
  }
  const seen = new Set()
  const out = []
  for (const k of cells.keys()) {
    if (seen.has(k)) continue
    seen.add(k)
    const st = [k]
    const b = { x0: 1e9, x1: -1e9, z0: 1e9, z1: -1e9, ymax: -1e9 }
    while (st.length) {
      const cur = st.pop()
      const [i, j] = cur.split(',').map(Number)
      Object.assign(b, { x0: Math.min(b.x0, i * res), x1: Math.max(b.x1, (i + 1) * res), z0: Math.min(b.z0, j * res), z1: Math.max(b.z1, (j + 1) * res), ymax: Math.max(b.ymax, cells.get(cur).ymax) })
      for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const nk = `${i + di},${j + dj}`
        if (cells.has(nk) && !seen.has(nk)) seen.add(nk), st.push(nk)
      }
    }
    out.push(b)
  }
  return out
}

const DROPS = 'vendor/visor/drops.json (Libro DROPS 2024, RCCO)'
const ev = (status, ref) => ({ status, ref })

const solids = []
const rails = []
const stairs = []
const ramps = []
const platforms = []

// ================= PISO DE TRABAJO (sk575_piso) =================
const piso = await load(RIG + 'sk575_piso.glb')
const floor = flats(piso.tris, has('sk575_piso_acero'), 3.4, 3.8).sort((a, b) => b.A - a.A)[0]
expect(floor && floor.A > 9 && Math.abs(floor.y - 3.61) < 0.05, `piso: chapa del piso de trabajo no encontrada (${JSON.stringify(floor)})`)
const FLOOR_Y = floor.y
platforms.push({ id: 'piso_trabajo', partId: 'sk575_piso', y: r3(FLOOR_Y), min: v3([floor.x0, floor.z0]), max: v3([floor.x1, floor.z1]), evidence: ev('documentado', `${DROPS}: PT-1..PT-4`) })
solids.push(solid('piso_chapa', 'sk575_piso', 'walkable', [floor.x0, FLOOR_Y - 0.26, floor.z0], [floor.x1, FLOOR_Y, floor.z1]))
// Subestructura: pórticos laterales (parantes cada <0,7 m => pared) o parantes sueltos.
{
  const pts = samples(piso.tris, has('sk575_piso_rojo'), 0.4, FLOOR_Y - 0.3, 0.05)
  const res = 0.1
  const rows = new Map()
  for (const p of pts) {
    const j = Math.floor(p[2] / res)
    ;(rows.get(j) ?? rows.set(j, new Set()).get(j)).add(Math.floor(p[0] / res))
  }
  const js = [...rows.keys()].sort((a, b) => a - b)
  const groups = [] // filas z contiguas = un pórtico (o una línea de parantes)
  for (const j of js) {
    const g = groups[groups.length - 1]
    if (g && j - g.j1 <= 1) g.j1 = j
    else groups.push({ j0: j, j1: j, xs: new Set() })
    rows.get(j).forEach((x) => groups[groups.length - 1].xs.add(x))
  }
  expect(groups.length >= 2, `piso: se esperaban pórticos laterales de la subestructura, hay ${groups.length} bandas`)
  groups.forEach((g, gi) => {
    const xs = [...g.xs].sort((a, b) => a - b)
    const gaps = xs.slice(1).map((x, i) => (x - xs[i] - 1) * res)
    const z0 = g.j0 * res
    const z1 = (g.j1 + 1) * res
    if (Math.max(0, ...gaps) < 0.7) solids.push(solid(`piso_portico${gi}`, 'sk575_piso', 'solid', [xs[0] * res, 0, z0], [(xs[xs.length - 1] + 1) * res, FLOOR_Y - 0.26, z1]))
    else {
      let s = xs[0]
      xs.forEach((x, i) => {
        if (i + 1 < xs.length && xs[i + 1] - x <= 1) return
        solids.push(solid(`piso_parante${gi}_${s}`, 'sk575_piso', 'solid', [s * res, 0, z0], [(x + 1) * res, FLOOR_Y - 0.26, z1]))
        s = xs[i + 1]
      })
    }
  })
}
// Barandas del piso: pasamanos superior amarillo.
const pisoTop = flats(piso.tris, has('sk575_piso_amarillo'), FLOOR_Y + 0.9, FLOOR_Y + 1.3).sort((a, b) => b.y - a.y)[0]
expect(pisoTop, 'piso: no hay pasamanos amarillo')
const pisoRails = railRuns(samples(piso.tris, has('sk575_piso_amarillo'), pisoTop.y - 0.04, pisoTop.y + 0.04))
expect(pisoRails.length >= 4, `piso: se esperaban >=4 tramos de baranda, hay ${pisoRails.length}`)
pisoRails.forEach((s, i) => rails.push({ id: `piso_baranda${i}`, partId: 'sk575_piso', origin: 'glb', ...railSeg(s, FLOOR_Y, pisoTop.y + 0.03), evidence: ev('documentado', `${DROPS}: PT-3`) }))

// ================= BOP: debajo del piso y lo que asoma sobre él =================
const bop = await load(RIG + 'sk575_bop.glb')
solids.push(...bands('sk575_bop', bop.tris, () => true, [-0.7, FLOOR_Y, 4.3]))

// ================= MÁSTIL y PISO DE ENGANCHE =================
const mast = await load(RIG + 'sk575_mastil.glb')
const isBoard = has('sk575_enganche')
{
  const top = aabb(mast.tris, not(isBoard), -1, 99).max[1]
  const edges = [-0.1, FLOOR_Y]
  while (edges[edges.length - 1] + 2 < top) edges.push(edges[edges.length - 1] + 2)
  edges.push(top + 0.01)
  solids.push(...bands('sk575_mastil', mast.tris, not(isBoard), edges))
}
const board = flats(mast.tris, isBoard, 20, 21).sort((a, b) => b.A - a.A)[0]
expect(board && board.A > 3, 'mástil: no se encontró la plancha del piso de enganche')
platforms.push({ id: 'piso_enganche', partId: 'sk575_mastil', y: r3(board.y), min: v3([board.x0, board.z0]), max: v3([board.x1, board.z1]), evidence: ev('documentado', `${DROPS}: PE-1..PE-13 (existencia); altura aproximada`) })
solids.push(solid('enganche_plancha', 'sk575_mastil', 'walkable', [board.x0, board.y - 0.08, board.z0], [board.x1, board.y, board.z1]))
{
  const tops = flats(mast.tris, isBoard, board.y + 0.9, board.y + 1.3).sort((a, b) => b.y - a.y)
  expect(tops.length, 'enganche: no hay pasamanos')
  const segs = railRuns(samples(mast.tris, isBoard, tops[0].y - 0.04, tops[0].y + 0.04), 0.05, 1.0).filter((s) => s.axis === 'x')
  expect(segs.length === 2, `enganche: se esperaban 2 barandas laterales, hay ${segs.length}`)
  segs.forEach((s, i) => rails.push({ id: `enganche_baranda${i}`, partId: 'sk575_mastil', origin: 'glb', ...railSeg(s, board.y, tops[0].y + 0.03), evidence: ev('documentado', `${DROPS}: PE-7 (puerta de ingreso)`) }))
}
// Cara +X del reticulado (para verificar la escalera vertical añadida).
function faceX(y0, y1) {
  const b = aabb(mast.tris, and(has('sk575_mastil_amarillo')), y0, y1)
  return b && b.max[0]
}

// ================= PLANCHADA: pasarela y rampa de la V =================
const pl = await load(RIG + 'sk575_planchada.glb')
const deck = flats(pl.tris, has('sk575_planchada_grating'), 0.9, 1.2).sort((a, b) => b.A - a.A)[0]
expect(deck && deck.A > 20, 'planchada: no se encontró la pasarela')
platforms.push({ id: 'planchada_pasarela', partId: 'sk575_planchada', y: r3(deck.y), min: v3([deck.x0, deck.z0]), max: v3([deck.x1, deck.z1]), evidence: ev('documentado', `${DROPS}: PLA-1, PLA-2`) })
// Pasarela sobre caballetes a 1,05 m: no se puede pasar por debajo => sólido hasta el suelo.
solids.push(solid('planchada_pasarela', 'sk575_planchada', 'walkable', [deck.x0, 0, deck.z0], [deck.x1, deck.y, deck.z1]))
{
  let mn = [1e9, 1e9, 1e9]
  let mx = [-1e9, -1e9, -1e9]
  let n = 0
  for (const t of pl.tris) {
    if (!has('sk575_planchada_grating')(t)) continue
    const { ny, area } = normalY(t)
    const deg = (Math.acos(Math.min(1, ny)) * 180) / Math.PI
    const ys = [t.a[1], t.b[1], t.c[1]]
    if (deg < 18 || deg > 32 || area < 0.01 || Math.max(...ys) - Math.min(...ys) < 0.2) continue // descarta chaflanes de borde
    n++
    for (const p of [t.a, t.b, t.c]) for (let i = 0; i < 3; i++) (mn[i] = Math.min(mn[i], p[i])), (mx[i] = Math.max(mx[i], p[i]))
  }
  expect(n >= 2, 'planchada: no se encontró la rampa de la V')
  const slope = (Math.atan2(mx[1] - mn[1], mx[0] - mn[0]) * 180) / Math.PI
  expect(slope > 20 && slope < 30, `planchada: pendiente de la rampa inesperada (${slope})`)
  expect(Math.abs(mx[1] - FLOOR_Y) < 0.05, `planchada: la rampa no llega al piso de trabajo (${mx[1]} vs ${FLOOR_Y})`)
  ramps.push({ id: 'rampa_v', partId: 'sk575_planchada', origin: 'glb', bottom: v3([mx[0], mn[1], (mn[2] + mx[2]) / 2]), top: v3([mn[0], mx[1], (mn[2] + mx[2]) / 2]), width: r3(mx[2] - mn[2]), slopeDeg: r3(slope), evidence: ev('documentado', `${DROPS}: PT-4 (baranda de plano inclinado)`) })
}

// ================= PILETAS: cubiertas, escaleras, barandas, equipos sobre cubierta =================
const pil = await load(RIG + 'sk575_piletas.glb')
const grat = has('sk575_piletas_grating')
const pf = flats(pil.tris, grat)
const decks = pf.filter((c) => c.A > 4).sort((a, b) => a.z0 - b.z0)
expect(decks.length === 4, `piletas: se esperaban 4 cubiertas (3 piletas + trip tank), hay ${decks.length}`)
const treads = pf.filter((c) => c.A > 0.1 && c.A < 0.3)
decks.forEach((d, i) => {
  const id = `pileta${i}`
  platforms.push({ id, partId: 'sk575_piletas', y: r3(d.y), min: v3([d.x0, d.z0]), max: v3([d.x1, d.z1]), evidence: ev('documentado', `${DROPS}: PIL-2 (barandas)`) })
  solids.push(solid(`${id}_tanque`, 'sk575_piletas', 'walkable', [d.x0, 0, d.z0], [d.x1, d.y, d.z1]))
  // escalera: huellas en la misma franja z, que suben en +X hasta el borde -X de la cubierta
  const mine = treads.filter((t) => t.y < d.y && t.x1 <= d.x0 + 0.05 && d.x0 - t.x1 < 2.5 && t.z0 >= d.z0 - 0.05 && t.z1 <= d.z1 + 0.05).sort((a, b) => a.y - b.y)
  expect(mine.length >= 5, `piletas: ${id} sin escalera reconocible (${mine.length} huellas)`)
  const z0 = mine[0].z0
  const z1 = mine[0].z1
  expect(mine.every((t) => Math.abs(t.z0 - z0) < 0.02 && Math.abs(t.z1 - z1) < 0.02), `piletas: huellas de ${id} desalineadas`)
  for (let k = 1; k < mine.length; k++) expect(mine[k].x0 > mine[k - 1].x0, `piletas: la escalera de ${id} no sube en +X`)
  // línea de narices (borde -X de cada huella) hasta el borde de la cubierta, extrapolada a y=0
  const first = mine[0]
  const slope = (d.y - first.y) / (d.x0 - first.x0)
  const x0 = first.x0 - first.y / slope
  const rise = (d.y - first.y) / mine.length
  stairs.push({
    id: `${id}_escalera`,
    partId: 'sk575_piletas',
    origin: 'glb',
    bottom: v3([x0, 0, (z0 + z1) / 2]),
    top: v3([d.x0, d.y, (z0 + z1) / 2]),
    width: r3(z1 - z0),
    treads: mine.length,
    rise: r3(rise),
    going: r3((mine[mine.length - 1].x0 - first.x0) / (mine.length - 1)),
    slopeDeg: r3((Math.atan(slope) * 180) / Math.PI),
    evidence: ev('documentado', `${DROPS}: PIL-2; visor docs/references/piletas: "baranda abierta 0,8 m en la escalera"`),
  })
  // equipos sobre la cubierta (más altos que un escalón): cajas desde la cubierta
  const onDeck = samples(pil.tris, and(not(grat), not(has('amarillo'))), d.y + 0.3, d.y + 1.9, 0.05).filter((p) => p[0] > d.x0 && p[0] < d.x1 && p[2] > d.z0 && p[2] < d.z1)
  blobs(onDeck)
    .filter((b) => (b.x1 - b.x0) * (b.z1 - b.z0) > 0.02)
    .forEach((b, k) => solids.push(solid(`${id}_equipo${k}`, 'sk575_piletas', 'solid', [b.x0, d.y, b.z0], [b.x1, b.ymax, b.z1])))
})
// barandas: pasamanos superior de cada cubierta (y cubierta + ~1 m)
for (const [i, d] of decks.entries()) {
  const top = flats(pil.tris, has('sk575_piletas_amarillo'), d.y + 0.8, d.y + 1.2).filter((c) => c.x1 > d.x0 && c.x0 < d.x1 && c.z1 > d.z0 - 0.2 && c.z0 < d.z1 + 0.2).sort((a, b) => b.A - a.A)[0]
  if (!top) continue
  const pts = samples(pil.tris, has('sk575_piletas_amarillo'), top.y - 0.03, top.y + 0.03).filter((p) => p[0] > d.x0 - 0.2 && p[0] < d.x1 + 0.2 && p[2] > d.z0 - 0.2 && p[2] < d.z1 + 0.2)
  railRuns(pts, 0.05, 0.6).forEach((s, k) => rails.push({ id: `pileta${i}_baranda${k}`, partId: 'sk575_piletas', origin: 'glb', ...railSeg(s, d.y, top.y + 0.03), evidence: ev('documentado', `${DROPS}: PIL-2`) }))
}

// ================= ADICIONES (escenario ilustrativo añadido por el juego) =================
const add = await load(ADD)
const anchor = (name) => {
  const n = add.nodes.find((x) => x.getName() === name) ?? fail(`adiciones: falta el anclaje ${name}`)
  return { p: n.getTranslation(), x: n.getExtras() }
}
const ladders = []
{
  const s = anchor('anchor_stair_planchada')
  expect(Math.abs(s.p[1] - deck.y) < 0.02 && Math.abs(s.p[0] - deck.x1) < 0.05, 'adiciones: la escalera no coincide con el extremo medido de la pasarela')
  const bottom = [s.x.bottomX, s.x.bottomY, s.p[2]]
  stairs.push({
    id: 'planchada_escalera',
    partId: 'sk575_planchada',
    origin: 'adicion',
    bottom: v3(bottom),
    top: v3(s.p),
    width: r3(s.x.width),
    treads: Math.round(s.p[1] / s.x.rise) - 1,
    rise: r3(s.x.rise),
    going: r3(s.x.going),
    slopeDeg: r3((Math.atan2(s.x.rise, s.x.going) * 180) / Math.PI),
    evidence: ev('ilustrativo', 'docs/scenario-additions.md (A1)'),
  })
  for (const side of [-1, 1]) {
    const z = s.p[2] + side * s.x.railOffset
    rails.push({ id: `planchada_escalera_baranda${side < 0 ? 'N' : 'S'}`, partId: 'sk575_planchada', origin: 'adicion', a: v3([s.p[0], s.p[1], z]), b: v3([bottom[0], bottom[1], z]), height: r3(s.x.railHeight), evidence: ev('ilustrativo', 'docs/scenario-additions.md (A1)') })
  }
  const r = anchor('anchor_rail_rampa')
  const rv = ramps[0]
  expect(Math.abs(r.p[0] - rv.top[0]) < 0.05 && Math.abs(r.p[1] - rv.top[1]) < 0.05 && Math.abs(r.x.endX - rv.bottom[0]) < 0.05 && Math.abs(r.x.endY - rv.bottom[1]) < 0.05, 'adiciones: la baranda no sigue la rampa medida')
  for (const side of [-1, 1]) {
    const z = rv.top[2] + side * r.x.halfWidth
    rails.push({ id: `rampa_v_baranda${side < 0 ? 'N' : 'S'}`, partId: 'sk575_planchada', origin: 'adicion', a: v3([r.p[0], r.p[1], z]), b: v3([r.x.endX, r.x.endY, z]), height: r3(r.x.railHeight), evidence: ev('documentado', `${DROPS}: PT-4, PLA-2 (existencia); medidas estimadas`) })
  }
  const lb = anchor('anchor_ladder_mastil_bottom')
  const lt = anchor('anchor_ladder_mastil_top')
  expect(Math.abs(lb.p[1] - FLOOR_Y) < 0.02, 'adiciones: la escalera vertical no arranca en el piso de trabajo medido')
  expect(Math.abs(lt.p[1] - board.y) < 0.03, 'adiciones: la escalera vertical no llega al piso de enganche medido')
  for (const [p, y0, y1] of [[lb.p, FLOOR_Y, FLOOR_Y + 1.5], [lt.p, board.y - 1.5, board.y]]) {
    const f = faceX(y0, y1)
    expect(f != null && p[0] - f > 0.05 && p[0] - f < 0.35, `adiciones: la escalera vertical no está frente a la cara del mástil (x=${p[0]}, cara=${f})`)
  }
  ladders.push({ id: 'mastil_escalera', partId: 'sk575_mastil', bottom: v3(lb.p), top: v3(lt.p), facing: r3(lb.x.facing), rungs: lt.x.rungs, origin: 'adicion', evidence: ev('ilustrativo', 'docs/scenario-additions.md (A3); el GLB no tiene escalera de acceso al piso de enganche') })
}

// ================= VÁLVULAS =================
const interactables = []
{
  const man = await load(RIG + 'sk575_manifold.glb')
  // Placas de rótulo (sk575_manifold_blanco): 12 cajas; el texto M1..M12 es geometría, se leyó sobre el GLB
  // renderizado y queda fijado aquí con su posición: si el GLB cambia, falla.
  const LABELS = { M6: [4.524, -11.1], M12: [4.524, -12.229], M4: [5.032, -10.2], M2: [5.591, -10.2], M9: [6.15, -9.8], M7: [6.15, -10.75], M8: [6.15, -11.35], M1: [6.709, -10.2], M3: [7.268, -10.2], M5: [7.777, -11.1], M10: [7.928, -11.779], M11: [7.777, -12.229] }
  const plates = blobs(samples(man.tris, has('sk575_manifold_blanco'), 0, 2, 0.02), 0.05).filter((b) => b.x1 - b.x0 > 0.15)
  expect(plates.length === 12, `manifold: se esperaban 12 rótulos M1–M12, hay ${plates.length}`)
  const wheelPts = samples(man.tris, has('sk575_manifold_acero_oscuro'), 1.2, 1.28, 0.02)
  for (const [label, [x, z]] of Object.entries(LABELS)) {
    const p = plates.find((b) => Math.abs((b.x0 + b.x1) / 2 - x) < 0.06 && Math.abs((b.z0 + b.z1) / 2 - z) < 0.06)
    expect(p, `manifold: no hay rótulo ${label} en (${x}, ${z})`)
    const w = [x, 1.24, z - 0.2] // volante sobre el vástago, 0,2 m detrás del rótulo
    const ring = wheelPts.filter((q) => Math.abs(Math.hypot(q[0] - w[0], q[2] - w[2]) - 0.21) < 0.03).length
    expect(ring > 40, `manifold: no se encontró el volante de ${label} (${ring} puntos en el aro)`)
    interactables.push({ id: `manifold_${label}`, kind: 'valve', partId: 'sk575_manifold', position: v3(w), label: `Válvula ${label} del manifold de ahogo`, sourceId: 'glb:sk575_manifold', evidence: ev('documentado', 'meta del GLB: "Manifold de ahogo M1–M12"; visor docs/references/well-control: "válvulas con volante", volantes Ø≈0,40 m (aproximado)') })
  }
  const acu = await load(RIG + 'sk575_acumulador.glb')
  const groups = new Map()
  for (const n of acu.nodes) {
    const m = /^sk575_acum_(valvula_[a-z0-9_]+?)_(acero|acero_oscuro|rojo)$/.exec(n.getName())
    if (m) groups.set(m[1], [...(groups.get(m[1]) ?? []), n.getName()])
  }
  expect(groups.size === 6, `acumulador: se esperaban 6 válvulas con nombre, hay ${groups.size}`)
  for (const [k, names] of [...groups].sort()) {
    const b = aabb(acu.tris, (t) => names.includes(t.node), -9, 99)
    interactables.push({ id: `acumulador_${k}`, kind: 'valve', partId: 'sk575_acumulador', position: v3([(b.min[0] + b.max[0]) / 2, b.max[1], (b.min[2] + b.max[2]) / 2]), label: `Acumulador: ${k.replace(/_/g, ' ').replace('vias', 'vías')}`, sourceId: 'glb:sk575_acumulador', evidence: ev('ilustrativo', 'meta del GLB: unidad de referencia CPC S/N 4650 (genérica, no es el equipo instalado)') })
  }
}

const out = {
  label: 'escenario ilustrativo añadido por el juego, no as-built',
  generatedBy: 'scripts/extract-traversal.mjs',
  sources,
  replaces: ['sk575_mastil', 'sk575_bop', 'sk575_piletas'],
  stateNote: 'sin state: ninguna fuente documenta estados de las válvulas; el estado existe solo como registro propio del jugador al operar (ilustrativo, no simula flujo ni presión)',
  platforms,
  solids,
  rails,
  stairs,
  ramps,
  ladders,
  interactables,
}
const json = JSON.stringify(out, null, 1) + '\n'
if (process.argv.includes('--check')) {
  const cur = readFileSync(OUT, 'utf8').replace(/\r\n/g, '\n') // checkout con autocrlf
  if (cur !== json) fail(`${OUT} no coincide con lo generado: corré node scripts/extract-traversal.mjs`)
  console.log('traversal.json OK')
} else {
  writeFileSync(OUT, json)
  console.log(`${OUT}: ${platforms.length} plataformas, ${solids.length} sólidos, ${rails.length} barandas, ${stairs.length} escaleras, ${ramps.length} rampas, ${ladders.length} escaleras verticales, ${interactables.length} válvulas`)
}
