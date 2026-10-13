import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { CAP, chargeOf, compact, stageOf } from './kame'

const SURFACES = ['terminal', 'desktop'] as const

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

const USAGE = {
  startedAt: 0,
  context: { window: 200000, tokens: 126000, percent: 63 },
  rateLimits: [],
}

// What stands beneath the plugin: the engine's answers to the events it passes on.
function engine(on: On) {
  on('turn.start', ($, e) => ({ turnId: e.turnId }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.usage', () => ({ value: USAGE }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
  on('tool.call', () => ({ deny: 'the test engine runs no tools' }))
}

async function mountAll($: any, isWorking: boolean) {
  return Promise.all(
    SURFACES.map(surface => $.ui.mount({ ...BAND, props: { ...BAND.props, isWorking }, surface })),
  )
}

// Texts carry no key, so each part of the band is found by what it shows.
const SHOWN = {
  ki: /^ (--|\d+%)$/,
  percent: /^ +\d+%$/,
  stats: /techniques? · /,
  beam: /^═+$/,
  shout: /HAAAAAA/,
  summary: /tokens · $/,
  fizzle: /fizzled$/,
}

async function textOf(ui: any, part: keyof typeof SHOWN): Promise<string | undefined> {
  return (await ui.find({ type: 'Text', text: SHOWN[part] }))?.text
}

test('charge mixes time and activity, capped at 95%', () => {
  expect(chargeOf(0, 0, 0)).toBe(0)
  expect(chargeOf(45000, 0, 0)).toBeGreaterThan(0.6)
  expect(chargeOf(10 * 60_000, 50, 50)).toBe(CAP)
  expect(chargeOf(10_000, 3, 0)).toBeGreaterThan(chargeOf(10_000, 0, 0))
  expect(stageOf(0.1)).toBe(0)
  expect(stageOf(0.58)).toBe(2)
  expect(stageOf(0.95)).toBe(4)
  expect(compact(23400)).toBe('23.4k')
  expect(compact(126000)).toBe('126k')
  expect(compact(200000)).toBe('200k')
  expect(compact(950)).toBe('950')
})

test('idle before any turn draws only the Ki gauge, with -- before a reading', async ($, on) => {
  engine(on)
  mock.clock(on, { now: 1_000_000 })
  for (const ui of await mountAll($, false)) {
    expect(await ui.find({ type: 'Text', text: /Ka\.\.\./ })).toBeUndefined()
    expect(await textOf(ui, 'beam')).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: 'KI' })).toBeDefined()
    expect(await textOf(ui, 'ki')).toContain('--')
    expect(await ui.find({ key: 'hide' })).toBeDefined()
  }
  await $.session.measure({ context: USAGE.context, rateLimits: [], changed: ['context'] })
  for (const ui of await mountAll($, false)) {
    expect(await textOf(ui, 'ki')).toContain('63%')
    expect(await ui.find({ type: 'Text', text: /126k \/ 200k/ })).toBeDefined()
  }
})

test(
  'idle before any turn with the gauge off draws nothing',
  { options: { showKiGauge: false } },
  async ($, on) => {
    engine(on)
    on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))
    mock.clock(on, { now: 1_000_000 })
    for (const ui of await mountAll($, false)) {
      expect(await ui.find({ type: 'Text' })).toBeUndefined()
      expect(await ui.find({ key: 'hide' })).toBeUndefined()
    }
  },
)

test('a running turn charges: chant stage, percent, techniques, tool name', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'go', turnId: 't1' })
  const uis = await mountAll($, true)
  const before: number[] = []
  for (const ui of uis) {
    expect(await ui.find({ type: 'Text', text: /^Ka\.\.\./ })).toBeDefined()
    const pct = await textOf(ui, 'percent')
    expect(pct).toMatch(/\d+%/)
    before.push(parseInt(pct ?? '', 10))
    expect(await textOf(ui, 'stats')).toContain('0 techniques · 0:00')
  }

  await $.tool.call({ tool: 'Bash', command: 'ls' })
  await clock.advance(30_000)
  for (const [i, ui] of uis.entries()) {
    const pct = parseInt((await textOf(ui, 'percent')) ?? '', 10)
    expect(pct).toBeGreaterThan(before[i]!)
    expect(pct).toBeLessThanOrEqual(95)
    expect(await ui.find({ type: 'Text', text: /Ka\.\.\. Me\.\.\./ })).toBeDefined()
    const stats = await textOf(ui, 'stats')
    expect(stats).toContain('1 technique ')
    expect(stats).toContain('0:30')
    expect(stats).toContain('Bash')
  }
})

