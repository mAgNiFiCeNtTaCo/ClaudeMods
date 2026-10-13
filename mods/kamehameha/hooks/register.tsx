import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, SessionContextUsage, SessionRateLimit } from 'claude-code'

import type { KamehamehaAttack, KamehamehaKi, KamehamehaLimit, KamehamehaMeters } from '../types'
import { cachePercent, gauge, limitColor, limitLabel, limitShort, miniBar, paceOf, paceText, usd } from './gauges'
import {
  BALLS,
  CHANT_WIDTH,
  FIRE_MS,
  chantOf,
  chargeBar,
  chargeColor,
  chargeOf,
  clockText,
  compact,
  kiPercent,
  plural,
  stageOf,
  toolName,
} from './kame'
import { gaugeColorOf, paletteOf } from './palettes'

const charge = atom({ plugin: 'kamehameha', key: 'charge' } as const, null)
const tick = atom({ plugin: 'kamehameha', key: 'tick' } as const, { frame: 0, now: 0 })
const last = atom({ plugin: 'kamehameha', key: 'last' } as const, null)
const ki = atom({ plugin: 'kamehameha', key: 'ki' } as const, {})
const isHidden = atom({ plugin: 'kamehameha', key: 'isHidden' } as const, false)
const meters = atom({ plugin: 'kamehameha', key: 'meters' } as const, {
  limits: [],
  cacheRead: 0,
  cacheTotal: 0,
  attacks: 0,
  now: 0,
} as KamehamehaMeters)

/** Width of the gauge labels: `TRAINING 7d` and a space. */
const LABEL_WIDTH = 12

/** Room the `[ Hide ]` button takes at the end of the band's last line. */
const HIDE_WIDTH = 24
const SHOUT = '  HAAAAAA!!!'

function kiOf(context: SessionContextUsage): KamehamehaKi {
  const out: KamehamehaKi = { window: context.window }
  if (context.tokens !== undefined) out.tokens = context.tokens
  if (context.percent !== undefined) out.percent = context.percent
  return out
}

// The live timer handle only; a hot reload drops it together with the timer.
let timer: { cancel: () => void } | undefined

function stopTicking() {
  timer?.cancel()
  timer = undefined
}

// Each tick moves the frame (shimmer, beam) and the clock the band reads,
// ends the 4 s fire moment, and stops once there is nothing left to move.
async function onTick($: EngineInterface) {
  const now = await $.clock.now()
  await update($, tick, t => ({ frame: t.frame + 1, now }))
  if ((await read($, charge)) !== null) return
  const attack = await read($, last)
  if (attack !== null && attack.phase !== 'summary') {
    if (now - attack.firedAt < FIRE_MS) return
    await update($, last, a => (a === null ? a : { ...a, phase: 'summary' }))
  }
  stopTicking()
}

function startTicking($: EngineInterface, ms: number) {
  if (timer !== undefined) return
  timer = $.clock.every(ms, () => {
    void onTick($)
  })
}

function limitsOf(rateLimits: readonly SessionRateLimit[]): KamehamehaLimit[] {
  return rateLimits.map(l => {
    const out: KamehamehaLimit = { kind: l.kind, percentUsed: l.percentUsed }
    if (l.resetsAt !== undefined) out.resetsAt = l.resetsAt
    return out
  })
}

async function measureKi($: EngineInterface) {
  const { context, rateLimits, cost } = await $.session.usage()
  const now = await $.clock.now()
  await update($, ki, () => kiOf(context))
  await update($, meters, m => {
    const out: KamehamehaMeters = { ...m, limits: limitsOf(rateLimits), now }
    if (cost !== undefined) out.usd = cost.usd
    return out
  })
}

// The slow clock for the reset countdowns; a hot reload drops it and session.start starts it again.
let minuteTimer: { cancel: () => void } | undefined

