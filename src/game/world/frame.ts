// Marco del mundo: 1 unidad = 1 m, Y arriba, origen = boca de pozo a nivel de terreno,
// +X hacia el mástil, carrier hacia -X (vendor/visor/viewpoints.json: "marco").
// locacion.min/max = [-45,-30.5] / [33.5,30.5] => X abarca 78.5 m (-45..33.5) y Z 61 m (-30.5..30.5).
// Confirmado: el largo 78.5 va en X y el ancho 61 en Z. El signo lateral (Z) del equipo NO está
// verificado contra los GLB; la huella es simétrica en Z, así que no afecta este límite.
export const LOCACION_M = { x: 78.5, z: 61 }
export const LOCACION_BOUNDS = { minX: -45, maxX: 33.5, minZ: -30.5, maxZ: 30.5 }

export type RigRole = 'collide' | 'scenery' | 'walkable'

// 'scenery' = sin colisión (incluye vientos y tiros). El carrier puede ganar hull más adelante.
const part = (name: string, role: RigRole) => ({
  id: `sk575_${name}`,
  glb: `sk575_${name}.glb`,
  role,
})

export const RIG_PARTS: readonly { id: string; glb: string; role: RigRole }[] = [
  part('mastil', 'collide'),
  part('piletas', 'collide'),
  part('bop', 'collide'),
  part('carrier', 'collide'),
  part('planchada', 'walkable'),
  part('piso', 'walkable'),
  part('acumulador', 'scenery'),
  part('manifold', 'scenery'),
  part('llave', 'scenery'),
  part('bomba', 'scenery'),
  part('cuadro', 'scenery'),
  part('izaje', 'scenery'),
  part('aparejo', 'scenery'),
  part('pozo_vecino', 'scenery'),
  part('vientos', 'scenery'),
  part('tiros', 'scenery'),
]
