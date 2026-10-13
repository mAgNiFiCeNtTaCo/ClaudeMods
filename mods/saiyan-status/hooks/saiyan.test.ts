import { describe, expect, mock, test } from 'claude-code/testing'
import type { On, SessionRateLimit } from 'claude-code'

import { statusText, tierOf, TIERS, transformText } from './logic'

const NOW = Date.parse('2026-10-13T13:27:00Z')
const RESETS = '2026-10-13T15:40:00Z' // 2h13m after NOW
const WINDOW = 200_000

type Figures = { percent?: number; rateLimits?: SessionRateLimit[]; usd?: number }

/** Answers every noun the plugin calls beneath it, recording toasts and status lines. */
function world(on: On, store: Record<string, unknown> = {}) {
  const seen = { toasts: [] as string[], status: [] as (string | undefined)[], compacts: 0, registered: [] as string[] }
  let figures: Figures = {}
  const clock = mock.clock(on, { now: NOW })
  // The plugin's $.store, mocked in memory and readable by the test.
  on('store.get', (_$, e) => ({ value: store[e.key] }))
  on('store.set', (_$, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('ui.toast', (_$, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.status', (_$, e) => {
    seen.status.push(e.text)
    return { value: undefined }
  })
  on('command.register', (_$, e) => {
    seen.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('session.usage', () => ({
    value: {
      startedAt: NOW,
      context: { window: WINDOW, percent: figures.percent, tokens: figures.percent === undefined ? undefined : (figures.percent * WINDOW) / 100 },
      rateLimits: figures.rateLimits ?? [],
      cost: figures.usd === undefined ? undefined : { usd: figures.usd },
    },
  }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('session.measure', (_$, e) => ({ changed: e.changed }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('turn.complete', (_$, e) => ({ text: e.answer }))
  on('tool.call', () => ({ result: 'ok', text: 'ok' }))
  on('session.compact', () => {
    seen.compacts += 1
    return { messages: [{ role: 'user' as const, text: 'Summary of the fight so far', toolUses: [] }], tokensBefore: 174_000, tokensAfter: 28_000 }
  })
  return {
    seen,
    clock,
    set(next: Figures) {
      figures = next
    },
    get lastStatus() {
      return seen.status[seen.status.length - 1]
    },
  }
}

function measure(percent: number | undefined, rateLimits: SessionRateLimit[] = [], usd = 1.24) {
  return {
    context: { window: WINDOW, percent, tokens: percent === undefined ? undefined : (percent * WINDOW) / 100 },
    rateLimits,
    cost: { usd },
    changed: ['context' as const],
  }
}

const START = { cwd: 'D:/x', surface: 'terminal' as const, isInteractive: true }
const FIVE = (percentUsed: number): SessionRateLimit => ({ kind: 'five_hour', percentUsed, resetsAt: RESETS })

describe('tiers', () => {
  test('tier from Ki at every boundary', () => {
    const cases: [number, string][] = [
      [0, 'Base'], [24, 'Base'],
      [25, 'Kaioken'], [49, 'Kaioken'],
      [50, 'SSJ'], [69, 'SSJ'],
      [70, 'SSJ2'], [84, 'SSJ2'],
      [85, 'SSJ3'], [94, 'SSJ3'],
      [95, 'Limit Breaker'], [100, 'Limit Breaker'],
    ]
    for (const [ki, name] of cases) expect(TIERS[tierOf(ki)]!.short, `Ki ${ki}`).toBe(name)
  })

  test('transformation texts', () => {
    expect(transformText(2, 3, 71, true)).toBe('Goku went Super Saiyan 2! (Ki 71%)')
    expect(transformText(4, 5, 96, true)).toBe('LIMIT BREAKER! Ki 96%: eat a Senzu Bean (/senzu)')
    expect(transformText(4, 5, 96, false)).toBe('LIMIT BREAKER! Ki 96%')
    expect(transformText(4, 0, 12, true)).toBe('Powered down to Base. Ki 12%')
    expect(transformText(3, 3, 72, true)).toBe(null)
  })
})

describe('status text', () => {
  test('with rate limits', () => {
    const text = statusText({ ki: 73, stamina: 41, resetsAt: RESETS, zeni: 1.24 }, NOW)
    expect(text).toBe('⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24')
  })

  test('without rate limits, and -- before a reading', () => {
    expect(statusText({ ki: 73, stamina: null, resetsAt: null, zeni: 1.24 }, NOW)).toBe(
      '⚡ SSJ2 · Ki 73% · Zeni $1.24',
    )
    expect(statusText({ ki: null, stamina: null, resetsAt: null, zeni: null }, NOW)).toBe(
      '⚡ -- · Ki -- · Zeni --',
    )
  })

  test('the plugin pins the line on session.measure', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    expect(w.lastStatus).toBe('⚡ -- · Ki -- · Zeni --')
    await $.session.measure(measure(73, [FIVE(41)]))
    expect(w.lastStatus).toBe('⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24')
    await $.session.measure(measure(73, []))
    expect(w.lastStatus).toBe('⚡ SSJ2 · Ki 73% · Zeni $1.24')
    expect(w.seen.registered).toEqual(['senzu'])
  })

  test('Dragon Balls moved to the shenron mod: no ★, no /dragonballs, the old store left alone', async ($, on) => {
    const store: Record<string, unknown> = { balls: 4, wishes: 2 }
    const w = world(on, store)
    await $.session.start(START)
    await $.turn.start({ text: 'go', turnId: 'a' })
    for (let i = 0; i < 5; i++) await $.tool.call({ tool: 'Read', file_path: `D:/f${i}.txt` } as never)
    await $.turn.complete({ answer: 'done', durationMs: 1, isAborted: false, turnId: 'a', reason: 'answer' })
    expect(w.lastStatus).toBe('⚡ -- · Ki -- · Zeni --')
    expect(w.seen.registered).toEqual(['senzu'])
    expect(w.seen.toasts).toEqual([])
    expect(store).toEqual({ balls: 4, wishes: 2 })
  })

  test('statusLine off pins nothing', { options: { statusLine: false } }, async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await $.session.measure(measure(73))
    expect(w.seen.status).toEqual([])
  })
})

describe('transformations', () => {
  test('toast once when crossing up, and on powering down', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await $.session.measure(measure(60)) // first reading: no toast
    expect(w.seen.toasts).toEqual([])
    await $.session.measure(measure(71))
    expect(w.seen.toasts).toEqual(['Goku went Super Saiyan 2! (Ki 71%)'])
    await $.session.measure(measure(74))
    await $.session.measure(measure(80))
    expect(w.seen.toasts).toEqual(['Goku went Super Saiyan 2! (Ki 71%)'])
    await $.session.measure(measure(12))
    expect(w.seen.toasts[1]).toBe('Powered down to Base. Ki 12%')
    expect(w.seen.toasts.length).toBe(2)
  })

  test('transformToasts off stays quiet', { options: { transformToasts: false } }, async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await $.session.measure(measure(60))
    await $.session.measure(measure(71))
    expect(w.seen.toasts).toEqual([])
  })
})

describe('senzu', () => {
  test('/senzu compacts and reports Ki before and after', async ($, on) => {
    const w = world(on)
    const session = mock.session(on)
    await $.session.start(START)
    w.set({ percent: 87, usd: 2 })
    await $.session.measure(measure(87))
    const ran = await $.command.run({
      command: 'senzu',
      args: '',
      origin: { kind: 'composer' },
      presentation: { isFullscreen: false, columns: 120 },
    })
    expect(ran.text).toBe('Eating a Senzu Bean... (Ki 87%)')
    expect(w.seen.compacts).toBe(0) // never under the command's own hook
    await w.clock.advance(1000)
    expect(w.seen.compacts).toBe(1)
    const line = 'Ate a Senzu Bean! Ki 87% → 14% (freed 146k)'
    expect(w.seen.toasts).toContain(`${line}  ·  Powered down to Base. Ki 14%`)
    expect(w.lastStatus).toBe('⚡ Base · Ki 14% · Zeni $1.24')
    const notices = session.appended().filter(row => row.message.type === 'system')
    expect(JSON.stringify(notices.map(row => row.message.content))).toContain(line)
  })

  test('the 85% offer fires once until Ki drops, never compacts by itself', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await $.session.measure(measure(80))
    await $.session.measure(measure(86))
    await $.session.measure(measure(88))
    const offers = () => w.seen.toasts.filter(t => t.includes('a Senzu Bean is ready')).length
    expect(offers()).toBe(1)
    await $.session.measure(measure(20))
    await $.session.measure(measure(93))
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
    await w.clock.advance(1000)
    expect(offers()).toBe(2)
    expect(w.seen.compacts).toBe(0)
  })

  test('autoSenzu compacts at 92% once the turn ends', { options: { autoSenzu: true } }, async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    w.set({ percent: 93 })
    await $.session.measure(measure(80))
    await $.session.measure(measure(93))
    await $.turn.complete({ answer: '', durationMs: 1, isAborted: false, turnId: 't', reason: 'answer' })
    await w.clock.advance(1000)
    expect(w.seen.compacts).toBe(1)
    expect(w.seen.toasts).toContain('Auto Senzu! Ki 93% → 14% (freed 146k)  ·  Powered down to Base. Ki 14%')
  })
})

describe('stamina warnings', () => {
  test('off by default', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await $.session.measure(measure(10, [FIVE(91)]))
    expect(w.seen.toasts).toEqual([])
  })

  test('80% and 90% once per window', { options: { staminaWarnings: true } }, async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await $.session.measure(measure(10, [FIVE(81)]))
    await $.session.measure(measure(10, [FIVE(85)]))
    await $.session.measure(measure(10, [FIVE(90)]))
    await $.session.measure(measure(10, [FIVE(95)]))
    expect(w.seen.toasts.length).toBe(2)
    expect(w.seen.toasts[0]).toMatch(/^Stamina 81%! Rest until \d{1,2}:\d{2}/)
    expect(w.seen.toasts[1]).toMatch(/^Stamina 90%! Rest until \d{1,2}:\d{2}/)
  })
})
