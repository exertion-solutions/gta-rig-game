import type { MissionDef } from '../game/missions/types'

export type Line = { id: string; text: string }

// Frases de enlace del instructor: genéricas, sin contenido técnico. Todo lo técnico sale literal de la misión
// (briefing y objetivos, que ya pasan por uiSafe y por el filtro del motor).
export const LINK_LINES = {
  inicio: { id: 'radio/inicio', text: 'Instructor en línea. Te paso la consigna.' },
  completada: { id: 'radio/completada', text: 'Misión completada. Tu registro queda en el panel de misiones.' },
} satisfies Record<string, Line>

/** Líneas de una misión en el orden en que suenan: enlace, briefing, objetivos 2..n (el 1.º lo cubre el briefing), cierre. */
export const missionLines = (def: MissionDef): Line[] => [
  LINK_LINES.inicio,
  { id: `${def.id}/briefing`, text: def.briefing },
  ...def.objectives.slice(1).map((o) => ({ id: `${def.id}/${o.id}`, text: o.text })),
  LINK_LINES.completada,
]

/** Ids de todas las líneas (para los archivos de voz opcionales public/audio/voice/<id>.mp3). */
export const lineIds = (defs: MissionDef[]) => [...new Set(defs.flatMap(missionLines).map((l) => l.id))]

const MAX = 150 // caracteres por subtítulo

/** Corta el texto en subtítulos: oraciones agrupadas hasta MAX; una oración más larga se corta por palabras. */
export function splitSubtitles(text: string, max = MAX): string[] {
  const words = (s: string) => {
    const out: string[] = []
    let cur = ''
    for (const w of s.split(/\s+/)) {
      if (cur && cur.length + 1 + w.length > max) out.push(cur), (cur = w)
      else cur = cur ? `${cur} ${w}` : w
    }
    return cur ? [...out, cur] : out
  }
  const out: string[] = []
  for (const s of text.trim().split(/(?<=[.!?:;])\s+/).flatMap(words)) {
    const last = out.at(-1)
    if (last && last.length + 1 + s.length <= max) out[out.length - 1] = `${last} ${s}`
    else out.push(s)
  }
  return out
}

/** Tiempo de lectura de un subtítulo (ms) cuando no hay voz grabada. */
export const readMs = (text: string) => Math.min(9000, Math.max(2000, 1200 + 55 * text.length))

/** Hash FNV-1a (hex) del texto: el manifest de voces lo guarda; si el texto cambia, esa voz ya no se usa. */
export function lineHash(text: string): string {
  let h = 0x811c9dc5
  for (const ch of text) {
    h ^= ch.codePointAt(0)!
    h = Math.imul(h, 0x01000193) >>> 0
  }
  return h.toString(16).padStart(8, '0')
}

/** Entrada del manifest (scripts/gen-voice.mjs): `duration` en segundos; el resto es informativo (texto, sha256). */
export type VoiceEntry = { file: string; hash: string; duration?: number; text?: string; sha256?: string }
export type VoiceManifest = Record<string, VoiceEntry>

/** Duración (ms) de la voz de la línea, si el manifest la trae y es vigente; null = tiempo de lectura. */
export const voiceMs = (line: Line, manifest: VoiceManifest): number | null => {
  const d = voiceFile(line, manifest) && manifest[line.id].duration
  return typeof d === 'number' && d > 0 ? d * 1000 : null
}

/** Reparte la duración de la voz entre los subtítulos en proporción a su largo (suman exactamente `totalMs`). */
export function chunkTimes(chunks: string[], totalMs: number): number[] {
  const len = chunks.reduce((a, c) => a + c.length, 0) || 1
  return chunks.map((c) => (totalMs * c.length) / len)
}

/** Archivo de voz de la línea: solo si el manifest la lista y su hash coincide con el texto actual (si no, null: subtítulos). */
export const voiceFile = (line: Line, manifest: VoiceManifest): string | null => {
  const v = manifest[line.id]
  return v && v.hash === lineHash(line.text) ? v.file : null
}

/** Cola de líneas: `current` es la que suena; una línea ya en cola no se repite. */
export function createRadioQueue() {
  let q: Line[] = []
  return {
    current: (): Line | null => q[0] ?? null,
    push(lines: Line[]) {
      for (const l of lines) if (!q.some((x) => x.id === l.id)) q.push(l)
    },
    next: (): Line | null => (q.shift(), q[0] ?? null),
    clear: () => void (q = []),
  }
}
