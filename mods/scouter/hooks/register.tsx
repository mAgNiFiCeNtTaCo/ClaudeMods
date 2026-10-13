import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionRateLimit, Timer } from 'claude-code'

import type { ScouterBattle, ScouterCategory, ScouterLimit, ScouterSnapshot, ScouterStamina } from '../types'
import { clockTime, commas, duration, gauge, money, pct, short } from './format'
import { gaugeColorOf, paletteOf } from './palettes'

const PANE = 'scouter'
const TITLE = 'Scouter'
const EDITORS = new Set(['Edit', 'Write', 'NotebookEdit', 'MultiEdit'])
const STAMINA_LEVELS = [90, 80]
const TICK_MS = 30_000
const OVER_9000 = 9000

const EMPTY_BATTLE: ScouterBattle = { attacks: 0, techniques: 0, failed: 0, tools: {}, edited: [] }

const isOpen = atom({ plugin: 'scouter', key: 'isOpen' } as const, false)
const autoTried = atom({ plugin: 'scouter', key: 'autoTried' } as const, false)
const model = atom({ plugin: 'scouter', key: 'model' } as const, null)
const power = atom({ plugin: 'scouter', key: 'power' } as const, 0)
const over9000 = atom({ plugin: 'scouter', key: 'over9000' } as const, false)
const battle = atom({ plugin: 'scouter', key: 'battle' } as const, EMPTY_BATTLE)
const snapshot = atom({ plugin: 'scouter', key: 'snapshot' } as const, null)
const breakdown = atom({ plugin: 'scouter', key: 'breakdown' } as const, null)
const stamina = atom({ plugin: 'scouter', key: 'stamina' } as const, null)
const now = atom({ plugin: 'scouter', key: 'now' } as const, 0)

type Dollar = EngineInterface

// Module-level on purpose: a reload re-runs the module, dropping these with the timers they guard.
let ticker: Timer | null = null
let viewport: { isFullscreen?: boolean } = {}

/** Keeps the clock in state fresh while the pane is open, so "resets in" and the session time move. */
function ensureTicker($: Dollar): void {
  if (ticker !== null) return
  ticker = $.clock.every(TICK_MS, () => void tick($))
}

async function tick($: Dollar): Promise<void> {
  if (!(await read($, isOpen))) return
  const t = await $.clock.now()
  await update($, now, () => t)
}

/** Reads the usage figures (and the breakdown when asked) into state. Never called while drawing. */
async function refreshUsage($: Dollar, withBreakdown: boolean): Promise<void> {
  const u = await $.session.usage(withBreakdown ? { breakdown: 'summary' } : undefined)
  const snap: ScouterSnapshot = {
    startedAt: typeof u.startedAt === 'number' ? u.startedAt : null,
    contextTokens: u.context.tokens ?? null,
    contextWindow: u.context.window ?? null,
    contextPercent: u.context.percent ?? null,
    rateLimits: u.rateLimits.map(toLimit),
    costUsd: u.cost?.usd ?? null,
  }
  await update($, snapshot, () => snap)
  if (withBreakdown && u.context.breakdown !== undefined) {
    const rows: ScouterCategory[] = u.context.breakdown.categories
      .filter(c => c.kind !== 'deferred' && c.tokens > 0)
      .map(c => ({ name: c.name, tokens: c.tokens, kind: c.kind }))
    await update($, breakdown, () => rows)
  }
  const t = await $.clock.now()
  await update($, now, () => t)
}

async function refreshModel($: Dollar): Promise<void> {
  const name = await $.session.model()
  if (typeof name === 'string' && name !== '') await update($, model, () => name)
}