export const register: Register = (on, options) => {
  const isAnimated = options.animate !== false
  const showKiGauge = options.showKiGauge !== false
  const showSummary = options.showSummary !== false
  const fireBeam = options.fireBeam !== false
  const tickMs = isAnimated ? 250 : 1000
  const showUsage = options.showUsageGauges !== false
  const showCache = options.showCacheGauge !== false
  const showZeni = options.showZeni !== false
  const zeniBudget = typeof options.zeniBudget === 'number' && options.zeniBudget > 0 ? options.zeniBudget : 0
  const hintBars = options.hintBars !== false
  const p = paletteOf(options.palette)

  on('session.start', async ($, e, next) => {
    try {
      await measureKi($)
    } catch {
      // No reading yet: the gauge shows `--`.
    }
    minuteTimer?.cancel()
    minuteTimer = $.clock.every(60_000, () => {
      void $.clock.now().then(now => update($, meters, m => ({ ...m, now })))
    })
    // A new session (or a reload) always starts with the band showing.
    await update($, isHidden, () => false)
    await $.command.register({
      name: 'gauges',
      description: 'Show or hide the Kamehameha band and its power gauges.',
      immediate: true,
    })
    return next(e)
  })

  on('command.run', { command: 'gauges' }, async $ => {
    const wasHidden = await read($, isHidden)
    await update($, isHidden, () => !wasHidden)
    return {
      text: wasHidden
        ? 'Power gauges are back above the prompt.'
        : 'Power gauges hidden. Type /gauges to bring them back (they also return on your next prompt).',
    }
  })

  on('session.measure', async ($, e, next) => {
    if (e.changed.includes('context')) await update($, ki, () => kiOf(e.context))
    const now = await $.clock.now()
    await update($, meters, m => {
      const out: KamehamehaMeters = { ...m, limits: limitsOf(e.rateLimits), now }
      if (e.cost !== undefined) out.usd = e.cost.usd
      return out
    })
    return next(e)
  })

  on('turn.start', async ($, e, next) => {
    const now = await $.clock.now()
    await update($, charge, () => ({ startedAt: now, techniques: 0, steps: 0, tool: null }))
    await update($, tick, t => ({ frame: t.frame, now }))
    await update($, isHidden, () => false)
    startTicking($, tickMs)
    return next(e)
  })

  // Each model request of the main loop is a small bump of charge.
  on('turn.step', async function* ($, e, next) {
    if (e.agentId === undefined) {
      await update($, charge, c => (c === null ? c : { ...c, steps: c.steps + 1 }))
      startTicking($, tickMs)
    }
    return yield* next(e)
  })

  // Each tool call is a technique, and the bar's latest name.
  on('tool.call', async ($, e, next) => {
    await update($, charge, c =>
      c === null ? c : { ...c, techniques: c.techniques + 1, tool: toolName(String(e.tool)) },
    )
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) return next(e)
    const now = await $.clock.now()
    const charged = await read($, charge)
    const isFizzle = e.reason !== 'answer'
    const attack: KamehamehaAttack = {
      phase: fireBeam ? (isFizzle ? 'fizzle' : 'fire') : 'summary',
      isFizzle,
      firedAt: now,
      durationMs: e.durationMs,
      techniques: charged?.techniques ?? 0,
    }
    const usage = e.usage
    if (usage !== undefined) {
      attack.tokens =
        usage.input_tokens +
        usage.output_tokens +
        (usage.cache_creation_input_tokens ?? 0) +
        (usage.cache_read_input_tokens ?? 0)
      const cacheRead = usage.cache_read_input_tokens ?? 0
      const input = usage.input_tokens + (usage.cache_creation_input_tokens ?? 0) + cacheRead
      await update($, meters, m => ({
        ...m,
        cacheRead: m.cacheRead + cacheRead,
        cacheTotal: m.cacheTotal + input,
        attacks: m.attacks + 1,
      }))
    }
    await update($, last, () => attack)
    await update($, charge, () => null)
    await update($, tick, () => ({ frame: 0, now }))
    if (attack.phase === 'summary') stopTicking()
    else startTicking($, tickMs)
    try {
      await measureKi($)
    } catch {
      // Keep the last reading.
    }
    return next(e)
  })

  // Under the prompt: mini Ki and stamina bars at the end of the engine's own hint line.
  if (hintBars) {
    on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
      const [kiNow, meter] = await Promise.all([read($, ki), read($, meters)])
      const parts: string[] = []
      const kiPct = kiPercent(kiNow)
      if (kiPct !== undefined) parts.push(`KI ${miniBar(kiPct)} ${kiPct}%`)
      for (const limit of meter.limits) {
        const pct = Math.round(limit.percentUsed)
        parts.push(`${limitShort(limit.kind)} ${miniBar(pct)} ${pct}%`)
      }
      if (parts.length === 0) return next(e)
      const tail = `⚡ ${parts.join(' · ')}`
      return next({ ...e, props: { ...e.props, tail: e.props.tail ? `${e.props.tail} ${tail}` : `  ${tail}` } })
    })
  }

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey) return next(e)
    const [charged, clock, attack, kiNow, hidden, meter] = await Promise.all([
      read($, charge),
      read($, tick),
      read($, last),
      read($, ki),
      read($, isHidden),
      read($, meters),
    ])
    if (hidden) return next(e)

    const { Box, Button, Text } = $.ui.resolve(e)
    const cols = Math.max(24, e.props.bodyColumns)
    const kiPct = kiPercent(kiNow)
    const lines: JSX.Element[][] = []

    if (charged !== null) {
      const elapsed = Math.max(0, clock.now - charged.startedAt)
      const ch = chargeOf(elapsed, charged.techniques, charged.steps)
      const stage = stageOf(ch)
      const pct = ` ${String(Math.floor(ch * 100)).padStart(2)}%`
      const stats = `${plural(charged.techniques, 'technique')} · ${clockText(elapsed)}${
        charged.tool === null ? '' : ` · ${charged.tool}`
      }`
      const chant = chantOf(stage)
      const chantWidth = cols >= 70 ? CHANT_WIDTH : chant.length + 1
      const statsWidth = 5 + stats.length
      const isLast = !showKiGauge
      const fixed = chantWidth + 6 + pct.length
      const room = cols - fixed - statsWidth - (isLast ? HIDE_WIDTH : 0)
      const isOneLine = room >= 10
      const barWidth = Math.min(48, Math.max(4, isOneLine ? room : cols - fixed))
      const bar = chargeBar(ch, barWidth, clock.frame, isAnimated)
      const barColor = chargeColor(p, ch)
      const isBright = ch >= 0.6
      const isPulse = isAnimated && clock.frame % 2 === 1

      const head = [
        <Text color={p.heading} bold>
          {chant.padEnd(chantWidth)}
        </Text>,
        <Text color={p.ki}>⊂(</Text>,
        <Text color={isPulse ? p.ki : p.beam} bold>
          {BALLS[stage]}
        </Text>,
        <Text color={p.ki}>{')⊃ '}</Text>,
        bar.before !== '' && (
          <Text color={barColor} bold={isBright}>
            {bar.before}
          </Text>
        ),
        bar.glint !== '' && (
          <Text color={p.beam} bold>
            {bar.glint}
          </Text>
        ),
        bar.after !== '' && (
          <Text color={barColor} bold={isBright}>
            {bar.after}
          </Text>
        ),
        bar.head !== '' && <Text color={p.ki}>{bar.head}</Text>,
        bar.empty !== '' && (
          <Text color={p.ki} dimColor>
            {bar.empty}
          </Text>
        ),
        <Text key="percent" color={p.beam} bold>
          {pct}
        </Text>,
      ].filter((part): part is JSX.Element => part !== false)
      const statParts = [
        <Text color={p.gold}>{isOneLine ? '  ⚡ ' : '⚡ '}</Text>,
        <Text key="stats" dimColor>
          {stats}
        </Text>,
      ]
      if (isOneLine) lines.push([...head, ...statParts])
      else lines.push(head, statParts)
    } else if (attack !== null && attack.phase === 'fire') {
      const isLast = !showKiGauge
      const full = Math.max(4, cols - 6 - 1 - SHOUT.length - (isLast ? HIDE_WIDTH : 0))
      const shot = isAnimated ? Math.min(1, (Math.floor((clock.now - attack.firedAt) / 250) + 1) / 4) : 1
      lines.push([
        <Text color={p.ki}>⊂(</Text>,
        <Text color={p.beam} bold>
          ◉
        </Text>,
        <Text color={p.ki}>)⊃</Text>,
        <Text key="beam" color={p.beam} bold>
          {'═'.repeat(Math.max(1, Math.round(full * shot)))}
        </Text>,
        <Text color={p.ki} bold>
          {'>'}
        </Text>,
        <Text key="shout" color={p.beam} bold>
          {SHOUT}
        </Text>,
      ])
    } else if (attack !== null && attack.phase === 'fizzle') {
      lines.push([
        <Text key="fizzle" dimColor>
          ⊂(·)⊃ ...fizzled
        </Text>,
      ])
    } else if (attack !== null && showSummary) {
      const tokens = attack.tokens === undefined ? '--' : compact(attack.tokens)
      lines.push([
        <Text color={p.heading} bold>
          Last Kamehameha:{' '}
        </Text>,
        <Text key="summary" dimColor>
          {`${attack.isFizzle ? 'fizzled · ' : ''}${clockText(attack.durationMs)} · ${plural(
            attack.techniques,
            'technique',
          )} · ${tokens} tokens · `}
        </Text>,
        kiPct === undefined ? (
          <Text dimColor>Ki --</Text>
        ) : (
          <Text color={gaugeColorOf(p, kiPct)}>Ki {kiPct}%</Text>
        ),
      ])
    }

    // The power gauges: one aligned row per figure the engine has given.
    const width = cols >= 90 ? 24 : cols >= 60 ? 16 : 10
    const label = (text: string) => (
      <Text color={p.heading} bold>
        {text.padEnd(LABEL_WIDTH)}
      </Text>
    )
    // Filled cells in `color`, the rest dim; with a marker, one cell is a gold `│` for where time stands.
    const bar = (percent: number | undefined, color: string, marker?: number): (JSX.Element | false)[] => {
      const g = gauge(percent, width, marker)
      if (g.markAt < 0) {
        return [
          g.fill !== '' && <Text color={color}>{g.fill}</Text>,
          g.empty !== '' && <Text dimColor>{g.empty}</Text>,
        ]
      }
      const cells = g.fill + g.empty
      const part = (from: number, to: number): (JSX.Element | false)[] => {
        const fillEnd = Math.max(from, Math.min(to, g.fill.length))
        return [
          fillEnd > from && <Text color={color}>{cells.slice(from, fillEnd)}</Text>,
          to > fillEnd && <Text dimColor>{cells.slice(fillEnd, to)}</Text>,
        ]
      }
      return [
        ...part(0, g.markAt),
        <Text color={p.gold} bold>
          {g.mark}
        </Text>,
        ...part(g.markAt + 1, width),
      ]
    }
    const clean = (parts: (JSX.Element | false)[]) => parts.filter((p): p is JSX.Element => p !== false)

    if (showKiGauge) {
      const color = kiPct === undefined ? p.ki : gaugeColorOf(p, kiPct)
      const figures =
        kiNow.window === undefined
          ? ''
          : `  (${kiNow.tokens === undefined ? '--' : compact(kiNow.tokens)} / ${compact(kiNow.window)})`
      const senzu = kiPct !== undefined && kiPct >= 85
      lines.push(
        clean([
          label('KI'),
          ...bar(kiPct, color),
          kiPct === undefined ? (
            <Text key="ki" dimColor>
              {' --'}
            </Text>
          ) : (
            <Text key="ki" color={color} bold>
              {` ${kiPct}%`}
            </Text>
          ),
          figures !== '' && <Text dimColor>{figures}</Text>,
          senzu && <Text color={p.danger}>{'  · Senzu Bean time (/compact)'}</Text>,
        ]),
      )
    }

    if (showUsage) {
      for (const limit of meter.limits) {
        const pct = Math.round(limit.percentUsed)
        const pace = paceOf(limit, Math.max(meter.now, clock.now))
        const color = limitColor(p, pct, pace)
        const detail = paceText(limit, pace, p)
        lines.push(
          clean([
            label(limitLabel(limit.kind)),
            ...bar(pct, color, pace.elapsed),
            <Text color={color} bold>
              {` ${pct}%`}
            </Text>,
            detail.text !== '' &&
              (detail.color === undefined ? (
                <Text dimColor>{`  ${detail.text}`}</Text>
              ) : (
                <Text color={detail.color}>{`  ${detail.text}`}</Text>
              )),
          ]),
        )
      }
    }

    if (showCache && meter.cacheTotal > 0) {
      const pct = cachePercent(meter.cacheRead, meter.cacheTotal)
      if (pct !== undefined) {
        const color = pct >= 50 ? p.ki : p.gold
        lines.push(
          clean([
            label('CACHE'),
            ...bar(pct, color),
            <Text color={color} bold>
              {` ${pct}%`}
            </Text>,
            <Text dimColor>{'  of input reused · Instant Transmission'}</Text>,
          ]),
        )
      }
    }

    if (showZeni && meter.usd !== undefined) {
      const perAttack = meter.attacks > 0 ? ` · ${usd(meter.usd / meter.attacks)}/attack` : ''
      if (zeniBudget > 0) {
        const pct = Math.round((meter.usd / zeniBudget) * 100)
        const color = gaugeColorOf(p, pct)
        lines.push(
          clean([
            label('ZENI'),
            ...bar(pct, color),
            <Text color={color} bold>
              {` ${pct}%`}
            </Text>,
            <Text dimColor>{`  ${usd(meter.usd)} of ${usd(zeniBudget)}${perAttack}`}</Text>,
          ]),
        )
      } else {
        lines.push([
          label('ZENI'),
          <Text color={p.gold} bold>
            {usd(meter.usd)}
          </Text>,
          <Text dimColor>{`${perAttack} · this session`}</Text>,
        ])
      }
    }

    if (lines.length === 0) return next(e)

    // Another mod's band beneath (Shenron's coil) stays, drawn above the gauges.
    const below = await next(e)

    return (
      <Box flexDirection="column">
        {!isEmptyTree(below) && below}
        {lines.map((parts, i) => (
          <Box key={`line${i}`} flexDirection="row">
            {parts}
            {i === lines.length - 1 && <Text> </Text>}
            {i === lines.length - 1 && (
              <Button key="hide" label="Hide (back: /gauges)" onPress={() => update($, isHidden, () => true)} />
            )}
          </Box>
        ))}
      </Box>
    )
  })
}

/** What a band hook beneath answered with nothing to show: no tree, or a Box with no children. */
function isEmptyTree(tree: unknown): boolean {
  if (tree === null || tree === undefined || tree === false) return true
  const t = tree as { type?: string; children?: unknown }
  return t.type === 'Box' && (!Array.isArray(t.children) || t.children.length === 0)
}