test('turn.complete fires the beam, then settles into the summary', async ($, on) => {
  engine(on)
  const clock = mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'go', turnId: 't1' })
  await $.tool.call({ tool: 'Read', file_path: 'a.txt' })
  await $.turn.complete({
    answer: 'done',
    durationMs: 72_000,
    isAborted: false,
    turnId: 't1',
    reason: 'answer',
    usage: {
      input_tokens: 1000,
      output_tokens: 400,
      cache_creation_input_tokens: 2000,
      cache_read_input_tokens: 20000,
      model: 'claude-opus-5-5',
    },
  })
  const uis = await mountAll($, false)
  for (const ui of uis) {
    expect(await textOf(ui, 'beam')).toBeDefined()
    expect(await textOf(ui, 'shout')).toContain('HAAAAAA!!!')
    expect(await ui.find({ type: 'Text', text: /Ka\.\.\./ })).toBeUndefined()
  }
  const short = (await textOf(uis[0], 'beam'))?.length ?? 0
  await clock.advance(1000)
  for (const ui of uis) {
    expect((await textOf(ui, 'beam'))?.length ?? 0).toBeGreaterThan(short)
  }
  await clock.advance(3500)
  for (const ui of uis) {
    expect(await textOf(ui, 'beam')).toBeUndefined()
    const summary = await textOf(ui, 'summary')
    expect(summary).toContain('1:12')
    expect(summary).toContain('1 technique ')
    expect(summary).toContain('23.4k tokens')
    expect(await ui.find({ type: 'Text', text: 'Ki 63%' })).toBeDefined()
  }
})

test('an interrupted turn fizzles instead of firing', async ($, on) => {
  engine(on)
  mock.clock(on, { now: 1_000_000 })
  await $.turn.start({ text: 'go', turnId: 't2' })
  await $.turn.complete({
    answer: '',
    durationMs: 5_000,
    isAborted: true,
    turnId: 't2',
    reason: 'aborted',
  })
  for (const ui of await mountAll($, false)) {
    expect(await textOf(ui, 'fizzle')).toContain('...fizzled')
    expect(await textOf(ui, 'beam')).toBeUndefined()
  }
})

test('/gauges brings a hidden band back, and hides it again', async ($, on) => {
  engine(on)
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))
  mock.clock(on, { now: 1_000_000 })
  await $.session.start({ cwd: 'D:/x', surface: 'terminal', isInteractive: true } as any)
  const [terminal, desktop] = await mountAll($, false)
  await terminal!.press({ key: 'hide' })
  expect(await terminal!.find({ type: 'Text', text: 'KI' })).toBeUndefined()
  const back = await $.command.run({ command: 'gauges', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as any)
  expect(JSON.stringify(back)).toContain('back')
  expect(await terminal!.find({ type: 'Text', text: 'KI' })).toBeDefined()
  expect(await desktop!.find({ type: 'Text', text: 'KI' })).toBeDefined()
  const gone = await $.command.run({ command: 'gauges', args: '', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 120 } } as any)
  expect(JSON.stringify(gone)).toContain('/gauges')
  expect(await terminal!.find({ type: 'Text', text: 'KI' })).toBeUndefined()
})

test('Hide takes the band away until the next turn', async ($, on) => {
  engine(on)
  on('ui.render', { component: 'AbovePrompt' }, () => ({ type: 'Box', props: {}, children: [] }))
  mock.clock(on, { now: 1_000_000 })
  const [terminal, desktop] = await mountAll($, false)
  await terminal!.press({ key: 'hide' })
  expect(await terminal!.find({ type: 'Text', text: 'KI' })).toBeUndefined()
  expect(await desktop!.find({ type: 'Text', text: 'KI' })).toBeUndefined()
  await $.turn.start({ text: 'again', turnId: 't3' })
  expect(await terminal!.find({ type: 'Text', text: /^Ka\.\.\./ })).toBeDefined()
})