/** Toasts once per threshold per 5h window: `Stamina 90%! Rest until 3:40 PM`. */
async function checkStamina($: Dollar, limits: readonly SessionRateLimit[]): Promise<void> {
  const five = limits.find(l => l.kind === 'five_hour')
  if (five === undefined) return
  const window = five.resetsAt ?? 'unknown'
  let due: number | undefined
  await update($, stamina, (was: ScouterStamina | null) => {
    const fired = was !== null && sameWindow(was.resetsAt, window) ? was.fired : []
    due = STAMINA_LEVELS.find(level => five.percentUsed >= level && !fired.includes(level))
    if (due === undefined) return was !== null && sameWindow(was.resetsAt, window) ? was : { resetsAt: window, fired }
    const level = due
    return { resetsAt: window, fired: [...fired, ...STAMINA_LEVELS.filter(l => l <= level && !fired.includes(l))] }
  })
  if (due !== undefined) {
    $.ui.toast(`Stamina ${due}%! Rest until ${clockTime(five.resetsAt)}`, { timeoutMs: 8000 })
  }
}

async function openPane($: Dollar, withBreakdown: boolean): Promise<{ isPlaced: boolean; reason: string }> {
  const opened = await $.ui.open({ id: PANE, title: TITLE })
  if (!opened.isPlaced) return { isPlaced: false, reason: opened.reason }
  await update($, isOpen, () => true)
  await refreshUsage($, withBreakdown)
  return { isPlaced: true, reason: '' }
}

async function closePane($: Dollar): Promise<void> {
  await $.ui.close({ id: PANE })
  await update($, isOpen, () => false)
}

/** Opens unasked only where the pane docks as a sidebar (fullscreen), once per session. */
async function tryAutoOpen($: Dollar, triesLeft: number, withBreakdown: boolean): Promise<void> {
  if (await read($, autoTried)) return
  if (viewport.isFullscreen === undefined && triesLeft > 0) {
    $.clock.after(1000, () => void tryAutoOpen($, triesLeft - 1, withBreakdown))
    return
  }
  await update($, autoTried, () => true)
  if (viewport.isFullscreen !== true) return
  const opened = await openPane($, withBreakdown)
  // Unasked, the engine places a pane only from 144 columns; below that it would wait and pop up later.
  if (!opened.isPlaced) await $.ui.close({ id: PANE })
}

