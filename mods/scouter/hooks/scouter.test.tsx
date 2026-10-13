import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { paletteOf } from './palettes'

const SURFACES = ['terminal', 'desktop'] as const
const NOW = Date.parse('2026-10-13T14:00:00Z')
const MIN = 60_000

const LIMITS = [
  { kind: 'five_hour', percentUsed: 41, resetsAt: new Date(NOW + (2 * 60 + 13) * MIN).toISOString() },
  { kind: 'seven_day', percentUsed: 12, resetsAt: new Date(NOW + 3 * 24 * 60 * MIN).toISOString() },
]

const USAGE = {
  startedAt: NOW - 65 * MIN,
  context: { tokens: 126_000, window: 200_000, percent: 63 },
  rateLimits: LIMITS,
  cost: { usd: 1.24 },
}

const BREAKDOWN = {
  categories: [
    { name: 'System prompt', tokens: 3_100, color: 'promptBorder', isDeferred: false, kind: 'used' },
    { name: 'System tools', tokens: 14_200, color: 'inactive', isDeferred: false, kind: 'used' },
    { name: 'Messages', tokens: 108_700, color: 'permission', isDeferred: false, kind: 'used' },
    { name: 'MCP tools (deferred)', tokens: 9_000, color: 'inactive', isDeferred: true, kind: 'deferred' },
    { name: 'Free space', tokens: 74_000, color: 'text', isDeferred: false, kind: 'free' },
  ],
  totalTokens: 126_000,
  maxTokens: 200_000,
  rawMaxTokens: 200_000,
  autocompactSource: 'model',
  percentage: 63,
  gridRows: [],
  model: 'claude-opus-5-5',
  memoryFiles: [],
  mcpTools: [],
  agents: [],
  isAutoCompactEnabled: true,
  apiUsage: null,
}

const PANE_PROPS = {
  title: 'Scouter',
  isFocused: false,
  bodyColumns: 44,
  placement: 'dock',
  scroll: { offset: 0, bodyRows: 40 },
  view: {},
} as const

const VIEWPORT = { columns: 160, rows: 48, isFullscreen: true }

/** The world beneath the plugin: usage figures, panes, toasts and the clock, all from memory. */
function world(on: On, usage: Record<string, unknown> = USAGE) {
  const clock = mock.clock(on, { now: NOW })
  const panes: string[] = []
  const toasts: string[] = []
  const usageCalls: Array<string | undefined> = []

  on('session.usage', ($, e) => {
    usageCalls.push(e.breakdown)
    const base = usage.context as Record<string, unknown>
    const context = e.breakdown === undefined ? base : { ...base, breakdown: BREAKDOWN }
    return { value: { ...usage, context } as never }
  })
  on('session.model', () => ({ value: 'claude-opus-5-5' }))
  on('command.register', ($, e) => ({ value: { command: e.name } }))
  on('ui.open', ($, e) => {
    if (!panes.includes(e.id)) panes.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', ($, e) => {
    const at = panes.indexOf(e.id)
    if (at >= 0) panes.splice(at, 1)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: panes.map(id => ({ id, title: 'Scouter', isShown: true, isFocused: false, isPlaced: true })),
  }))
  on('ui.toast', ($, e) => {
    toasts.push(e.text)
    return { value: undefined }
  })
  on('session.start', ($, e) => ({ cwd: e.cwd }))
  on('turn.complete', ($, e) => ({ text: e.answer }))
  on('session.measure', ($, e) => ({ changed: e.changed }))

  return { clock, panes, toasts, usageCalls }
}

const SCOUTER_COMMAND = {
  command: 'scouter',
  args: '',
  origin: { kind: 'composer' },
  presentation: { isFullscreen: true, columns: 160 },
} as const

