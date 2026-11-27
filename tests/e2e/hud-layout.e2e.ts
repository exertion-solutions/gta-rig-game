import { expect, test, type Page } from '@playwright/test'
import { settle, waitFrames } from './wait'

// QA A D-04 / QA B P0-7, P1-5: a ningún tamaño se superponen radar, tarjetas, leyenda, ficha, botón y chip de sector;
// sin scroll horizontal; todo texto del HUD >= 12 px y con contraste WCAG >= 4,5:1 sobre el fondo más claro detrás
// (el cielo #9fc3e8: los fondos del HUD son translúcidos). El panel modal (M) tapa todo por diseño y no entra.
const VIEWPORTS = [
  [1920, 1080],
  [1366, 768],
  [1280, 720],
  [768, 1024],
  [390, 844],
] as const
const IDS = ['radar', 'hud-mission', 'hud-visited', 'legend', 'hud-ficha', 'open-missions', 'audio-mute', 'hud-radio', 'hud-sector', 'hud-limit', 'interact-prompt']
// subtítulo de radio del largo máximo (radio.ts corta en 150 caracteres)
const LONG_SUBTITLE = 'Texto de prueba del subtítulo de la radio con el largo máximo que admite el corte por oraciones, para medir el lugar que ocupa en pantalla sin taparse.'.slice(0, 150)
const SKY = '#9fc3e8'
type Rect = { id: string; x: number; y: number; w: number; h: number }

const g = (page: Page, fn: string, ...a: unknown[]) => page.evaluate(([f, args]) => (window as any).__game[f as string](...(args as unknown[])), [fn, a] as const)

async function rects(page: Page): Promise<Rect[]> {
  return page.evaluate((ids) => {
    const hud = document.querySelector('[data-testid="hud"]')!
    return ids.flatMap((id) => {
      // el aviso central (E subir/operar/soltar) vive fuera del contenedor del HUD
      const el = id === 'interact-prompt' ? document.querySelector('[data-testid="interact-prompt"]') : hud.querySelector(`[data-testid="${id}"]`)
      if (!el) return []
      const r = el.getBoundingClientRect()
      return r.width > 1 && r.height > 1 ? [{ id, x: r.x, y: r.y, w: r.width, h: r.height }] : []
    })
  }, IDS)
}

function expectNoOverlap(rs: Rect[], vw: number, vh: number, state: string) {
  for (const r of rs)
    expect(r.x >= 0 && r.y >= 0 && r.x + r.w <= vw + 0.5 && r.y + r.h <= vh + 0.5, `${state}: ${r.id} fuera de la pantalla ${JSON.stringify(r)}`).toBe(true)
  for (let i = 0; i < rs.length; i++)
    for (let j = i + 1; j < rs.length; j++) {
      const a = rs[i]
      const b = rs[j]
      const hit = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5
      expect(hit, `${state}: ${a.id} se superpone con ${b.id} (${JSON.stringify(a)} / ${JSON.stringify(b)})`).toBe(false)
    }
}

/** Texto visible del HUD y del aviso: tamaño de fuente y contraste contra el fondo compuesto sobre `backdrop`. */
async function textAudit(page: Page, backdrop: string) {
  return page.evaluate((bd) => {
    const cv = document.createElement('canvas')
    cv.width = cv.height = 1
    const ctx = cv.getContext('2d', { willReadFrequently: true })!
    const rgba = (c: string): [number, number, number, number] => {
      ctx.clearRect(0, 0, 1, 1)
      ctx.fillStyle = '#000'
      ctx.fillStyle = c
      ctx.fillRect(0, 0, 1, 1)
      const d = ctx.getImageData(0, 0, 1, 1).data
      return [d[0], d[1], d[2], d[3] / 255]
    }
    const over = (top: number[], under: number[]) => [0, 1, 2].map((i) => top[i] * top[3] + under[i] * (1 - top[3]))
    const lum = (c: number[]) => {
      const f = (v: number) => ((v /= 255) <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)
      return 0.2126 * f(c[0]) + 0.7152 * f(c[1]) + 0.0722 * f(c[2])
    }
    const out: { text: string; size: number; ratio: number }[] = []
    const roots = [...document.querySelectorAll('[data-testid="hud"], [data-testid="interact-prompt"]')]
    for (const root of roots)
      for (const el of [root as HTMLElement, ...root.querySelectorAll<HTMLElement>('*')]) {
        const own = [...el.childNodes]
          .filter((n) => n.nodeType === 3 && n.textContent!.trim())
          .map((n) => n.textContent!.trim())
          .join(' ')
        if (!own) continue
        const r = el.getBoundingClientRect()
        if (r.width <= 1 || r.height <= 1) continue // sr-only y ocultos
        const cs = getComputedStyle(el)
        if (cs.visibility === 'hidden' || cs.opacity === '0') continue
        // fondo: el cielo y encima cada ancestro con fondo, de afuera hacia adentro
        const chain: HTMLElement[] = []
        for (let a: HTMLElement | null = el; a; a = a.parentElement) chain.unshift(a)
        let bg = rgba(bd).slice(0, 3)
        for (const a of chain) {
          const c = rgba(getComputedStyle(a).backgroundColor)
          if (c[3] > 0) bg = over(c, bg)
        }
        const fg = over(rgba(cs.color), bg)
        const [l1, l2] = [lum(fg), lum(bg)].sort((x, y) => y - x)
        out.push({ text: own.slice(0, 40), size: parseFloat(cs.fontSize), ratio: (l1 + 0.05) / (l2 + 0.05) })
      }
    return out
  }, backdrop)
}

