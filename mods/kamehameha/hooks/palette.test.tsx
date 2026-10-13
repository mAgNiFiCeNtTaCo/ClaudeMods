import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { PALETTE_NAMES, gaugeColorOf, paletteOf } from './palettes'

const SURFACES = ['terminal', 'desktop'] as const
const NOW = 1_000_000_000

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

// 63% Ki: the gauge's gold band.
const CONTEXT = { window: 200000, tokens: 126000, percent: 63 }

function engine(on: On) {
  on('session.usage', () => ({ value: { startedAt: 0, context: CONTEXT, rateLimits: [] } }))
  on('session.measure', ($, e) => ({ changed: e.changed }))
}

const mountAll = ($: any) => Promise.all(SURFACES.map(surface => $.ui.mount({ ...BAND, surface })))
const colorOf = async (ui: any, text: RegExp | string) => (await ui.find({ type: 'Text', text }))?.props.color

test('the palette table: goku is the classic theme, unknown names fall back to it', () => {
  const goku = paletteOf('goku')
  expect(goku.ki).toBe('#4fc3ff')
  expect(goku.heading).toBe('#ff7a00')
  expect(paletteOf('cell')).toBe(goku)
  expect(paletteOf(undefined)).toBe(goku)
  expect(PALETTE_NAMES[1]).toBe('vegeta')
  expect(gaugeColorOf(goku, 63)).toBe(goku.gold)
  expect(gaugeColorOf(goku, 90)).toBe(goku.danger)
})

test('palette namek colors the headings and the gauge', { options: { palette: 'namek' } }, async ($, on) => {
  engine(on)
  mock.clock(on, { now: NOW })
  await $.session.measure({ context: CONTEXT, rateLimits: [], changed: ['context'] })
  const namek = paletteOf('namek')
  for (const ui of await mountAll($)) {
    expect(await colorOf(ui, 'KI')).toBe(namek.heading)
    expect(await colorOf(ui, ' 63%')).toBe(namek.gold)
  }
})

test('an unknown palette falls back to goku', { options: { palette: 'cell' } }, async ($, on) => {
  engine(on)
  mock.clock(on, { now: NOW })
  await $.session.measure({ context: CONTEXT, rateLimits: [], changed: ['context'] })
  for (const ui of await mountAll($)) {
    expect(await colorOf(ui, 'KI')).toBe('#ff7a00')
    expect(await colorOf(ui, ' 63%')).toBe('#ffd400')
  }
})