function turn(id: string, tokens: number) {
  return {
    answer: '',
    durationMs: 1000,
    isAborted: false,
    turnId: id,
    reason: 'answer',
    usage: {
      input_tokens: tokens / 2,
      output_tokens: tokens / 4,
      cache_read_input_tokens: tokens / 8,
      cache_creation_input_tokens: tokens / 8,
      model: 'claude-opus-5-5',
    },
  } as const
}

test('/scouter opens the pane and it reads POWER LEVEL, KI and ZENI on terminal and desktop', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })
  await $.turn.complete(turn('t1', 4000))

  const ran = await $.command.run(SCOUTER_COMMAND as never)
  expect(ran.text).toBe('Scouter on.')
  expect(w.panes).toEqual(['scouter'])
  expect(w.usageCalls).toContain('summary')

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({
      plugin: 'scouter',
      surface,
      component: 'Pane',
      requestId: 'scouter',
      props: PANE_PROPS,
      viewport: VIEWPORT,
    })
    expect(await ui.find({ type: 'Text', text: /SCOUTER/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Model claude-opus-5-5' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /POWER LEVEL/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '4,000' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /KI \(context\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '126k / 200k (63%)' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Messages' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /deferred/ })).toBeUndefined()
    expect(await ui.find({ type: 'Text', text: /STAMINA \(5h\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '41% · resets in 2h 13m' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /TRAINING \(7d\)/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /ZENI/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Zeni $1.24' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: '$1.24 per attack' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Time 1h 05m · Attacks 1' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'refresh' })).toBeDefined()
    expect(await ui.find({ type: 'Button', key: 'close' })).toBeDefined()
    await ui.unmount()
  }

  const again = await $.command.run(SCOUTER_COMMAND as never)
  expect(again.text).toBe('Scouter off.')
  expect(w.panes).toEqual([])
})

test('a missing figure shows -- and never 0', async ($, on) => {
  world(on, { startedAt: NOW, context: { window: 200_000 }, rateLimits: [] })
  await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })
  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'scouter', surface, component: 'Pane', requestId: 'scouter', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: '-- / 200k (--)' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Zeni --' })).toBeDefined()
    expect((await ui.findAll({ type: 'Text', text: /^--$/ })).length).toBe(2)
    await ui.unmount()
  }
})

test("IT'S OVER 9000 fires once per session", async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })

  await $.turn.complete(turn('t1', 6000))
  expect(w.toasts.filter(t => t.includes('OVER 9000'))).toHaveLength(0)
  await $.turn.complete(turn('t2', 4000))
  expect(w.toasts.filter(t => t.includes('OVER 9000'))).toEqual(["IT'S OVER 9000!!!"])
  await $.turn.complete(turn('t3', 8000))
  await $.turn.complete(turn('t4', 8000))
  expect(w.toasts.filter(t => t.includes('OVER 9000'))).toHaveLength(1)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'scouter', surface, component: 'Pane', requestId: 'scouter', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: '26,000' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: "IT'S OVER 9000!!!" })).toBeDefined()
    await ui.unmount()
  }
})

test('the 9000 toast stays quiet when switched off', { options: { over9000Toast: false } }, async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })
  await $.turn.complete(turn('t1', 20000))
  expect(w.toasts).toHaveLength(0)
})

test('stamina alerts fire once per threshold per window', async ($, on) => {
  const w = world(on)
  await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })
  const resetsAt = LIMITS[0]!.resetsAt
  const measure = (percentUsed: number) =>
    $.session.measure({
      context: USAGE.context,
      rateLimits: [{ kind: 'five_hour', percentUsed, resetsAt }],
      cost: USAGE.cost,
      changed: ['rateLimits'],
    })

  await measure(79)
  expect(w.toasts).toHaveLength(0)
  await measure(81)
  expect(w.toasts).toHaveLength(1)
  expect(w.toasts[0]).toMatch(/^Stamina 80%! Rest until \d{1,2}:\d\d (AM|PM)$/)
  await measure(85)
  expect(w.toasts).toHaveLength(1)
  await measure(92)
  expect(w.toasts).toHaveLength(2)
  expect(w.toasts[1]).toMatch(/^Stamina 90%!/)
  await measure(97)
  expect(w.toasts).toHaveLength(2)
})

