// Pure figures and glyphs for the Kamehameha band: no `$`, no state. Colors come from ./palettes.

import type { Palette } from './palettes'

export const CHANT = ['Ka...', 'Me...', 'Ha...', 'Me...', 'HA...!!']
export const BALLS = ['.', 'o', 'O', '◎', '◉']
/** Width of the whole chant plus its trailing space, so the bar does not jump as it grows. */
export const CHANT_WIDTH = CHANT.join(' ').length + 1

/** A turn has no true percent: it never shows more than this until it completes. */
export const CAP = 0.95
/** How long the beam (or the fizzle) holds after a turn. */
export const FIRE_MS = 4000

/** Charge from time and activity: 45 s of time constant, each tool call and model step a bump. */
export function chargeOf(elapsedMs: number, techniques: number, steps: number): number {
  const x = Math.max(0, elapsedMs) / 45000 + 0.08 * techniques + 0.04 * steps
  return Math.min(CAP, 1 - Math.exp(-x))
}

/** 0..4, one per chant word, 20% each. */
export function stageOf(charge: number): number {
  return Math.max(0, Math.min(4, Math.floor(charge * 5)))
}

export function chantOf(stage: number): string {
  return CHANT.slice(0, stage + 1).join(' ')
}

/** m:ss, or h:mm:ss past an hour. */
export function clockText(ms: number): string {
  const total = Math.max(0, Math.floor(ms / 1000))
  const h = Math.floor(total / 3600)
  const m = Math.floor((total % 3600) / 60)
  const s = String(total % 60).padStart(2, '0')
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`
}

/** 950, 23.4k, 126k, 1.2M. */
export function compact(n: number): string {
  if (n < 1000) return String(Math.round(n))
  if (n < 100_000) return `${trim((n / 1000).toFixed(1))}k`
  if (n < 1_000_000) return `${Math.round(n / 1000)}k`
  return `${trim((n / 1_000_000).toFixed(1))}M`
}

function trim(fixed: string): string {
  return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed
}

export function plural(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? '' : 's'}`
}

/** The palette's `ki` at no charge, toward its `beam` as the bar fills. */
export function chargeColor(p: Palette, charge: number): string {
  return mix(p.ki, p.beam, Math.min(1, charge * charge))
}

function mix(from: string, to: string, t: number): string {
  const a = parseInt(from.slice(1), 16)
  const b = parseInt(to.slice(1), 16)
  const channel = (shift: number) => {
    const x = (a >> shift) & 255
    const y = (b >> shift) & 255
    return Math.round(x + (y - x) * t)
  }
  const n = (channel(16) << 16) | (channel(8) << 8) | channel(0)
  return `#${n.toString(16).padStart(6, '0')}`
}

/** The partial cells at the head of the charge, cycled by frame for the shimmer. */
const HEADS = ['▒░', '▒▒', '▓▒', '▒▒']

/**
 * The charging bar in three parts: the filled cells (with a travelling glint
 * when animated), the shimmering head, and the empty rest.
 */
export function chargeBar(
  charge: number,
  width: number,
  frame: number,
  isAnimated: boolean,
): { before: string; glint: string; after: string; head: string; empty: string } {
  const filled = Math.min(width, Math.floor(charge * width))
  const headWidth = Math.min(2, width - filled)
  const head = (isAnimated ? HEADS[frame % HEADS.length]! : '▒▒').slice(0, headWidth)
  const empty = '░'.repeat(Math.max(0, width - filled - headWidth))
  if (!isAnimated || filled < 3) {
    return { before: '▓'.repeat(filled), glint: '', after: '', head, empty }
  }
  const at = frame % filled
  return {
    before: '▓'.repeat(at),
    glint: '█',
    after: '▓'.repeat(filled - at - 1),
    head,
    empty,
  }
}

/** The Ki gauge: `fill` in the gauge's color, `empty` dim. No reading: all empty. */
export function kiBar(percent: number | undefined, width: number): { fill: string; empty: string } {
  const filled = percent === undefined ? 0 : Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return { fill: '█'.repeat(filled), empty: '░'.repeat(width - filled) }
}

/** Ki as a whole percent from the engine's figures, or undefined before any reading. */
export function kiPercent(ki: { tokens?: number; window?: number; percent?: number }): number | undefined {
  if (ki.percent !== undefined) return Math.round(ki.percent)
  if (ki.tokens !== undefined && ki.window) return Math.round((ki.tokens / ki.window) * 100)
  return undefined
}

/** A tool's name for the band: `mcp__server__tool` shortens to `tool`. */
export function toolName(tool: string): string {
  const parts = tool.split('__')
  return tool.startsWith('mcp__') && parts.length >= 3 ? parts.slice(2).join('__') : tool
}
