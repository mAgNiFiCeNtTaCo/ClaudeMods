import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit } from 'claude-code'

import type { SaiyanAutoSenzu, SaiyanStaminaWarned, SaiyanUsage } from '../types'
import {
  AUTO_SENZU_AT,
  SENZU_READY_AT,
  STAMINA_LEVELS,
  clockTime,
  pct,
  statusText,
  tierOf,
  tokens,
  transformText,
} from './logic'

type Toggles = {
  statusLine: boolean
  transformToasts: boolean
  senzu: boolean
  autoSenzu: boolean
  staminaWarnings: boolean
}

const NO_USAGE: SaiyanUsage = { ki: null, stamina: null, resetsAt: null, zeni: null }

const usage = atom({ plugin: 'saiyan-status', key: 'usage' } as const, NO_USAGE)
const lastTier = atom({ plugin: 'saiyan-status', key: 'lastTier' } as const, null)
const senzuOffered = atom({ plugin: 'saiyan-status', key: 'senzuOffered' } as const, false)
const autoSenzu = atom({ plugin: 'saiyan-status', key: 'autoSenzu' } as const, 'armed')
const staminaWarned = atom({ plugin: 'saiyan-status', key: 'staminaWarned' } as const, {
  resetsAt: '',
  levels: [],
})

// Lives exactly as long as this module's environment: a reload drops the
// minute timer too, so the next event sets both up again.
let readying: Promise<void> | null = null

function ready($: EngineInterface, isOn: Toggles): Promise<void> {
  readying ??= setUp($, isOn).catch(error => {
    readying = null // try again on the next event
    throw error
  })
  return readying
}

async function setUp($: EngineInterface, isOn: Toggles) {
  if (isOn.senzu) {
    await $.command.register({
      name: 'senzu',
      description: 'Eat a Senzu Bean: compact the conversation and restore your Ki',
    })
  }
  // Keeps the "(2h13m)" countdown honest between measurements.
  if (isOn.statusLine) $.clock.every(60_000, () => void showStatus($, isOn))
}

async function showStatus($: EngineInterface, isOn: Toggles) {
  if (!isOn.statusLine) return
  const now = await $.clock.now()
  $.ui.status(statusText(await read($, usage), now))
}

function fromEngine(e: {
  context: { percent?: number }
  rateLimits: readonly SessionRateLimit[]
  cost?: { usd: number }
}): SaiyanUsage {
  const five = e.rateLimits.find(limit => limit.kind === 'five_hour')
  return {
    ki: e.context.percent ?? null,
    stamina: five ? five.percentUsed : null,
    resetsAt: five?.resetsAt ?? null,
    zeni: e.cost ? e.cost.usd : null,
  }
}

function toastAll($: EngineInterface, lines: string[]) {
  // One toast per event: a plugin's newer toast replaces its own on the bar.
  if (lines.length > 0) $.ui.toast(lines.join('  ·  '), { timeoutMs: 6000 })
}

/** Tier changes, the Senzu offer and Auto Senzu's arming for one Ki reading. */
async function onKi($: EngineInterface, isOn: Toggles, ki: number, lines: string[]) {
  const tier = tierOf(ki)
  const before = await read($, lastTier)
  if (before !== null && isOn.transformToasts) {
    const text = transformText(before, tier, ki, isOn.senzu)
    if (text) lines.push(text)
  }
  if (before !== tier) await update($, lastTier, () => tier)

  if (ki < SENZU_READY_AT) {
    if (await read($, senzuOffered)) await update($, senzuOffered, () => false)
  } else if (isOn.senzu && !(await read($, senzuOffered))) {
    await update($, senzuOffered, () => true)
    lines.push(`Ki at ${SENZU_READY_AT}%: a Senzu Bean is ready (/senzu)`)
  }

  const auto = await read($, autoSenzu)
  let next: SaiyanAutoSenzu = auto
  if (ki < AUTO_SENZU_AT) next = 'armed'
  else if (isOn.autoSenzu && auto === 'armed') next = 'pending'
  if (next !== auto) await update($, autoSenzu, () => next)
}

