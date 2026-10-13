import { describe, expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { dragonFrame, frameText } from './art'

const SURFACES = ['terminal', 'desktop'] as const
const NOW = Date.parse('2026-10-13T15:00:00Z')
const START = { cwd: 'D:/x', surface: 'terminal' as const, isInteractive: true }
const PALETTE_OPTIONS = [
  'goku', 'vegeta', 'namek', 'frieza', 'super-saiyan-blue', 'ultra-instinct', 'majin-buu', 'kaioken',
  'golden-frieza', 'super-saiyan-rose',
]

type Opened = { id: string; focus?: boolean; closeOnEscape?: boolean; holdToasts?: boolean; rows?: number }

/** Everything beneath the plugin, in memory: store, clock, panes, toasts, config rows, compaction, the model. */
function world(on: On, store: Record<string, unknown> = {}, rng = '0.1') {
  const seen = {
    toasts: [] as string[],
    opened: [] as Opened[],
    panes: [] as string[],
    sets: [] as { key: string; value: unknown }[],
    compacts: 0,
    asked: [] as string[],
    registered: [] as string[],
  }
  let tip: string | null = 'Read the whole error, mortal. The last line holds the answer.'
  const clock = mock.clock(on, { now: NOW })
  mock.env(on, { SHENRON_RNG: rng })
  on('store.get', (_$, e) => ({ value: store[e.key] }))
  on('store.set', (_$, e) => {
    store[e.key] = e.value
    return { value: undefined }
  })
  on('command.register', (_$, e) => {
    seen.registered.push(e.name)
    return { value: { command: e.name } }
  })
  on('ui.toast', (_$, e) => {
    seen.toasts.push(e.text)
    return { value: undefined }
  })
  on('ui.open', (_$, e) => {
    seen.opened.push({ ...e } as Opened)
    if (!seen.panes.includes(e.id)) seen.panes.push(e.id)
    return { value: { isPlaced: true } }
  })
  on('ui.close', (_$, e) => {
    seen.panes = seen.panes.filter(id => id !== e.id)
    return { value: undefined }
  })
  on('ui.panes', () => ({
    value: seen.panes.map(id => ({ id, title: id, isShown: true, isFocused: false, isPlaced: true })),
  }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))
  on('turn.start', (_$, e) => ({ turnId: e.turnId }))
  on('tool.call', () => ({ result: 'ok', text: 'ok' }) as never)
  on('config.list', () => ({
    value: [
      { key: 'kamehameha.palette', label: 'Color scheme', kind: 'choice', value: 'goku', options: PALETTE_OPTIONS, provider: { plugin: 'kamehameha', tier: 'user' }, isLocked: false },
      { key: 'kamehameha.hintBars', label: 'Hint bars', kind: 'boolean', value: true, provider: { plugin: 'kamehameha', tier: 'user' }, isLocked: false },
      { key: 'scouter.palette', label: 'Color scheme', kind: 'choice', value: 'goku', options: PALETTE_OPTIONS, provider: { plugin: 'scouter', tier: 'user' }, isLocked: false },
      { key: 'shenron.palette', label: 'Color scheme', kind: 'choice', value: 'goku', options: PALETTE_OPTIONS, provider: { plugin: 'shenron', tier: 'user' }, isLocked: false },
      { key: 'oldmod.palette', label: 'Color scheme', kind: 'choice', value: 'a', options: ['a', 'b'], provider: { plugin: 'oldmod', tier: 'user' }, isLocked: false },
    ] as never,
  }))
  on('config.set', (_$, e) => {
    seen.sets.push({ key: e.key, value: e.value })
    return { value: e.value }
  })
  on('session.compact', () => {
    seen.compacts += 1
    return { messages: [{ role: 'user' as const, text: 'The battle so far', toolUses: [] }], tokensBefore: 174_000, tokensAfter: 28_000 }
  })
  on('model.complete', (_$, e) => {
    seen.asked.push(e.model)
    const usage = { input_tokens: 80, output_tokens: 30, cache_read_input_tokens: 0, cache_creation_input_tokens: 0 }
    return {
      value: tip === null ? { isAnswered: false, reason: 'api-error', status: 529, error: 'overloaded', usage } : { isAnswered: true, text: tip, usage },
    } as never
  })
  return {
    seen,
    clock,
    store,
    noTip() {
      tip = null
    },
  }
}

function cmd(command: string, args = '') {
  return { command, args, origin: { kind: 'composer' }, presentation: { isFullscreen: true, columns: 150 } } as never
}

async function techniques($: any, n: number) {
  for (let i = 0; i < n; i++) await $.tool.call({ tool: 'Read', file_path: `D:/x/${i}.ts` } as never)
}

const PANE = (id: string, bodyColumns = 66, bodyRows = 40) =>
  ({ title: id, isFocused: true, bodyColumns, placement: 'dock', scroll: { offset: 0, bodyRows }, view: {} }) as const

const VIEWPORT = { columns: 150, rows: 48, isFullscreen: true }

function mountPane($: any, id: string, surface: 'terminal' | 'desktop', bodyColumns = 66, bodyRows = 40) {
  return $.ui.mount({ plugin: 'shenron', surface, component: 'Pane', requestId: id, props: PANE(id, bodyColumns, bodyRows), viewport: VIEWPORT })
}

/** Finds a ball by the pity rule (frequent: sure by the 15th tool call). */
async function findOne($: any) {
  await techniques($, 15)
}

describe('finding Dragon Balls', () => {
  test('a ball turns up by the pity count, never before', { options: { findRate: 'frequent' } }, async ($, on) => {
    const w = world(on, { stars: [1, 2, 3] })
    await $.session.start(START)
    expect(w.seen.registered).toEqual(['grab', 'shenron', 'dragonradar', 'dbztheme'])
    await techniques($, 14)
    expect(w.seen.toasts).toEqual([])
    await techniques($, 1)
    expect(w.seen.toasts).toEqual(['✨ A Dragon Ball appeared! The 4-Star Ball, grab it! (/grab)'])
    const pane = w.seen.opened.find(o => o.id === 'dragonball')
    expect(pane).toMatchObject({ id: 'dragonball', rows: 4 })
    expect(pane?.focus).toBeUndefined()
    expect(w.store.finds).toBe(1)

    // At most one ball out: more tool calls find nothing else.
    await techniques($, 30)
    expect(w.seen.toasts).toHaveLength(1)

    for (const surface of SURFACES) {
      const ui = await mountPane($, 'dragonball', surface, 60)
      expect(await ui.find({ type: 'Text', text: '✨ A Dragon Ball appeared!' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'The 4-Star Ball ( ★★★★ )' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'grab' })).toBeDefined()
      expect((await ui.findAll({ type: 'Text', text: /★ ★/ })).length).toBe(2)
      await ui.unmount()
    }
  })

  test('a lucky roll finds one early', { options: { findRate: 'normal' } }, async ($, on) => {
    const w = world(on, {}, '0.01')
    await $.session.start(START)
    await techniques($, 1)
    expect(w.seen.toasts).toEqual(['✨ A Dragon Ball appeared! The 1-Star Ball, grab it! (/grab)'])
  })

  test('subagent tool calls do not count', { options: { findRate: 'frequent' } }, async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    for (let i = 0; i < 20; i++) {
      await $.tool.call({ tool: 'Read', file_path: `D:/x/${i}.ts`, agentId: 'a1' } as never)
    }
    expect(w.seen.toasts).toEqual([])
  })

  test('/grab collects it, toasts the count and closes the pane', { options: { findRate: 'frequent' } }, async ($, on) => {
    const w = world(on, { stars: [1, 2, 3] })
    await $.session.start(START)
    expect((await $.command.run(cmd('grab'))).text).toBe('No Dragon Ball in sight. Keep working: one will turn up.')
    await findOne($)
    expect(w.seen.panes).toContain('dragonball')
    const ran = await $.command.run(cmd('grab'))
    expect(ran.text).toBe('Got the 4-Star Dragon Ball! ★★★★☆☆☆ 4/7')
    expect(w.seen.toasts[1]).toBe('Got the 4-Star Dragon Ball! ★★★★☆☆☆ 4/7')
    expect(w.store.stars).toEqual([1, 2, 3, 4])
    expect(w.seen.panes).not.toContain('dragonball')
    expect((await $.command.run(cmd('grab'))).text).toBe('No Dragon Ball in sight. Keep working: one will turn up.')
  })

  test('the pane button grabs it too', { options: { findRate: 'frequent' } }, async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    await findOne($)
    const ui = await mountPane($, 'dragonball', 'terminal', 60)
    await ui.press({ key: 'grab' })
    expect(w.store.stars).toEqual([1])
    expect(w.seen.toasts[1]).toBe('Got the 1-Star Dragon Ball! ★☆☆☆☆☆☆ 1/7')
    await ui.unmount()
  })

  test('an ungrabbed ball flies away after 90 s', { options: { findRate: 'frequent' } }, async ($, on) => {
    const w = world(on, { stars: [1, 2, 3] })
    await $.session.start(START)
    await findOne($)
    await w.clock.advance(89_000)
    expect(w.seen.toasts).toHaveLength(1)
    await w.clock.advance(1_000)
    expect(w.seen.toasts[1]).toBe('The 4-Star Dragon Ball flew away...')
    expect(w.seen.panes).not.toContain('dragonball')
    expect((await $.command.run(cmd('grab'))).text).toBe('No Dragon Ball in sight. Keep working: one will turn up.')
    expect(w.store.stars).toEqual([1, 2, 3])
  })

  test('with ballEscape off the ball waits', { options: { findRate: 'frequent', ballEscape: false } }, async ($, on) => {
    const w = world(on, { stars: [1, 2, 3] })
    await $.session.start(START)
    await findOne($)
    await w.clock.advance(600_000)
    await techniques($, 3)
    expect(w.seen.toasts).toHaveLength(1)
    expect((await $.command.run(cmd('grab'))).text).toBe('Got the 4-Star Dragon Ball! ★★★★☆☆☆ 4/7')
  })

  test('the hint line keeps the other tail and adds the balls', async ($, on) => {
    world(on, { stars: [2, 5] })
    on('ui.render', { component: 'PromptHint' }, ($, e) => {
      const { Text } = $.ui.resolve(e)
      return <Text dimColor>{`${e.props.hint}|${e.props.tail ?? ''}`}</Text>
    })
    await $.session.start(START)
    for (const surface of SURFACES) {
      const ui = await $.ui.mount({
        plugin: 'shenron',
        surface,
        component: 'PromptHint',
        props: { isDraft: false, isWorking: false, hint: '? for shortcuts', tail: '  ⚡ KI ▰▰▱ 63%' },
      })
      expect(await ui.find({ type: 'Text', text: '? for shortcuts|  ⚡ KI ▰▰▱ 63%  🐉 ●●○○○○○' })).toBeDefined()
      await ui.unmount()
    }
  })
})

