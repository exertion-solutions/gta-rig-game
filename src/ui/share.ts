import type { MissionDef, ObjectiveResult } from '../game/missions/types'

/** Marca de agua de toda imagen que sale del juego (foto y tarjeta). */
export const WATERMARK = 'Referencia digital, ilustrativo'

/** `?mision=m3` -> 'm3' (solo letras, números y guiones; cualquier otra cosa se ignora). */
export function parseMissionParam(search: string): string | null {
  const v = new URLSearchParams(search).get('mision')
  return v && /^[a-z0-9-]{1,40}$/i.test(v) ? v : null
}

/** 'm3' -> id completo ('m3-...') entre las misiones disponibles; el id exacto también vale. */
export const resolveMissionId = (ids: string[], q: string) => ids.find((id) => id === q) ?? ids.find((id) => id.startsWith(`${q}-`)) ?? null

/** Enlace a una misión: misma página con ?mision=<corto> (parte del id antes del primer guion). */
export function missionLink(href: string, missionId: string): string {
  const u = new URL(href)
  u.search = ''
  u.hash = ''
  u.searchParams.set('mision', missionId.split('-')[0])
  return u.toString()
}

/** Texto de la tarjeta de misión completada: registro propio, sin calificar al jugador. */
export function cardLines(def: MissionDef, results: Record<string, ObjectiveResult>): { title: string; lines: string[] } {
  const lines = def.summary?.(results) ?? []
  return { title: def.title, lines: [`${def.objectives.length} de ${def.objectives.length} objetivos cumplidos`, ...lines] }
}

function wrap(ctx: CanvasRenderingContext2D, text: string, maxW: number): string[] {
  const out: string[] = []
  let cur = ''
  for (const w of text.split(/\s+/)) {
    const next = cur ? `${cur} ${w}` : w
    if (cur && ctx.measureText(next).width > maxW) {
      out.push(cur)
      cur = w
    } else cur = next
  }
  return cur ? [...out, cur] : out
}

export function drawWatermark(ctx: CanvasRenderingContext2D, w: number, h: number) {
  const px = Math.max(12, Math.round(h / 45))
  ctx.font = `600 ${px}px system-ui, sans-serif`
  ctx.textAlign = 'right'
  ctx.textBaseline = 'bottom'
  ctx.lineWidth = Math.max(2, px / 5)
  ctx.strokeStyle = 'rgba(0,0,0,0.7)'
  ctx.fillStyle = 'rgba(255,255,255,0.92)'
  ctx.strokeText(WATERMARK, w - px, h - px * 0.8)
  ctx.fillText(WATERMARK, w - px, h - px * 0.8)
}

const toPng = (c: HTMLCanvasElement) => new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error('sin imagen'))), 'image/png'))

/** Foto del canvas del juego + marca de agua, como PNG. Copia el canvas en forma síncrona (ver PhotoCapture). */
export function photoBlob(src: HTMLCanvasElement): Promise<Blob> {
  const c = document.createElement('canvas')
  c.width = src.width
  c.height = src.height
  const ctx = c.getContext('2d')!
  ctx.drawImage(src, 0, 0)
  drawWatermark(ctx, c.width, c.height)
  return toPng(c)
}

/** Tarjeta de misión completada de 1200x630 (tamaño de vista previa estándar), solo texto. */
export function cardBlob(def: MissionDef, results: Record<string, ObjectiveResult>): Promise<Blob> {
  const W = 1200
  const H = 630
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')!
  ctx.fillStyle = '#14181c'
  ctx.fillRect(0, 0, W, H)
  ctx.fillStyle = '#fbbf24'
  ctx.fillRect(0, 0, 14, H)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'alphabetic'
  ctx.font = '600 28px ui-monospace, monospace'
  ctx.fillText('MISIÓN COMPLETADA', 70, 100)
  const { title, lines } = cardLines(def, results)
  ctx.fillStyle = '#f1f5f9'
  ctx.font = '700 60px system-ui, sans-serif'
  let y = 185
  for (const l of wrap(ctx, title, W - 140)) {
    ctx.fillText(l, 70, y)
    y += 68
  }
  ctx.fillStyle = '#cbd5e1'
  ctx.font = '400 32px system-ui, sans-serif'
  y += 20
  for (const l of lines.flatMap((t) => wrap(ctx, t, W - 140))) {
    if (y > H - 90) break
    ctx.fillText(l, 70, y)
    y += 46
  }
  drawWatermark(ctx, W, H)
  return toPng(c)
}

export function downloadBlob(blob: Blob, name: string) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(a.href), 10_000)
}
