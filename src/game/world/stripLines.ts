import type * as THREE from 'three'

// Los GLB traen aristas LINES horneadas (28 grados); el juego las descarta.
export function stripLines(root: THREE.Object3D): number {
  const lines: THREE.Object3D[] = []
  root.traverse((o) => {
    if ((o as THREE.Line).isLine) lines.push(o) // Line, LineSegments y LineLoop
  })
  for (const l of lines) {
    const ln = l as THREE.Line
    ln.geometry.dispose()
    ;(Array.isArray(ln.material) ? ln.material : [ln.material]).forEach((m) => m.dispose())
    l.removeFromParent()
  }
  return lines.length
}