describe('Shenron', () => {
  test('the 7th ball summons him: a focused dialog, wish buttons, the dragon around it', { options: { findRate: 'frequent' } }, async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6] })
    await $.session.start(START)
    await findOne($)
    const ran = await $.command.run(cmd('grab'))
    expect(ran.text).toBe('Got the 7-Star Dragon Ball! ★★★★★★★ 7/7 The sky darkens... SHENRON HAS BEEN SUMMONED!')
    expect(w.seen.toasts[1]).toContain('The sky darkens... SHENRON HAS BEEN SUMMONED!')
    expect(w.seen.opened.find(o => o.id === 'shenron')).toMatchObject({ focus: true, closeOnEscape: true, holdToasts: true })

    for (const surface of SURFACES) {
      for (const columns of [76, 50, 66]) {
        const ui = await mountPane($, 'shenron', surface, columns)
        expect(await ui.find({ type: 'Text', text: /I AM THE ETERNAL DRAGON\./ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /STATE YOUR WISH\./ })).toBeDefined()
        for (const n of [1, 2, 3, 4, 5]) expect(await ui.find({ type: 'Button', key: `wish-${n}` })).toBeDefined()
        expect(await ui.find({ type: 'Button', text: /Restore my Ki/ })).toBeDefined()
        // The coil: scaled body along the top and the bottom, sides on every row, the red eye.
        expect(await ui.find({ type: 'Text', text: /▄▄▄▄▄▲▄▄▄▄▄/ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /▀▀▀▀▀▼▀▀▀▀▀/ })).toBeDefined()
        expect(await ui.find({ type: 'Text', text: /▓▒▓▒▓▒▓▒▓▒/ })).toBeDefined()
        expect((await ui.findAll({ type: 'Text', text: /╲│╱/ })).length).toBeGreaterThanOrEqual(3)
        const eye = await ui.find({ type: 'Text', text: /◉/ })
        expect(eye?.props.color).toBe('#ff3b30')
        await ui.unmount()
      }
    }
  })

  test('wish 4 is refused and the balls stay', async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6, 7] })
    await $.session.start(START)
    expect((await $.command.run(cmd('shenron'))).text).toBe('The sky darkens... SHENRON HAS BEEN SUMMONED!')
    const ui = await mountPane($, 'shenron', 'terminal')
    await ui.press({ key: 'wish-4' })
    expect(await ui.find({ type: 'Text', text: /THAT IS BEYOND MY POWER\./ })).toBeDefined()
    await w.clock.advance(10_000)
    expect(w.seen.panes).toContain('shenron')
    expect(w.store.stars).toEqual([1, 2, 3, 4, 5, 6, 7])
    expect(w.store.wishes).toBeUndefined()
    // Wish again: the buttons are still there.
    expect(await ui.find({ type: 'Button', key: 'wish-5' })).toBeDefined()
    await ui.press({ key: 'wish-5' })
    expect(w.store.stars).toEqual([1, 2, 3, 4, 5, 6, 7])
    await ui.unmount()
  })

  test('wish 2 unlocks Golden Frieza and switches every DBZ mod to it', async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6, 7] })
    await $.session.start(START)
    await $.command.run(cmd('shenron'))
    const ui = await mountPane($, 'shenron', 'terminal')
    await ui.press({ key: 'wish-2' })
    expect(w.store.unlocked).toEqual(['golden-frieza'])
    expect(await ui.find({ type: 'Text', text: /A NEW POWER AWAKENS: GOLDEN FRIEZA!/ })).toBeDefined()
    expect(await ui.find({ type: 'Text', text: /YOUR WISH HAS BEEN GRANTED\. FAREWELL!/ })).toBeDefined()
    expect(w.seen.sets).toEqual([])
    await w.clock.advance(3000)
    expect(w.seen.panes).not.toContain('shenron')
    expect(w.store.stars).toEqual([])
    expect(w.store.wishes).toBe(1)
    expect(w.seen.toasts.at(-1)).toBe(
      'The Dragon Balls scattered across the Earth...  ·  Transformed! Color scheme: Golden Frieza',
    )
    expect(w.seen.sets).toEqual([
      { key: 'kamehameha.palette', value: 'golden-frieza' },
      { key: 'scouter.palette', value: 'golden-frieza' },
    ])
    await w.clock.advance(150)
    expect(w.seen.sets.at(-1)).toEqual({ key: 'shenron.palette', value: 'golden-frieza' })
    await ui.unmount()
  })

  test('the second new power is Super Saiyan Rose', async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6, 7], unlocked: ['golden-frieza'] })
    await $.session.start(START)
    await $.command.run(cmd('shenron'))
    const ui = await mountPane($, 'shenron', 'terminal')
    await ui.press({ key: 'wish-2' })
    expect(w.store.unlocked).toEqual(['golden-frieza', 'super-saiyan-rose'])
    await ui.unmount()
  })

  test('wish 1 compacts just after the press, then Shenron leaves', async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6, 7] })
    await $.session.start(START)
    await $.command.run(cmd('shenron'))
    const ui = await mountPane($, 'shenron', 'desktop')
    await ui.press({ key: 'wish-1' })
    expect(w.seen.compacts).toBe(0) // never under the press's own hook
    await w.clock.advance(150)
    expect(w.seen.compacts).toBe(1)
    expect(w.seen.panes).toContain('shenron')
    await w.clock.advance(3000)
    expect(w.seen.panes).not.toContain('shenron')
    expect(w.store.stars).toEqual([])
    expect(w.store.wishes).toBe(1)
    expect(w.seen.toasts.at(-1)).toBe('The Dragon Balls scattered across the Earth...  ·  Ki restored! (freed 146k tokens)')
    await ui.unmount()
  })

  test('wish 3 shares a tip from Haiku in the coil', async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6, 7] })
    const session = mock.session(on)
    await $.session.start(START)
    await $.command.run(cmd('shenron'))
    const ui = await mountPane($, 'shenron', 'terminal')
    await ui.press({ key: 'wish-3' })
    expect(w.seen.asked).toEqual(['claude-haiku-5-5'])
    expect(await ui.find({ type: 'Text', text: /Read the whole error, mortal\./ })).toBeDefined()
    expect(session.appended().some(row => JSON.stringify(row.message).includes("Shenron's wisdom"))).toBe(true)
    await w.clock.advance(9000)
    expect(w.seen.panes).not.toContain('shenron')
    expect(w.store.wishes).toBe(1)
    await ui.unmount()
  })

  test('wish 3 falls back to a built-in tip when the model does not answer', async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6, 7] })
    w.noTip()
    await $.session.start(START)
    await $.command.run(cmd('shenron'))
    const ui = await mountPane($, 'shenron', 'terminal')
    await ui.press({ key: 'wish-3' })
    // rng 0.1 picks the second built-in tip.
    expect(await ui.find({ type: 'Text', text: /CLAUDE\.md/ })).toBeDefined()
    await ui.unmount()
  })

  test('/shenron without seven balls says how many; preview shows him with the wishes disabled', async ($, on) => {
    const w = world(on, { stars: [1, 4, 6] })
    await $.session.start(START)
    expect((await $.command.run(cmd('shenron'))).text).toBe('Gather all seven Dragon Balls first. ●●●○○○○ 3/7')
    expect(w.seen.panes).not.toContain('shenron')
    const ran = await $.command.run(cmd('shenron', 'preview'))
    expect(ran.text).toContain('preview')
    expect(w.seen.panes).toContain('shenron')
    for (const surface of SURFACES) {
      const ui = await mountPane($, 'shenron', surface)
      expect(await ui.find({ type: 'Text', text: /I AM THE ETERNAL DRAGON\./ })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'wish-1' })).toBeUndefined()
      const disabled = await ui.find({ type: 'Text', text: /1: Restore my Ki/ })
      expect(disabled?.props.dimColor).toBe(true)
      expect(await ui.find({ type: 'Text', text: /preview · gather all seven/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /●●●○○○○ 3\/7/ })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'leave' })).toBeDefined()
      await ui.unmount()
    }
  })

  test('the animation shimmers while the pane is open and stops when it closes', async ($, on) => {
    const w = world(on, { stars: [1, 2, 3, 4, 5, 6, 7] })
    await $.session.start(START)
    await $.command.run(cmd('shenron', 'preview'))
    const ui = await mountPane($, 'shenron', 'terminal')
    const before = JSON.stringify(await ui.drawn())
    await w.clock.advance(600)
    const after = JSON.stringify(await ui.drawn())
    expect(after).not.toBe(before)
    await ui.press({ key: 'leave' })
    expect(w.seen.panes).not.toContain('shenron')
    await ui.unmount()
  })
})