async function audit(page: Page, vw: number, vh: number, state: string) {
  await waitFrames(page, 3)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), `${state}: scroll horizontal`).toBe(true)
  expectNoOverlap(await rects(page), vw, vh, state)
  const texts = await textAudit(page, SKY)
  expect(texts.length).toBeGreaterThan(3)
  for (const t of texts) {
    expect(t.size, `${state}: "${t.text}" en ${t.size} px`).toBeGreaterThanOrEqual(12)
    expect(t.ratio, `${state}: "${t.text}" contraste ${t.ratio.toFixed(2)}`).toBeGreaterThanOrEqual(4.5)
  }
}

for (const [vw, vh] of VIEWPORTS)
  test(`HUD ${vw}x${vh}: sin superposiciones, sin scroll horizontal, texto >= 12 px y contraste >= 4,5:1`, async ({ page }) => {
    await page.setViewportSize({ width: vw, height: vh })
    await page.goto('/')
    await page.waitForFunction(() => {
      const w = (window as any).__game
      return w?.getMission && w.teleport && w.teleportTruck && w.renderedBounds('sk575_mastil')
    }, null, { timeout: 90_000 })
    await settle(page)
    await page.waitForFunction(() => (window as any).__game.getAtSector() === 'acceso')
    await audit(page, vw, vh, 'reposo')

    // m3: el objetivo 2 trae el texto largo de la zona (~400 caracteres); se recorta con "ver más"
    // radio congelada: el subtítulo queda en pantalla durante toda la medición (sin depender del reloj)
    await g(page, 'holdRadio', true)
    await g(page, 'startMission', 'm3-mapa-de-zonas')
    await expect(page.getByTestId('hud-radio')).toBeVisible()
    await g(page, 'showSubtitle', LONG_SUBTITLE)
    await g(page, 'teleport', [-10, 0, 20])
    await page.waitForFunction(() => (window as any).__game.getAtSector() === null)
    await g(page, 'teleport', [-3, 0, 3.5])
    await page.waitForFunction(() => (window as any).__game.getMission().objectiveIndex === 1)
    await expect(page.getByTestId('hud-sector')).toBeVisible()
    await audit(page, vw, vh, 'misión 3')
    await page.getByTestId('hud-objective-more').click()
    await audit(page, vw, vh, 'misión 3 con "ver más"')
    await page.getByTestId('hud-objective-more').click()

    await page.keyboard.press('KeyF') // ficha del mástil (la más larga)
    await expect(page.getByTestId('hud-ficha')).toBeVisible()
    await audit(page, vw, vh, 'misión 3 + ficha')
    await page.keyboard.press('Escape') // Esc también cierra la ficha
    await expect(page.getByTestId('hud-ficha')).toHaveCount(0)

    // aviso de la camioneta al alcance
    await g(page, 'teleportTruck', [-10, 0, 20], 0)
    await g(page, 'teleport', [-10, 0, 21.5])
    await expect(page.getByTestId('interact-prompt')).toBeVisible()
    await audit(page, vw, vh, 'aviso de camioneta')

    // contra el vallado del borde: aviso "Límite de la locación"
    await g(page, 'setYaw', -Math.PI / 2)
    await g(page, 'teleport', [32.5, 0, 10])
    await g(page, 'setInput', { x: 0, z: 1, run: true })
    await expect(page.getByTestId('hud-limit')).toBeVisible()
    await audit(page, vw, vh, 'límite de la locación')
    await g(page, 'setInput', null)
  })
