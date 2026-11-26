// Convierte docs/secuencia-montaje-tipica.md del visor a JSON. Solo toma la lista numerada de "## Pasos"
// (texto literal); no agrega tiempos, cargas ni distancias. Los pasos 1, 2 y 8 son documentales según la fuente.
const DOCUMENTALES = [1, 2, 8]

export function convertSecuencia(md) {
  const lines = md.split(/\r?\n/)
  const start = lines.findIndex((l) => /^##\s+Pasos\s*$/.test(l))
  if (start < 0) throw new Error('secuencia: no hay sección "## Pasos"')
  const pasos = []
  for (const l of lines.slice(start + 1)) {
    if (/^##\s/.test(l)) break
    const m = /^(\d+)\.\s+(.*\S)\s*$/.exec(l)
    if (m) pasos.push({ orden: Number(m[1]), texto: m[2], documental: DOCUMENTALES.includes(Number(m[1])) })
  }
  if (pasos.length !== 8 || pasos.some((p, i) => p.orden !== i + 1))
    throw new Error(`secuencia: se esperaban 8 pasos consecutivos, hay ${pasos.length}`)
  return {
    version: 1,
    status: 'pendingValidation',
    nota: 'Secuencia típica de montaje de un equipo de workover aportada por el usuario. No es el procedimiento de la empresa ni un requisito de empresa, cliente o legal: validar contra el procedimiento vigente antes de presentarla como requisito. Los pasos 1, 2 y 8 son documentales. No incluye tiempos, cargas ni distancias.',
    pasos,
  }
}
