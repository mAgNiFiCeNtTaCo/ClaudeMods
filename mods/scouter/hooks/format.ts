// Pure helpers for the scouter readout: gauges and number formats. Colors come from ./palettes.

/** A bar `width` cells wide: `█` filled, one `▓▒░` partial, `·` empty. */
export function gauge(percent: number, width: number): string {
  const cells = Math.max(4, Math.floor(width))
  const exact = (Math.min(100, Math.max(0, percent)) / 100) * cells
  const full = Math.floor(exact)
  const rest = exact - full
  const partial = full >= cells ? '' : rest >= 0.75 ? '▓' : rest >= 0.5 ? '▒' : rest >= 0.25 ? '░' : ''
  return '█'.repeat(full) + partial + '·'.repeat(cells - full - partial.length)
}

/** 1234567 -> "1,234,567". */
export function commas(n: number): string {
  return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',')
}

/** Token counts the way /context shows them: 950, 12.3k, 126k, 1.2M. */
export function short(n: number): string {
  if (n >= 1_000_000) return `${trim(n / 1_000_000)}M`
  if (n >= 10_000) return `${Math.round(n / 1000)}k`
  if (n >= 1000) return `${trim(n / 1000)}k`
  return String(Math.round(n))
}

function trim(x: number): string {
  return x.toFixed(1).replace(/\.0$/, '')
}

/** A length of time: "45s", "13m", "2h 13m", "3d 4h". */
export function duration(ms: number): string {
  const s = Math.max(0, Math.floor(ms / 1000))
  if (s < 60) return `${s}s`
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ${String(m % 60).padStart(2, '0')}m`
  return `${Math.floor(h / 24)}d ${h % 24}h`
}

/** An ISO time as a local clock time, "3:40 PM"; "--" when it does not parse. */
export function clockTime(iso: string | undefined): string {
  const at = iso === undefined ? NaN : Date.parse(iso)
  if (Number.isNaN(at)) return '--'
  const d = new Date(at)
  const h = d.getHours()
  return `${h % 12 === 0 ? 12 : h % 12}:${String(d.getMinutes()).padStart(2, '0')} ${h < 12 ? 'AM' : 'PM'}`
}

/** US dollars: "$1.24", "<$0.01" for a sliver. */
export function money(usd: number): string {
  if (usd > 0 && usd < 0.01) return '<$0.01'
  return `$${usd.toFixed(2)}`
}

/** A percentage with at most one decimal: 41, 23.5. */
export function pct(n: number): string {
  return `${Math.round(n * 10) / 10}%`
}
