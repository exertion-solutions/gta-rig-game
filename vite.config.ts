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
    return { code: code.replace(/\s*\(Koomey\)/gi, '').replace(/\bKoomey\b/gi, 'acumulador'), map: null }
  },
}

export default defineConfig({
  // './' (relativo) sirve bajo cualquier sub-ruta; BASE_PATH fija una absoluta (npm run build:pages => /gta-rig-game/).
  base: process.env.BASE_PATH ?? './',
  plugins: [react(), tailwindcss(), scrubBrand],
  test: { include: ['tests/**/*.test.ts?(x)'] },
})
