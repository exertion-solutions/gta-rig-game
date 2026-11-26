import { buildFicha } from '../game/data/ficha'

const cache = new Map<string, string>()
/** Nombre para mostrar: siempre el saneado de la ficha (Sector.name es crudo y puede traer una marca comercial). */
export const sectorLabel = (id: string): string => {
  let v = cache.get(id)
  if (v === undefined) cache.set(id, (v = buildFicha(id).name))
  return v
}