export const register: Register = (on, options) => {
  const over9000Toast = options.over9000Toast !== false
  const staminaAlerts = options.staminaAlerts !== false
  const showBreakdown = options.showBreakdown !== false
  const autoOpen = options.autoOpen === true
  const p = paletteOf(options.palette)

  on('session.start', async ($, e, next) => {
    await $.command.register({
      name: 'scouter',
      description: 'Toggle the Scouter pane: power level, ki, stamina, zeni and the battle log',
    })
    ensureTicker($)
    await refreshUsage($, false)
    await refreshModel($)
    if (autoOpen) $.clock.after(500, () => void tryAutoOpen($, 10, showBreakdown))
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    // /clear starts the session over: a new power level, a new battle log, a new 9000.
    if (e.reason === 'clear') {
      await update($, power, () => 0)
      await update($, over9000, () => false)
      await update($, battle, () => EMPTY_BATTLE)
      await update($, stamina, () => null)
      await update($, breakdown, () => null)
    }
    return next(e)
  })

  on('command.run', { command: 'scouter' }, async $ => {
    ensureTicker($)
    const panes = await $.ui.panes()
    if (panes.some(pane => pane.id === PANE)) {
      await closePane($)
      return { text: 'Scouter off.' }
    }
    const opened = await openPane($, showBreakdown)
    return { text: opened.isPlaced ? 'Scouter on.' : `The scouter could not be shown: ${opened.reason}` }
  })

  on('ui.close', { id: PANE }, async ($, e, next) => {
    const closed = await next(e)
    await update($, isOpen, () => false)
    return closed
  }).catch(($, e, next) => next(e))

  on('session.measure', async ($, e, next) => {
    const measured = await next(e)
    ensureTicker($)
    const wantBreakdown = showBreakdown && e.changed.includes('context') && (await read($, isOpen))
    await refreshUsage($, wantBreakdown)
    if (staminaAlerts && e.changed.includes('rateLimits')) await checkStamina($, e.rateLimits)
    return measured
  })

  on('turn.complete', async ($, e, next) => {
    const done = await next(e)
    ensureTicker($)
    const u = e.usage
    if (u !== undefined) {
      const add = u.input_tokens + u.output_tokens + u.cache_read_input_tokens + u.cache_creation_input_tokens
      const total = await update($, power, n => n + add)
      let isFirst = false
      await update($, over9000, was => {
        isFirst = !was && total > OVER_9000
        return was || total > OVER_9000
      })
      if (isFirst && over9000Toast) $.ui.toast("IT'S OVER 9000!!!", { timeoutMs: 6000 })
    }
    if (e.agentId === undefined) {
      await update($, battle, b => ({ ...b, attacks: b.attacks + 1 }))
      await refreshModel($)
    }
    return done
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    const tool = String(e.tool)
    const args = e as unknown as Record<string, unknown>
    const path = typeof args.file_path === 'string' ? args.file_path : typeof args.notebook_path === 'string' ? args.notebook_path : undefined
    const hasFailed = ran.deny !== undefined || ran.isError === true
    await update($, battle, b => ({
      attacks: b.attacks,
      techniques: b.techniques + 1,
      failed: b.failed + (hasFailed ? 1 : 0),
      tools: { ...b.tools, [tool]: (b.tools[tool] ?? 0) + 1 },
      edited:
        EDITORS.has(tool) && !hasFailed && path !== undefined && !b.edited.includes(path)
          ? [...b.edited, path].slice(-500)
          : b.edited,
    }))
    return ran
  }).catch(($, e, next) => next(e))

  if (autoOpen) {
    // Only reads the layout for tryAutoOpen; the opening itself runs from a timer, never here.
    on('ui.render', { component: 'PromptHint' }, ($, e, next) => {
      if (e.surface === 'terminal' && e.viewport?.isFullscreen !== undefined) {
        viewport = { isFullscreen: e.viewport.isFullscreen }
      }
      return next(e)
    })
  }

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const inner = Math.max(12, e.props.bodyColumns - 4)
    const barWidth = Math.min(inner, 40)

    const name = await read($, model)
    const level = await read($, power)
    const fight = await read($, battle)
    const snap = await read($, snapshot)
    const rows = showBreakdown ? await read($, breakdown) : null
    const time = await read($, now)

    const heading = (text: string) => (
      <Text bold color={p.heading}>
        ⚡ {text}
      </Text>
    )
    const line = (text: string, dim = false) => (
      <Text color={p.readout} dimColor={dim}>
        {text}
      </Text>
    )
    const meter = (percent: number | null) =>
      percent === null ? (
        <Text dimColor>{gauge(0, barWidth)}</Text>
      ) : (
        <Text color={gaugeColorOf(p, percent)}>{gauge(percent, barWidth)}</Text>
      )
    const pair = (left: string, right: string) => (
      <Box flexDirection="row" justifyContent="space-between" width={inner}>
        <Text color={p.readout} dimColor>
          {left}
        </Text>
        <Text color={p.readout}>{right}</Text>
      </Box>
    )

    // KI
    const ctxTokens = snap?.contextTokens ?? null
    const ctxWindow = snap?.contextWindow ?? null
    const ctxPercent = snap?.contextPercent ?? (ctxTokens !== null && ctxWindow ? (ctxTokens / ctxWindow) * 100 : null)
    const kiText = `${ctxTokens === null ? '--' : short(ctxTokens)} / ${ctxWindow ? short(ctxWindow) : '--'} (${ctxPercent === null ? '--' : pct(Math.round(ctxPercent))})`

    // STAMINA / TRAINING / SPEND
    const limits = snap?.rateLimits ?? []
    const windowBlock = (title: string, limit: ScouterLimit | undefined) => (
      <Box flexDirection="column" marginTop={1}>
        {heading(title)}
        {limit === undefined ? (
          line('--', true)
        ) : (
          <Box flexDirection="column">
            {meter(limit.percentUsed)}
            {line(`${pct(limit.percentUsed)}${resetsIn(limit.resetsAt, time)}`)}
          </Box>
        )}
      </Box>
    )
    const spend = limits.find(l => l.kind === 'spend_limit')

    // ZENI
    const cost = snap?.costUsd ?? null
    const perAttack = cost !== null && fight.attacks > 0 ? `${money(cost / fight.attacks)} per attack` : '-- per attack'

    // BATTLE LOG
    const top = Object.entries(fight.tools)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([tool, count]) => `${tool} ×${count}`)
      .join(' · ')
    const since = snap?.startedAt ?? null
    const elapsed = since !== null && time > 0 ? duration(time - since) : '--'
    const isOver = level > OVER_9000

    return (
      <Box flexDirection="column" borderStyle="round" borderColor={p.frame} paddingX={1}>
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text bold color={p.heading}>
            {`◢ SCOUTER ◣ · ${p.label}`}
          </Text>
          <Text color={p.readout}>Model {name ?? '--'}</Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          {heading('POWER LEVEL')}
          <Text bold color={isOver ? p.danger : p.readout}>
            {commas(level)}
          </Text>
          {isOver && <Text color={p.danger}>IT'S OVER 9000!!!</Text>}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          {heading('KI (context)')}
          {meter(ctxPercent)}
          {line(kiText)}
          {rows !== null && rows.length > 0 && (
            <Box flexDirection="column">{rows.map(row => pair(row.name, short(row.tokens)))}</Box>
          )}
        </Box>

        {windowBlock('STAMINA (5h)', limits.find(l => l.kind === 'five_hour'))}
        {windowBlock('TRAINING (7d)', limits.find(l => l.kind === 'seven_day'))}
        {spend !== undefined && windowBlock('SPEND LIMIT', spend)}

        <Box flexDirection="column" marginTop={1}>
          {heading('ZENI')}
          {line(`Zeni ${cost === null ? '--' : money(cost)}`)}
          {line(perAttack, true)}
        </Box>

        <Box flexDirection="column" marginTop={1}>
          {heading('BATTLE LOG')}
          {line(`Time ${elapsed} · Attacks ${fight.attacks}`)}
          {line(`Techniques ${fight.techniques}${top === '' ? '' : `: ${top}`}`)}
          {line(`Files edited ${fight.edited.length} · Failed ${fight.failed}`, fight.failed === 0)}
        </Box>

        <Box flexDirection="row" columnGap={1} marginTop={1}>
          <Button key="refresh" label="Refresh" onPress={() => refreshUsage($, showBreakdown)} />
          <Button key="close" label="Close" role="dismiss" onPress={() => closePane($)} />
        </Box>
      </Box>
    )
  })
}

function toLimit(l: SessionRateLimit): ScouterLimit {
  return l.resetsAt === undefined
    ? { kind: l.kind, percentUsed: l.percentUsed }
    : { kind: l.kind, percentUsed: l.percentUsed, resetsAt: l.resetsAt }
}

/** Two readings of `resetsAt` name the same window when they lie within half an hour. */
function sameWindow(a: string, b: string): boolean {
  if (a === b) return true
  const x = Date.parse(a)
  const y = Date.parse(b)
  return !Number.isNaN(x) && !Number.isNaN(y) && Math.abs(x - y) < 30 * 60_000
}

function resetsIn(resetsAt: string | undefined, nowMs: number): string {
  const at = resetsAt === undefined ? NaN : Date.parse(resetsAt)
  if (Number.isNaN(at) || nowMs <= 0) return ''
  return ` · resets in ${duration(at - nowMs)}`
}
