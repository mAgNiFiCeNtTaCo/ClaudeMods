import type { SaiyanUsage } from '../types'

/** Transformation tiers by Ki (context fill), lowest first. */
export const TIERS = [
  { short: 'Base', name: 'Base', min: 0 },
  { short: 'Kaioken', name: 'Kaioken', min: 25 },
  { short: 'SSJ', name: 'Super Saiyan', min: 50 },
  { short: 'SSJ2', name: 'Super Saiyan 2', min: 70 },
  { short: 'SSJ3', name: 'Super Saiyan 3', min: 85 },
  { short: 'Limit Breaker', name: 'Limit Breaker', min: 95 },
] as const

export const LIMIT_BREAKER = TIERS.length - 1
export const SENZU_READY_AT = 85
export const AUTO_SENZU_AT = 92
export const STAMINA_LEVELS = [80, 90] as const

/** The tier index for a Ki percent: the highest tier whose minimum it reaches. */
export function tierOf(ki: number): number {
  let tier = 0
  for (let i = 0; i < TIERS.length; i++) {
    if (ki >= TIERS[i]!.min) tier = i
  }
  return tier
}

export function pct(value: number | null | undefined): string {
  return value === null || value === undefined ? '--' : `${Math.round(value)}%`
}

/** "2h13m", "45m", "0m" until the ISO time; null when it cannot be read. */
export function timeLeft(resetsAt: string | null, now: number): string | null {
  if (!resetsAt) return null
  const at = Date.parse(resetsAt)
  if (Number.isNaN(at)) return null
  const minutes = Math.max(0, Math.round((at - now) / 60000))
  const h = Math.floor(minutes / 60)
  const m = minutes % 60
  return h > 0 ? `${h}h${String(m).padStart(2, '0')}m` : `${m}m`
}

/** "3:40 PM" in local time; null when it cannot be read. */
export function clockTime(resetsAt: string | null): string | null {
  if (!resetsAt) return null
  const at = new Date(resetsAt)
  if (Number.isNaN(at.getTime())) return null
  try {
    return at.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  } catch {
    const h = at.getHours()
    return `${h % 12 || 12}:${String(at.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
  }
}

/** "146k" for token counts. */
export function tokens(n: number): string {
  return Math.abs(n) >= 1000 ? `${Math.round(n / 1000)}k` : `${n}`
}

/** `⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24` */
export function statusText(usage: SaiyanUsage, now: number): string {
  const tier = usage.ki === null ? '--' : TIERS[tierOf(usage.ki)]!.short
  const parts = [`⚡ ${tier}`, `Ki ${pct(usage.ki)}`]
  if (usage.stamina !== null) {
    const left = timeLeft(usage.resetsAt, now)
    parts.push(`Stamina ${pct(usage.stamina)}${left ? ` (${left})` : ''}`)
  }
  parts.push(`Zeni ${usage.zeni === null ? '--' : `$${usage.zeni.toFixed(2)}`}`)
  return parts.join(' · ')
}

/** The toast for a tier change, or null when the tier stayed. */
export function transformText(from: number, to: number, ki: number, senzuOn: boolean): string | null {
  if (to === from) return null
  if (to < from) return `Powered down to ${TIERS[to]!.name}. Ki ${pct(ki)}`
  if (to === LIMIT_BREAKER) {
    return `LIMIT BREAKER! Ki ${pct(ki)}${senzuOn ? ': eat a Senzu Bean (/senzu)' : ''}`
  }
  if (to === 1) return `Goku used the Kaioken! (Ki ${pct(ki)})`
  return `Goku went ${TIERS[to]!.name}! (Ki ${pct(ki)})`
}
