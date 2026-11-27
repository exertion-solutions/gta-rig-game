import { Component, type ReactNode } from 'react'

type Props = { name: string; fallback?: ReactNode; onError?: (e: Error) => void; children?: ReactNode }

/** Si un hijo lanza (shader que no compila, chunk que no baja), se muestra `fallback` (o nada) y el resto sigue. */
export class ErrorBoundary extends Component<Props, { failed: boolean }> {
  state = { failed: false }
  static getDerivedStateFromError() {
    return { failed: true }
  }
  componentDidCatch(e: Error) {
    console.warn(`[${this.props.name}] desactivado por error:`, e)
    this.props.onError?.(e)
  }
  render() {
    return this.state.failed ? (this.props.fallback ?? null) : this.props.children
  }
}
