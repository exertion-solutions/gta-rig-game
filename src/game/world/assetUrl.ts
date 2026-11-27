// Rutas de assets bajo la base del build (import.meta.env.BASE_URL: './' por defecto o BASE_PATH): un solo lugar.
export const assetUrl = (path: string) => `${import.meta.env.BASE_URL}${path}`
export const rigUrl = (glb: string) => assetUrl(`models/rig10/${glb}`)
export const DRACO_PATH = assetUrl('decoders/draco/')
