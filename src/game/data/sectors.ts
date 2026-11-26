import layoutJson from '../../../vendor/visor/layout_locacion.json' with { type: 'json' }
import viewpointsJson from '../../../vendor/visor/viewpoints.json' with { type: 'json' }

export type Vec3 = [number, number, number]
export type Floor = 'terreno' | 'pisoTrabajo' | 'pisoEnganche'
export type FichaViewpoint = { funcion: string; riesgos: string; EPP: string; controles: string }
export type Footprint = { minX: number; maxX: number; minZ: number; maxZ: number }

type Viewpoint = {
  id: string
  nombre: string
  objeto3D: string[]
  piso: Floor
  camPos?: number[]
  target?: number[]
  ficha: FichaViewpoint
}
type ViewpointsFile = { pisos: Record<string, { cota: number }>; viewpoints: Viewpoint[] }
type LayoutFile = Record<string, number[]>

export interface Sector {
  id: string
  name: string
  /** null = sin posición documentada (no se inventa). */
  position: Vec3 | null
  positionSource: 'viewpoint.target' | 'viewpoint.camPos' | null
  floor: Floor
  /** ids de piezas 3D del visor (vacío = sin objeto, p. ej. Acceso). */
  objectIds: string[]
  /** Huella del layout de locación en el marco del juego (null si el layout no la trae). */
  footprint: Footprint | null
  ficha: FichaViewpoint
}

// sector -> clave de layout_locacion.json (asociación por nombre; el layout no cita ids de sector).
const LAYOUT_KEY: Record<string, string> = {
  acumulador: 'acumulador',
  bomba: 'bomba',
  piletas: 'pileta',
  planchada: 'planchada',
  carrier: 'equipo',
}

const isVec3 = (v: unknown): v is number[] => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)

/**
 * Posición del sector, solo desde datos documentados del visor (marco V2 = marco del juego):
 * con objeto 3D -> `target` del viewpoint (el equipo que mira la cámara); sin objeto (Acceso) -> `camPos`, el punto
 * donde el recorrido del visor se para. Y = cota del piso del viewpoint. Sin dato válido -> null.
 */
export function buildSectors(vp: ViewpointsFile, layout: LayoutFile): Sector[] {
  return vp.viewpoints.map((v) => {
    const cota = vp.pisos[v.piso]?.cota ?? 0
    const [src, source] = v.objeto3D?.length
      ? ([v.target, 'viewpoint.target'] as const)
      : ([v.camPos, 'viewpoint.camPos'] as const)
    const ok = isVec3(src)
    const box = layout[LAYOUT_KEY[v.id]]
    return {
      id: v.id,
      name: v.nombre,
      position: ok ? [src[0], cota, src[2]] : null,
      positionSource: ok ? source : null,
      floor: v.piso,
      objectIds: v.objeto3D ?? [],
      // layout_locacion.json viene con Z invertido respecto de los GLB (verificado contra los bounds renderizados).
      footprint:
        Array.isArray(box) && box.length === 4 ? { minX: box[0], maxX: box[1], minZ: -box[3], maxZ: -box[2] } : null,
      ficha: v.ficha,
    }
  })
}

let cache: Sector[] | null = null
export const getSectors = (): Sector[] => (cache ??= buildSectors(viewpointsJson as never, layoutJson))
export const getSector = (id: string): Sector | undefined => getSectors().find((s) => s.id === id)

/** Posición real del Acceso (camPos del viewpoint "acceso"): el jugador y la camioneta aparecen aquí. */
export const ACCESO_POSITION: Vec3 = (() => {
  const p = getSector('acceso')?.position
  if (!p) throw new Error('viewpoints.json sin posición documentada para "acceso"')
  return p
})()