describe('/dbztheme', () => {
  test('/dbztheme namek sets every DBZ palette row, its own last', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    const ran = await $.command.run(cmd('dbztheme', 'namek'))
    expect(ran.text).toBe('Transformed! Color scheme: Namek')
    expect(w.seen.toasts).toEqual(['Transformed! Color scheme: Namek'])
    expect(w.seen.sets).toEqual([
      { key: 'kamehameha.palette', value: 'namek' },
      { key: 'scouter.palette', value: 'namek' },
    ])
    await w.clock.advance(150)
    expect(w.seen.sets).toEqual([
      { key: 'kamehameha.palette', value: 'namek' },
      { key: 'scouter.palette', value: 'namek' },
      { key: 'shenron.palette', value: 'namek' },
    ])
  })

  test('a locked secret scheme is refused; labels work too', async ($, on) => {
    const w = world(on)
    await $.session.start(START)
    expect((await $.command.run(cmd('dbztheme', 'golden-frieza'))).text).toBe('Only Shenron can grant that power.')
    expect(w.seen.sets).toEqual([])
    expect((await $.command.run(cmd('dbztheme', 'Super Saiyan Blue'))).text).toBe(
      'Transformed! Color scheme: Super Saiyan Blue',
    )
    expect((await $.command.run(cmd('dbztheme', 'potara'))).text).toMatch(/^No color scheme called "potara"/)
  })

  test('the pane lists every scheme, secrets as ??? until a wish unlocks them', { options: { palette: 'vegeta' } }, async ($, on) => {
    const w = world(on, { unlocked: ['golden-frieza'] })
    await $.session.start(START)
    await $.command.run(cmd('dbztheme'))
    expect(w.seen.opened.at(-1)).toMatchObject({ id: 'dbztheme', focus: true, closeOnEscape: true })
    for (const surface of SURFACES) {
      const ui = await mountPane($, 'dbztheme', surface, 70)
      expect(await ui.find({ type: 'Button', key: 'theme-goku' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'theme-golden-frieza' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'theme-super-saiyan-rose' })).toBeUndefined()
      expect(await ui.find({ type: 'Text', text: /\?\?\? \(wish only\)/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /Vegeta ◀ current/ })).toBeDefined()
      await ui.unmount()
    }
    const ui = await mountPane($, 'dbztheme', 'terminal', 70)
    await ui.press({ key: 'theme-frieza' })
    expect(w.seen.toasts.at(-1)).toBe('Transformed! Color scheme: Frieza')
    expect(w.seen.sets[0]).toEqual({ key: 'kamehameha.palette', value: 'frieza' })
    await ui.unmount()
  })

  test('the panes draw in the palette', { options: { palette: 'namek' } }, async ($, on) => {
    world(on, { stars: [1, 2, 3, 4, 5, 6, 7] })
    await $.session.start(START)
    await $.command.run(cmd('shenron'))
    const ui = await mountPane($, 'shenron', 'terminal')
    expect((await ui.find({ type: 'Text', text: /I AM THE ETERNAL DRAGON/ }))?.props.color).toBe('#d4e157')
    await ui.unmount()
  })
})

