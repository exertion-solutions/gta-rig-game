// @vitest-environment node
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../../src/app/ErrorBoundary'
import { createGovernor, pickInitialQuality, type Quality } from '../../src/game/quality'

describe('pickInitialQuality (por string del renderer)', () => {
  it('GPU integrada o desconocida arranca en medium', () => {
    for (const r of [
      'ANGLE (Intel, Intel(R) Iris(R) Xe Graphics (0x000046A6) Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (Intel, Intel(R) UHD Graphics 620, D3D11)',
      'Mali-G78',
      'Apple GPU',
      'ANGLE (NVIDIA, NVIDIA GeForce MX550 Direct3D11 vs_5_0 ps_5_0, D3D11)', // dedicada pero de gama muy baja
      'Google SwiftShader',
      '',
      null,
    ])
      expect(pickInitialQuality(r), String(r)).toBe('medium')
  })
  it('GPU dedicada potente (RTX/GTX/Radeon RX) permite high', () => {
    for (const r of [
      'ANGLE (NVIDIA, NVIDIA GeForce RTX 3060 Laptop GPU Direct3D11 vs_5_0 ps_5_0, D3D11)',
      'ANGLE (NVIDIA, NVIDIA GeForce GTX 1650 Direct3D11, D3D11)',
      'ANGLE (AMD, AMD Radeon RX 6600 Direct3D11, D3D11)',
    ])
      expect(pickInitialQuality(r), r).toBe('high')
  })
})

describe('governor: degradación rápida y semilla', () => {
  it('con menos de 30 fps sostenidos baja en ~30 cuadros, sin esperar la ventana de 90', () => {
    const g = createGovernor('high', { warmup: 0 })
    let got: Quality | null = null
    let n = 0
    while (!got && n < 90) {
      got = g.push(40)
      n++
    }
    expect(got).toBe('medium')
    expect(n).toBeLessThanOrEqual(30)
  })
  it('un tirón corto (10 cuadros lentos) no baja', () => {
    const g = createGovernor('high', { warmup: 0 })
    for (let i = 0; i < 10; i++) expect(g.push(60)).toBeNull()
    for (let i = 0; i < 40; i++) expect(g.push(12)).toBeNull()
  })
  it('seed() cambia el nivel sin desactivar la automática', () => {
    const g = createGovernor('high', { warmup: 0 })
    g.seed('medium')
    expect(g.quality).toBe('medium')
    expect(g.auto).toBe(true)
  })
})

describe('ErrorBoundary', () => {
  it('si un hijo lanza pasa a fallback, anota en consola y llama onError', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const onError = vi.fn()
    const b = new ErrorBoundary({ name: 'Post', fallback: 'degradado', onError, children: 'ok' })
    expect(b.render()).toBe('ok')
    b.state = ErrorBoundary.getDerivedStateFromError()
    b.componentDidCatch(new Error('shader roto'))
    expect(b.render()).toBe('degradado')
    expect(onError).toHaveBeenCalledOnce()
    expect(warn.mock.calls.flat().join(' ')).toContain('Post')
    warn.mockRestore()
  })
  it('sin fallback renderiza nada', () => {
    const b = new ErrorBoundary({ name: 'x', children: 'ok' })
    b.state = { failed: true }
    expect(b.render()).toBeNull()
  })
})