test('the battle log counts techniques, edited files and failures', async ($, on) => {
  world(on)
  on('tool.call', ($, e) =>
    String(e.tool) === 'Bash' ? { isError: true, result: 'exit 1', text: 'exit 1' } as never : { result: {} as never },
  )
  await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })
  await $.tool.call({ tool: 'Edit', file_path: 'D:/a.ts', old_string: 'a', new_string: 'b' } as never)
  await $.tool.call({ tool: 'Edit', file_path: 'D:/a.ts', old_string: 'b', new_string: 'c' } as never)
  await $.tool.call({ tool: 'Write', file_path: 'D:/b.ts', content: 'x' } as never)
  await $.tool.call({ tool: 'Read', file_path: 'D:/c.ts' } as never)
  await $.tool.call({ tool: 'Bash', command: 'false' } as never)

  for (const surface of SURFACES) {
    const ui = await $.ui.mount({ plugin: 'scouter', surface, component: 'Pane', requestId: 'scouter', props: PANE_PROPS })
    expect(await ui.find({ type: 'Text', text: 'Techniques 5: Edit ×2 · Write ×1 · Read ×1' })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: 'Files edited 2 · Failed 1' })).toBeDefined()
    await ui.unmount()
  }
})

test('autoOpen opens the pane by itself on a fullscreen terminal', { options: { autoOpen: true } }, async ($, on) => {
  const w = world(on)
  on('ui.render', { component: 'PromptHint' }, ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text dimColor>{e.props.hint}</Text>
  })
  await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })
  expect(w.panes).toEqual([])
  const hint = await $.ui.mount({
    plugin: 'scouter',
    surface: 'terminal',
    component: 'PromptHint',
    props: { isDraft: false, isWorking: false, hint: '? for shortcuts' },
    viewport: VIEWPORT,
  })
  await w.clock.advance(2000)
  expect(w.panes).toEqual(['scouter'])
  await hint.unmount()
})

describe('color schemes', () => {
  async function pane($: any, on: On) {
    world(on)
    await $.session.start({ cwd: 'D:/ClaudeProjects', surface: 'terminal', isInteractive: true })
    return Promise.all(
      SURFACES.map(surface =>
        $.ui.mount({ plugin: 'scouter', surface, component: 'Pane', requestId: 'scouter', props: PANE_PROPS }),
      ),
    )
  }
  const colorOf = async (ui: any, text: RegExp | string) => (await ui.find({ type: 'Text', text }))?.props.color

  test('palette namek colors the headings, the gauge, the lens and the title', { options: { palette: 'namek' } }, async ($, on) => {
    const namek = paletteOf('namek')
    for (const ui of await pane($, on)) {
      expect(await colorOf(ui, /POWER LEVEL/)).toBe(namek.heading)
      // KI at 63%: the first gauge, in the gold band.
      expect(await colorOf(ui, /^█+/)).toBe(namek.gold)
      expect(await colorOf(ui, '126k / 200k (63%)')).toBe(namek.readout)
      expect((await ui.find({ type: 'Box' }))?.props.borderColor).toBe(namek.frame)
      expect(await ui.find({ type: 'Text', text: '◢ SCOUTER ◣ · Namek' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('an unknown palette falls back to goku', { options: { palette: 'cell' } }, async ($, on) => {
    for (const ui of await pane($, on)) {
      expect(await colorOf(ui, /POWER LEVEL/)).toBe('#ff7a00')
      expect(await colorOf(ui, /^█+/)).toBe('#ffd400')
      expect(await colorOf(ui, '126k / 200k (63%)')).toBe('#39ff14')
      expect(await ui.find({ type: 'Text', text: '◢ SCOUTER ◣ · Goku' })).toBeDefined()
      await ui.unmount()
    }
  })
})