describe('/dragonradar', () => {
  test('toggles a radar of held stars, blips and stats', { options: { findRate: 'frequent' } }, async ($, on) => {
    const w = world(on, { stars: [1, 3], finds: 9, wishes: 2 })
    await $.session.start(START)
    await techniques($, 4)
    expect((await $.command.run(cmd('dragonradar'))).text).toBe('Dragon Radar on.')
    for (const surface of SURFACES) {
      const ui = await mountPane($, 'dragonradar', surface, 44)
      expect(await ui.find({ type: 'Text', text: /DRAGON RADAR/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: '★1' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /★3/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: /•2/ })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Dragon Balls ★★☆☆☆☆☆ 2/7' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Lifetime finds 9 · Wishes granted 2' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Find rate frequent: 8% per tool call, sure by 15' })).toBeDefined()
      expect(await ui.find({ type: 'Text', text: 'Tool calls since the last find: 4' })).toBeDefined()
      expect(await ui.find({ type: 'Button', key: 'close' })).toBeDefined()
      await ui.unmount()
    }
    expect((await $.command.run(cmd('dragonradar'))).text).toBe('Dragon Radar off.')
    expect(w.seen.panes).not.toContain('dragonradar')
  })
})

describe('the coil art', () => {
  test('closes the loop at every size', () => {
    for (const [width, height] of [[44, 20], [50, 30], [66, 30], [76, 34], [120, 50], [30, 12], [12, 6]] as const) {
      const lines = frameText(dragonFrame(width, height, 3, 'glow'), '.')
      expect(lines, `${width}x${height}`).toHaveLength(height)
      for (const line of lines) expect(Array.from(line), `${width}x${height}: ${line}`).toHaveLength(width)
      if (width >= 44) {
        expect(lines[0]).toMatch(/▗▄▄/)
        expect(lines[height - 1]).toMatch(/▝▀▼▀/)
        for (const line of lines.slice(3, height - 3)) {
          expect(line.startsWith('▐'), line).toBe(true)
          expect(line.endsWith('▌'), line).toBe(true)
        }
      }
    }
  })
})
