// Reglas de evidencia (spec): solo estos 4 estatus; solo confirmed y procedure se presentan como requisito.
export const EVIDENCE = ['confirmed', 'procedure', 'goodPractice', 'pendingValidation'] as const
export type Evidence = (typeof EVIDENCE)[number]

export const isEvidence = (v: unknown): v is Evidence => (EVIDENCE as readonly unknown[]).includes(v)

export const canBePresentedAsRequirement = (e: Evidence): boolean => e === 'confirmed' || e === 'procedure'

export const EVIDENCE_LABEL: Record<Evidence, string> = {
  confirmed: 'Confirmado',
  procedure: 'Procedimiento',
  goodPractice: 'Buena práctica',
  pendingValidation: 'Pendiente de validación',
}

/** Leyenda fija de toda ficha. */
export const LEYENDA = 'referencia digital, no as-built / ilustrativo'

// Palabras prohibidas en la UI (spec). "certificad[oa]s?" cubre el plural de los textos del Libro.
const FORBIDDEN = /aprobad[oa]s?|habilitad[oa]s?|certificad[oa]s?|[áa]rea segura|zonas? de exclusi[óo]n/i

export const containsForbiddenUiWord = (text: string): boolean => FORBIDDEN.test(text)

/**
 * Los textos del procedimiento dicen p. ej. "grillete certificado" (verificar que tenga certificación).
 * Se reformula sin la palabra prohibida conservando el sentido; si queda alguna otra, falla (no se muestra).
 */
export const RIG_NAME = 'EXERTION 01'
// `1[0]`: el nombre anterior tampoco queda literal en el bundle (mismo recurso que la marca, abajo)
export const OLD_RIG_NAME = /\b(?:tacker|tkr|equipo)[\s_-]*1[0]\b/gi

export function uiSafe(text: string): string {
  const out = text
    // marca comercial: no se muestra (el JSON vendorizado queda literal). `K[o]omey` para que la marca tampoco quede
    // literal en el bundle; en el build el plugin scrub-brand (vite.config.ts) ya la quitó de los JSON vendorizados.
    .replace(/\s*\(K[o]omey\)/gi, '')
    .replace(/\bK[o]omey\b/gi, 'acumulador')
    // nombre anterior del equipo (los JSON vendorizados lo traen): en pantalla va el actual
    .replace(OLD_RIG_NAME, RIG_NAME)
    .replace(/\bcertificados? vigentes?\b/gi, 'certificación vigente')
    .replace(/\bcertificad[oa]s?\b/gi, 'con certificación')
  if (containsForbiddenUiWord(out)) throw new Error(`texto con palabra prohibida en UI: "${out}"`)
  return out
}
