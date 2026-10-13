import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { gauge, miniBar, paceOf, paceText, spanText } from './gauges'

const SURFACES = ['terminal', 'desktop'] as const
const NOW = 1_000_000_000
const HOUR = 3600_000

const BAND = {
  plugin: 'kamehameha',
  component: 'AbovePrompt' as const,
  props: {
    hasSurvey: false,
    isWorking: false,
    maxRows: 12,
    bodyColumns: 110,
    scroll: { offset: 0, bodyRows: 11 },
    view: {},
  },
}

const CONTEXT = { window: 200000, tokens: 126000, percent: 63 }
const LIMITS = [
  // 3h into the 5h window at 90%: at this rate it runs out before the reset.
  { kind: 'five_hour', percentUsed: 90, resetsAt: new Date(NOW + 2 * HOUR).toISOString() },
  // Half the week gone at 22%: on pace.
  { kind: 'seven_day', percentUsed: 22, resetsAt: new Date(NOW + 84 * HOUR).toISOString() },
]

function engine(on: On, rateLimits: unknown[] = [], cost?: { usd: number }) {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.usage', () => ({ value: { startedAt: 0, context: CONTEXT, rateLimits, ...(cost ? { cost } : {}) } }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  // The engine's band beneath the plugin: nothing of its own to show.
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }) as any)
}

const mountAll = ($: any) => Promise.all(SURFACES.map(surface => $.ui.mount({ ...BAND, surface })))
const has = async (ui: any, text: RegExp | string) => (await ui.find({ type: 'Text', text })) !== undefined

test('pace: runs out before the reset, or on pace', () => {
  const fast = paceOf(LIMITS[0]!, NOW)
  expect(fast.leftMs).toBe(2 * HOUR)
  expect(Math.abs((fast.elapsed ?? 0) - 0.6) < 1e-9).toBe(true)
  expect(Math.round((fast.emptyInMs ?? 0) / 60_000)).toBe(20)
  expect(paceText(LIMITS[0]!, fast).text).toBe('resets 2h00m · runs out in 20m!')

  const slow = paceOf(LIMITS[1]!, NOW)
  expect(slow.emptyInMs).toBeUndefined()
  expect(paceText(LIMITS[1]!, slow).text).toBe('resets 3d12h · on pace ✓')

  const spend = paceOf({ kind: 'spend_limit', percentUsed: 40 }, NOW)
  expect(spend).toEqual({})
  expect(paceText({ kind: 'five_hour', percentUsed: 100 }, {}).text).toBe('out of stamina')
  expect(spanText(45 * 60_000)).toBe('45m')
})

test('gauge cells, with the time marker, and mini bars', () => {
  const g = gauge(50, 10, 0.6)
  expect(g.fill.length + g.empty.length).toBe(10)
  expect(g.markAt).toBe(5)
  expect(gauge(undefined, 8).fill).toBe('')
  expect(miniBar(50)).toBe('▰▰▰▱▱▱')
  expect(miniBar(100, 4)).toBe('▰▰▰▰')
})

test('the band stacks Ki, Stamina, Training and Zeni gauges', async ($, on) => {
  engine(on, LIMITS, { usd: 1.5 })
  mock.clock(on, { now: NOW })
  await $.session.measure({ context: CONTEXT, rateLimits: LIMITS, cost: { usd: 1.5 }, changed: ['context', 'rateLimits', 'cost'] })
  for (const ui of await mountAll($)) {
    expect(await has(ui, 'KI')).toBe(true)
    expect(await has(ui, 'STAMINA 5h')).toBe(true)
    expect(await has(ui, 'TRAINING 7d')).toBe(true)
    expect(await has(ui, /runs out in 20m!/)).toBe(true)
    expect(await has(ui, /on pace ✓/)).toBe(true)
    expect(await has(ui, '│')).toBe(true)
    expect(await has(ui, 'ZENI')).toBe(true)
    expect(await has(ui, '$1.50')).toBe(true)
    // No turn has finished, so there is no cache figure yet.
    expect(await has(ui, 'CACHE')).toBe(false)
  }
})

test('no rate limits (API key): no Stamina rows, never a 0', async ($, on) => {
  engine(on)
  mock.clock(on, { now: NOW })
  await $.session.measure({ context: CONTEXT, rateLimits: [], changed: ['context'] })
  for (const ui of await mountAll($)) {
    expect(await has(ui, 'KI')).toBe(true)
    expect(await has(ui, 'STAMINA 5h')).toBe(false)
    expect(await has(ui, ' 0%')).toBe(false)
  }
})

test('the cache gauge fills from finished turns', async ($, on) => {
  engine(on)
  mock.clock(on, { now: NOW })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.turn.complete({
    answer: 'done',
    durationMs: 1000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: { input_tokens: 1000, output_tokens: 10, cache_creation_input_tokens: 1000, cache_read_input_tokens: 8000, model: 'm' },
  })
  for (const ui of await mountAll($)) {
    expect(await has(ui, 'CACHE')).toBe(true)
    expect(await has(ui, ' 80%')).toBe(true)
  }
})

test('a Zeni budget turns the cost into a gauge', { options: { zeniBudget: 5 } }, async ($, on) => {
  engine(on, [], { usd: 2.5 })
  mock.clock(on, { now: NOW })
  await $.session.measure({ context: CONTEXT, rateLimits: [], cost: { usd: 2.5 }, changed: ['cost'] })
  for (const ui of await mountAll($)) {
    expect(await has(ui, ' 50%')).toBe(true)
    expect(await has(ui, /\$2\.50 of \$5\.00/)).toBe(true)
  }
})

test('the hint line under the prompt gets mini bars', async ($, on) => {
  engine(on, LIMITS)
  const seen: string[] = []
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    seen.push(e.props.tail ?? '')
    return { type: 'Box', props: {}, children: [] }
  })
  mock.clock(on, { now: NOW })
  await $.session.measure({ context: CONTEXT, rateLimits: LIMITS, changed: ['context', 'rateLimits'] })
  await $.ui.mount({
    plugin: 'kamehameha',
    component: 'PromptHint',
    surface: 'terminal',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
  })
  const tail = seen.at(-1) ?? ''
  expect(tail).toContain('KI ▰▰▰▰▱▱ 63%')
  expect(tail).toContain('5h ▰▰▰▰▰▱ 90%')
  expect(tail).toContain('7d ▰▱▱▱▱▱ 22%')
})
