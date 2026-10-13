// Pure figures for the power gauges under the Kamehameha: no `$`, no state.

import { compact } from './kame'
import { gaugeColorOf, paletteOf } from './palettes'
import type { Palette } from './palettes'

/** One rate-limit window as the band keeps it. */
export type Limit = { kind: string; percentUsed: number; resetsAt?: string }

/** How long each known window runs, so the band can mark where time stands in it. */
const WINDOW_MS: Record<string, number> = {
  five_hour: 5 * 3600_000,
  seven_day: 7 * 24 * 3600_000,
}

/** THEME names: Stamina is the 5h window, Training the 7d one. */
export function limitLabel(kind: string): string {
  if (kind === 'five_hour') return 'STAMINA 5h'
  if (kind === 'seven_day') return 'TRAINING 7d'
  if (kind === 'spend_limit') return 'SPEND'
  return kind.replace(/_/g, ' ').toUpperCase().slice(0, 11)
}

/** Short label for the hint line under the prompt. */
export function limitShort(kind: string): string {
  if (kind === 'five_hour') return '5h'
  if (kind === 'seven_day') return '7d'
  if (kind === 'spend_limit') return '$'
  return kind.slice(0, 3)
}

/** 2h13m, 4d3h, 12m, <1m. */
export function spanText(ms: number): string {
  const m = Math.max(0, Math.round(ms / 60_000))
  if (m < 1) return '<1m'
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 48) return `${h}h${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d${h % 24}h`
}

/** Where a window stands: time left, how much of it has gone by, and whether usage will outrun it. */
export type Pace = {
  /** Milliseconds until it resets; undefined without `resetsAt`. */
  leftMs?: number
  /** 0..1 of the window's time gone by; undefined for a window of unknown length. */
  elapsed?: number
  /** Milliseconds until it hits 100% at the rate so far, when that comes before the reset. */
  emptyInMs?: number
}

export function paceOf(limit: Limit, now: number): Pace {
  const out: Pace = {}
  const resets = limit.resetsAt === undefined ? NaN : Date.parse(limit.resetsAt)
  if (Number.isNaN(resets)) return out
  const leftMs = Math.max(0, resets - now)
  out.leftMs = leftMs
  const length = WINDOW_MS[limit.kind]
  if (length === undefined) return out
  const usedMs = Math.max(0, length - leftMs)
  out.elapsed = Math.min(1, usedMs / length)
  // Too early in the window to judge a rate: say nothing rather than guess.
  if (out.elapsed < 0.02 || limit.percentUsed <= 0 || limit.percentUsed >= 100) return out
  const perMs = limit.percentUsed / usedMs
  const toFull = (100 - limit.percentUsed) / perMs
  if (toFull < leftMs) out.emptyInMs = toFull
  return out
}

/** The detail after a window's percent: reset time and pace; warnings in the palette's `danger`. */
export function paceText(limit: Limit, pace: Pace, p: Palette = paletteOf(undefined)): { text: string; color?: string } {
  if (limit.percentUsed >= 100) {
    return {
      text: pace.leftMs === undefined ? 'out of stamina' : `out · back in ${spanText(pace.leftMs)}`,
      color: p.danger,
    }
  }
  const resets = pace.leftMs === undefined ? '' : `resets ${spanText(pace.leftMs)}`
  if (pace.emptyInMs !== undefined) {
    return { text: `${resets} · runs out in ${spanText(pace.emptyInMs)}!`, color: p.danger }
  }
  if (pace.elapsed !== undefined && pace.elapsed >= 0.02 && limit.percentUsed > 0) {
    return { text: `${resets} · on pace ✓` }
  }
  return { text: resets }
}

/**
 * A gauge: `fill` cells, then `empty`. With `marker` (0..1, where time stands in
 * the window) one empty or filled cell becomes `│` so usage and time can be compared.
 */
export function gauge(
  percent: number | undefined,
  width: number,
  marker?: number,
): { fill: string; mark: string; markAt: number; empty: string } {
  const filled = percent === undefined ? 0 : Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  const markAt = marker === undefined ? -1 : Math.min(width - 1, Math.max(0, Math.round(marker * width) - 1))
  return { fill: '█'.repeat(filled), mark: markAt >= 0 ? '│' : '', markAt, empty: '░'.repeat(width - filled) }
}

/** Gauge color for a limit: same rule as Ki, and red as soon as the pace says it runs out. */
export function limitColor(p: Palette, percent: number, pace: Pace): string {
  return pace.emptyInMs !== undefined ? p.danger : gaugeColorOf(p, percent)
}

/** Cache hits as a whole percent of the input tokens, or undefined before any. */
export function cachePercent(read: number, total: number): number | undefined {
  return total > 0 ? Math.round((read / total) * 100) : undefined
}

/** `▰▰▰▱▱▱` for the hint line under the prompt. */
export function miniBar(percent: number, width = 6): string {
  const filled = Math.round((Math.min(100, Math.max(0, percent)) / 100) * width)
  return '▰'.repeat(filled) + '▱'.repeat(width - filled)
}

export function usd(n: number): string {
  return n >= 100 ? `$${Math.round(n)}` : `$${n.toFixed(2)}`
}

export { compact }
