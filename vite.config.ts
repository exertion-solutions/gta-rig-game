import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import type { Plugin } from 'vite'
import { defineConfig } from 'vitest/config'

// Solo en el build: la marca comercial de los JSON vendorizados no viaja al bundle (en pantalla ya la limpia uiSafe y
// los archivos de vendor/ quedan literales, con su hash). Mismo reemplazo que uiSafe (src/game/data/evidence.ts).
const scrubBrand: Plugin = {
  name: 'scrub-brand',
  apply: 'build',
  enforce: 'pre',
  transform(code, id) {
    if (!/[\\/]vendor[\\/]visor[\\/][^\\/]+\.json$/.test(id)) return null
    return {
      code: code
        .replace(/\s*\(Koomey\)/gi, '')
        .replace(/\bKoomey\b/gi, 'acumulador')
        .replace(/\b(?:tacker|tkr|equipo)[\s_-]*10\b/gi, 'EXERTION 01'), // nombre anterior del equipo
      map: null,
    }
  },
}

// Lo que el arranque siempre pide empieza a bajar en paralelo con el JS (docs/carga.md). Se inyecta aquí, no en
// index.html, para respetar la base (./ o BASE_PATH).
const PRELOAD = [
  'decoders/draco/draco_wasm_wrapper.js',
  'decoders/draco/draco_decoder.wasm',
  'models/rig10/sk575_carrier.glb',
  'models/rig10/sk575_acumulador.glb',
  'models/character/worker.glb',
  'hdri/sky_1k.hdr',
]
const preloadAssets = (base: string): Plugin => ({
  name: 'preload-assets',
  apply: 'build',
  transformIndexHtml: () =>
    PRELOAD.map((p) => ({ tag: 'link', attrs: { rel: 'preload', as: 'fetch', crossorigin: '', href: `${base}${p}` }, injectTo: 'head' as const })),
})

const BASE = process.env.BASE_PATH ?? './'

export default defineConfig({
  // './' (relativo) sirve bajo cualquier sub-ruta; BASE_PATH fija una absoluta (npm run build:pages => /gta-rig-game/).
  base: BASE,
  plugins: [react(), tailwindcss(), scrubBrand, preloadAssets(BASE)],
  build: {
    // Quedan dos chunks > 500 kB y es lo esperado: three (vendor, perezoso, cacheable aparte) y PhysicsScene (≈2 MB de
    // WASM de Rapier en base64, inseparable). Ninguno es del arranque: el inicial pesa ≈ 225 kB (docs/carga.md).
    chunkSizeWarningLimit: 2400,
    rolldownOptions: {
      output: { codeSplitting: { groups: [{ name: 'three', test: /node_modules[\/]three[\/]/ }] } },
    },
  },
  test: { include: ['tests/**/*.test.ts?(x)'] },
})