async function onStamina($: EngineInterface, isOn: Toggles, figures: SaiyanUsage, lines: string[]) {
  if (!isOn.staminaWarnings || figures.stamina === null) return
  const used = figures.stamina
  const window = figures.resetsAt ?? ''
  const warned = await read($, staminaWarned)
  const levels = warned.resetsAt === window ? warned.levels : []
  const crossed = STAMINA_LEVELS.filter(level => used >= level && !levels.includes(level))
  if (crossed.length === 0) {
    if (warned.resetsAt !== window) await update($, staminaWarned, () => ({ resetsAt: window, levels }))
    return
  }
  const now: SaiyanStaminaWarned = { resetsAt: window, levels: [...levels, ...crossed] }
  await update($, staminaWarned, () => now)
  const until = clockTime(figures.resetsAt)
  lines.push(`Stamina ${pct(used)}! ${until ? `Rest until ${until}` : 'Rest up'}`)
}

/**
 * Compacts, then says how it went: a toast, and a notice row in the
 * transcript (the model never reads it). A failed auto Senzu stays quiet and
 * is tried again after the next turn.
 */
async function eatSenzu($: EngineInterface, isOn: Toggles, label: string, isAsked: boolean) {
  const before = await $.session.usage()
  let result
  try {
    result = await $.session.compact()
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    if (isAsked) $.ui.toast(`Couldn't eat the Senzu Bean: ${why}`)
    return
  }
  if (result.skip !== undefined) {
    if (isAsked) $.ui.toast(`The Senzu Bean was knocked away: ${result.skip}`)
    return
  }
  const window = before.context.window
  const after =
    result.tokensAfter !== undefined && window > 0
      ? Math.round((result.tokensAfter / window) * 100)
      : null
  const freed =
    result.tokensBefore !== undefined && result.tokensAfter !== undefined
      ? ` (freed ${tokens(result.tokensBefore - result.tokensAfter)})`
      : ''
  const text = `${label}! Ki ${pct(before.context.percent)} → ${pct(after)}${freed}`

  await update($, autoSenzu, () => 'spent')
  await update($, usage, figures => ({ ...figures, ki: after }))
  const lines = [text]
  if (after !== null) await onKi($, isOn, after, lines)
  toastAll($, lines)
  await showStatus($, isOn)
  try {
    await $.session.append({ message: { type: 'system', content: [{ type: 'text', text }] } })
  } catch {
    // The toast already said it; a session that takes no notice row is fine.
  }
}

/**
 * The engine refuses a compaction under a hook that holds the turn (a command
 * running, a turn ending), so the bean is eaten just after it lets go.
 */
function senzuLater($: EngineInterface, isOn: Toggles, label: string, isAsked: boolean) {
  $.clock.after(150, () => void eatSenzu($, isOn, label, isAsked))
}

export const register: Register = (on, options) => {
  const isOn: Toggles = {
    statusLine: options.statusLine !== false,
    transformToasts: options.transformToasts !== false,
    senzu: options.senzu !== false,
    autoSenzu: options.autoSenzu === true,
    staminaWarnings: options.staminaWarnings === true,
  }
  readying = null

  on('session.start', async ($, e, next) => {
    await ready($, isOn)
    const figures = fromEngine(await $.session.usage())
    await update($, usage, () => figures)
    if (figures.ki !== null) await update($, lastTier, () => tierOf(figures.ki!))
    await showStatus($, isOn)
    return next(e)
  })

  on('session.measure', async ($, e, next) => {
    await ready($, isOn)
    const figures = fromEngine(e)
    await update($, usage, () => figures)
    const lines: string[] = []
    if (figures.ki !== null) await onKi($, isOn, figures.ki, lines)
    await onStamina($, isOn, figures, lines)
    toastAll($, lines)
    await showStatus($, isOn)
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    await ready($, isOn)

    if (isOn.autoSenzu && (await read($, autoSenzu)) === 'pending') {
      senzuLater($, isOn, 'Auto Senzu', false)
    }

    if (isOn.statusLine) {
      const figures = fromEngine(await $.session.usage())
      await update($, usage, () => figures)
      await showStatus($, isOn)
    }
    return next(e)
  })

  on('command.run', { command: 'senzu' }, async $ => {
    if (!isOn.senzu) return { text: 'Senzu Beans are switched off (saiyan-status: senzu).' }
    const { context } = await $.session.usage()
    senzuLater($, isOn, 'Ate a Senzu Bean', true)
    return { text: `Eating a Senzu Bean... (Ki ${pct(context.percent)})` }
  })
}
