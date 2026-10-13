import { atom, read, update } from 'claude-code'
import type { ConfigRow, EngineInterface, Register, Timer } from 'claude-code'

import type { ShenronBall, ShenronStats, ShenronSummon } from '../types'
import {
  BALL,
  STARS,
  ballStars,
  center,
  dotBar,
  dragonFrame,
  frameHeight,
  radarScreen,
  sky,
  starBar,
  wrap,
} from './art'
import type { RadarRole } from './art'
import { PALETTES, paletteOf } from './palettes'
import type { Palette } from './palettes'

const PANE_BALL = 'dragonball'
const PANE_RADAR = 'dragonradar'
const PANE_SHENRON = 'shenron'
const PANE_THEME = 'dbztheme'

const OWN_PALETTE_KEY = 'shenron.palette'
const PALETTE_KEYS = ['kamehameha.palette', 'scouter.palette', OWN_PALETTE_KEY]
const SECRET_ORDER = ['golden-frieza', 'super-saiyan-rose']

const ESCAPE_MS = 90_000
const FAREWELL_MS = 3000
/** A tip stays up long enough to be read before the pane closes. */
const TIP_FAREWELL_MS = 9000
/** The engine refuses some work under the hook that holds a command or a press: do it just after. */
const DEFER_MS = 150
/** Shenron's shimmer and blink: a little over 3 frames a second. */
const ANIM_MS = 300

/** What the summon pane asks for: inline rows, docked columns. */
const SUMMON_COLUMNS = 66
const SUMMON_ROWS = frameHeight(SUMMON_COLUMNS, 19)

const TIP_MODEL = 'claude-haiku-5-5'
const TIP_SYSTEM =
  'You are Shenron, the Eternal Dragon of Dragon Ball. You speak with ancient, booming grandeur, briefly.'
const TIP_PROMPT =
  'A mortal who codes with Claude Code (an AI coding assistant in the terminal) wished for your wisdom. ' +
  'Grant ONE short, practical, true tip about using Claude Code or about writing code, in your voice. ' +
  'At most two sentences and 40 words. No preamble, no quotes, no markdown.'

type RateName = 'rare' | 'normal' | 'frequent'
const RATES: Record<RateName, { chance: number; pity: number }> = {
  rare: { chance: 0.015, pity: 60 },
  normal: { chance: 0.03, pity: 40 },
  frequent: { chance: 0.08, pity: 15 },
}

const WISHES = [
  { n: 1, label: 'Restore my Ki', note: 'compact the conversation' },
  { n: 2, label: 'Grant me a new power', note: 'a secret color scheme' },
  { n: 3, label: 'Share your wisdom', note: 'a tip from the dragon' },
  { n: 4, label: 'Make me immortal', note: '' },
  { n: 5, label: 'Pet Shenron', note: '' },
] as const

const PET_LINES = [
  '...THE ETERNAL DRAGON... PURRS. TELL NO ONE.',
  'SHENRON IS NOT A HOUSE PET. (He leans into it anyway.)',
  'RRRRUMBLE. YES. BEHIND THE ANTLERS. THERE.',
  'IN TEN THOUSAND YEARS NO ONE HAS EVER DONE THAT.',
  'YOUR HAND IS WARM, MORTAL. NOW STATE YOUR WISH.',
  'The dragon’s whiskers curl happily.',
  '*contented dragon rumbling shakes the sky*',
]

const TIPS = [
  'Before you ask for code, ask for a plan. Shift+Tab into plan mode, mortal, and see the battle before you fight it.',
  'Write your laws in CLAUDE.md. What is written there, I remember in every session.',
  'When your Ki runs low, /compact. A Senzu Bean for the mind.',
  'A failing test is a scouter that does not lie. Write it first, then make it pass.',
  'Commit before every battle. Git remembers what you will forget.',
  'Name the files you speak of with @, and they are read at once.',
  'Press Esc to halt a technique gone astray. Press it twice to return to an earlier moment.',
  'Read an error to its very last line. The answer often hides there.',
  '/clear between unrelated quests. A fresh sky makes sharper wishes.',
  'Small functions, clear names. Even a dragon cannot read a thousand-line function.',
]

type Cfg = {
  palette: Palette
  rateName: RateName
  rate: { chance: number; pity: number }
  escape: boolean
  hintTail: boolean
  animate: boolean
}

const NO_STATS: ShenronStats = { finds: 0, wishes: 0, unlocked: [] }

const held = atom({ plugin: 'shenron', key: 'held' } as const, [])
const stats = atom({ plugin: 'shenron', key: 'stats' } as const, NO_STATS)
const ball = atom({ plugin: 'shenron', key: 'ball' } as const, null)
const sinceFind = atom({ plugin: 'shenron', key: 'sinceFind' } as const, 0)
const summonState = atom({ plugin: 'shenron', key: 'summon' } as const, null)
const tick = atom({ plugin: 'shenron', key: 'tick' } as const, 0)

// Module-level on purpose: a reload re-runs the module and drops these with the timers they guard.
let readying: Promise<void> | null = null
let animation: Timer | null = null
/** SHENRON_RNG (tests): a comma list of numbers the rolls take in turn; null when unset. */
let script: number[] | null | undefined
let scriptAt = 0

function ready($: EngineInterface): Promise<void> {
  readying ??= setUp($).catch(error => {
    readying = null // try again on the next event
    throw error
  })
  return readying
}

async function setUp($: EngineInterface): Promise<void> {
  // immediate: a ball turns up mid-turn, and a queued /grab would wait for the turn to end (it may flee by then).
  await $.command.register({ name: 'grab', description: 'Grab the Dragon Ball that just appeared', immediate: true })
  await $.command.register({
    name: 'shenron',
    description: 'Summon Shenron with all seven Dragon Balls (/shenron preview: just look at him)',
    argumentHint: '[preview]',
  })
  await $.command.register({
    name: 'dragonradar',
    description: 'Toggle the Dragon Radar: your Dragon Balls, finds and wishes',
    immediate: true,
  })
  await $.command.register({
    name: 'dbztheme',
    description: 'Pick the color scheme of every DBZ mod (kamehameha, scouter, shenron)',
    argumentHint: '[name]',
  })
  const stars = cleanStars(await $.store.get('stars'))
  const loaded: ShenronStats = {
    finds: count(await $.store.get('finds')),
    wishes: count(await $.store.get('wishes')),
    unlocked: strings(await $.store.get('unlocked')),
  }
  await update($, held, () => stars)
  await update($, stats, () => loaded)
}

function cleanStars(value: unknown): number[] {
  if (!Array.isArray(value)) return []
  const stars = value.filter((n): n is number => Number.isInteger(n) && n >= 1 && n <= STARS)
  return [...new Set(stars)].sort((a, b) => a - b)
}

function count(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.floor(value) : 0
}

function strings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((s): s is string => typeof s === 'string') : []
}

/** A number in [0, 1): Math.random, or the next of SHENRON_RNG's numbers when a test sets it. */
async function roll($: EngineInterface): Promise<number> {
  if (script === undefined) {
    let raw: string | undefined
    try {
      raw = await $.env.get('SHENRON_RNG')
    } catch {
      raw = undefined
    }
    const numbers = (raw ?? '')
      .split(',')
      .map(s => Number(s.trim()))
      .filter(n => Number.isFinite(n) && n >= 0 && n < 1)
    script = numbers.length > 0 ? numbers : null
  }
  if (script === null) return Math.random()
  const value = script[scriptAt % script.length]!
  scriptAt += 1
  return value
}

function pick<T>(list: readonly T[], r: number): T {
  return list[Math.min(list.length - 1, Math.floor(r * list.length))]!
}

// ---------------------------------------------------------------- finding and grabbing

/** After each main-thread tool call: maybe a Dragon Ball turns up. */
async function afterTechnique($: EngineInterface, cfg: Cfg): Promise<void> {
  const now = await $.clock.now()
  const out = await read($, ball)
  if (out !== null) {
    if (cfg.escape && now - out.appearedAt >= ESCAPE_MS) await flee($, out)
    return
  }
  const have = await read($, held)
  if (have.length >= STARS) return // all seven: Shenron is waiting
  const calls = await update($, sinceFind, n => n + 1)
  const r = await roll($)
  if (r >= cfg.rate.chance && calls < cfg.rate.pity) return
  const missing = [1, 2, 3, 4, 5, 6, 7].filter(star => !have.includes(star))
  await appear($, cfg, pick(missing, await roll($)), now)
}

async function appear($: EngineInterface, cfg: Cfg, star: number, now: number): Promise<void> {
  const found: ShenronBall = { star, appearedAt: now }
  let isMine = false
  await update($, ball, was => {
    isMine = was === null
    return was ?? found
  })
  if (!isMine) return // a parallel tool call found one first
  await update($, sinceFind, () => 0)
  const finds = count(await $.store.get('finds')) + 1
  await $.store.set('finds', finds)
  await update($, stats, s => ({ ...s, finds }))
  $.ui.toast(`✨ A Dragon Ball appeared! The ${star}-Star Ball, grab it! (/grab)`, { timeoutMs: 8000 })
  const opened = await $.ui.open({ id: PANE_BALL, title: 'Dragon Ball', rows: 4 })
  // Unasked on a narrow terminal it would wait and pop up later: the toast and /grab are enough.
  if (!opened.isPlaced) await $.ui.close({ id: PANE_BALL })
  if (cfg.escape) $.clock.after(ESCAPE_MS, () => void fleeIfDue($, found))
}

async function fleeIfDue($: EngineInterface, found: ShenronBall): Promise<void> {
  const out = await read($, ball)
  if (out !== null && out.appearedAt === found.appearedAt && out.star === found.star) await flee($, out)
}

async function flee($: EngineInterface, out: ShenronBall): Promise<void> {
  let isMine = false
  await update($, ball, was => {
    isMine = was !== null && was.appearedAt === out.appearedAt
    return isMine ? null : was
  })
  if (!isMine) return
  await $.ui.close({ id: PANE_BALL })
  $.ui.toast(`The ${out.star}-Star Dragon Ball flew away...`, { timeoutMs: 6000 })
}

/** Collects the ball that is out; the 7th summons Shenron. Answers what to say. */
async function grab($: EngineInterface, cfg: Cfg): Promise<string> {
  const out = await read($, ball)
  if (out === null) return 'No Dragon Ball in sight. Keep working: one will turn up.'
  let isMine = false
  await update($, ball, was => {
    isMine = was !== null && was.appearedAt === out.appearedAt
    return isMine ? null : was
  })
  if (!isMine) return 'Too late: that Dragon Ball is gone.'
  const stars = cleanStars([...(await read($, held)), out.star])
  await $.store.set('stars', stars)
  await update($, held, () => stars)
  await $.ui.close({ id: PANE_BALL })
  const got = `Got the ${out.star}-Star Dragon Ball! ${starBar(stars.length)} ${stars.length}/${STARS}`
  if (stars.length < STARS) {
    $.ui.toast(got, { timeoutMs: 6000 })
    return got
  }
  const summoned = 'The sky darkens... SHENRON HAS BEEN SUMMONED!'
  $.ui.toast(`${got}  ·  ${summoned}`, { timeoutMs: 10_000 })
  await summon($, cfg, 'summon')
  return `${got} ${summoned}`
}

// ---------------------------------------------------------------- Shenron

async function summon($: EngineInterface, cfg: Cfg, mode: ShenronSummon['mode']) {
  const fresh: ShenronSummon = { mode, phase: 'ask', lines: [], tone: 'speech', eye: 'glow' }
  await update($, summonState, () => fresh)
  if (cfg.animate) startAnimation($)
  return $.ui.open({
    id: PANE_SHENRON,
    title: 'Shenron',
    focus: true,
    closeOnEscape: true,
    holdToasts: true,
    rows: SUMMON_ROWS,
    columns: SUMMON_COLUMNS,
  })
}

function startAnimation($: EngineInterface): void {
  if (animation !== null) return
  animation = $.clock.every(ANIM_MS, () => void animate($))
}

function stopAnimation(): void {
  animation?.cancel()
  animation = null
}

async function animate($: EngineInterface): Promise<void> {
  if ((await read($, summonState)) === null) {
    stopAnimation()
    return
  }
  await update($, tick, n => (n + 1) % 1_000_000)
}

async function say(
  $: EngineInterface,
  change: Partial<ShenronSummon>,
): Promise<void> {
  await update($, summonState, was => (was === null ? was : { ...was, ...change }))
}

async function wish($: EngineInterface, cfg: Cfg, n: number): Promise<void> {
  const s = await read($, summonState)
  if (s === null || s.mode !== 'summon' || s.phase !== 'ask') return
  const now = await $.clock.now()
  if (n === 1) {
    await say($, { phase: 'granted', tone: 'grant', eye: 'glow', lines: ['YOUR WISH HAS BEEN GRANTED. FAREWELL!'] })
    $.clock.after(DEFER_MS, () => void restoreKi($, now))
  } else if (n === 2) {
    const power = await newPower($, cfg)
    await say($, {
      phase: 'granted',
      tone: 'grant',
      eye: 'glow',
      lines: [`A NEW POWER AWAKENS: ${power.label.toUpperCase()}!`, 'YOUR WISH HAS BEEN GRANTED. FAREWELL!'],
    })
    $.clock.after(FAREWELL_MS, () => void farewell($, [`Transformed! Color scheme: ${power.label}`], power.name))
  } else if (n === 3) {
    await say($, { phase: 'thinking', tone: 'speech', eye: 'glow', lines: ['THE ETERNAL DRAGON PONDERS...'] })
    const tip = await wisdom($)
    await say($, { phase: 'granted', tone: 'grant', lines: [tip, '', 'YOUR WISH HAS BEEN GRANTED. FAREWELL!'] })
    try {
      await $.session.append({ message: { type: 'system', content: [{ type: 'text', text: `🐉 Shenron's wisdom: ${tip}` }] } })
    } catch {
      // The coil showed it; a session that takes no notice row is fine.
    }
    $.clock.after(TIP_FAREWELL_MS, () => void farewell($, [], null))
  } else if (n === 4) {
    await say($, { tone: 'refuse', eye: 'angry', lines: ['THAT IS BEYOND MY POWER.', 'Make another wish.'] })
  } else if (n === 5) {
    await say($, { tone: 'pet', eye: 'happy', lines: [pick(PET_LINES, await roll($))] })
  }
}

/** Wish 1: a Senzu Bean for the whole conversation, compacted just after the press lets go. */
async function restoreKi($: EngineInterface, startedAt: number): Promise<void> {
  let line: string
  try {
    const result = await $.session.compact()
    if (result.skip !== undefined) throw new Error(result.skip)
    line =
      result.tokensBefore !== undefined && result.tokensAfter !== undefined
        ? `Ki restored! (freed ${short(result.tokensBefore - result.tokensAfter)} tokens)`
        : 'Ki restored!'
  } catch (error) {
    const why = error instanceof Error ? error.message : String(error)
    await say($, { phase: 'ask', tone: 'refuse', eye: 'angry', lines: ['YOUR KI COULD NOT BE RESTORED:', why, 'Make another wish.'] })
    return
  }
  const left = Math.max(0, startedAt + FAREWELL_MS - (await $.clock.now()))
  $.clock.after(left, () => void farewell($, [line], null))
}

/** Wish 2: golden-frieza, then super-saiyan-rose, then any other scheme. Unlocks it at once. */
async function newPower($: EngineInterface, cfg: Cfg): Promise<Palette> {
  const s = await read($, stats)
  const secret = SECRET_ORDER.find(name => !s.unlocked.includes(name))
  const name = secret ?? pick(PALETTES.filter(p => p.name !== cfg.palette.name), await roll($)).name
  const power = paletteOf(name)
  if (power.isSecret && !s.unlocked.includes(name)) {
    const unlocked = [...s.unlocked, name]
    await $.store.set('unlocked', unlocked)
    await update($, stats, was => ({ ...was, unlocked }))
  }
  return power
}

/** Wish 3: a tip from a small model in Shenron's voice, or a built-in one. */
async function wisdom($: EngineInterface): Promise<string> {
  try {
    const result = await $.model.complete({
      model: TIP_MODEL,
      system: TIP_SYSTEM,
      prompt: TIP_PROMPT,
      maxTokens: 120,
      timeoutMs: 20_000,
    })
    if (result.isAnswered) {
      const text = result.text.replace(/\s+/g, ' ').replace(/^["'“]+|["'”]+$/g, '').trim()
      if (text !== '') return text.length > 320 ? `${text.slice(0, 317)}...` : text
    }
  } catch {
    // A blocked model: fall back to the dragon's own sayings.
  }
  return pick(TIPS, await roll($))
}

/** A granted wish: the pane closes, the balls scatter, the wish counts; a new power applies last. */
async function farewell($: EngineInterface, extra: string[], paletteName: string | null): Promise<void> {
  await update($, summonState, () => null)
  stopAnimation()
  await $.ui.close({ id: PANE_SHENRON })
  const wishes = count(await $.store.get('wishes')) + 1
  await $.store.set('stars', [])
  await $.store.set('wishes', wishes)
  await update($, held, () => [])
  await update($, stats, s => ({ ...s, wishes }))
  $.ui.toast(['The Dragon Balls scattered across the Earth...', ...extra].join('  ·  '), { timeoutMs: 8000 })
  if (paletteName !== null) await setPaletteRows($, paletteName)
}

// ---------------------------------------------------------------- color schemes

/** Finds a palette by name or label (`super saiyan blue`, `Super-Saiyan-Blue`). */
function paletteNamed(arg: string): Palette | undefined {
  const want = arg.trim().toLowerCase().replace(/[\s_]+/g, '-')
  return PALETTES.find(p => p.name === want || p.label.toLowerCase().replace(/\s+/g, '-') === want)
}

/** /dbztheme <name> and the pane's buttons: the refusal, or the toast and every mod's row set. */
async function applyTheme($: EngineInterface, palette: Palette): Promise<string> {
  const s = await read($, stats)
  if (palette.isSecret && !s.unlocked.includes(palette.name)) return 'Only Shenron can grant that power.'
  const text = `Transformed! Color scheme: ${palette.label}`
  // Toast first: setting this mod's own row reloads this module.
  $.ui.toast(text, { timeoutMs: 6000 })
  await setPaletteRows($, palette.name)
  return text
}

/** Sets `palette` on kamehameha, scouter and shenron (those loaded and offering it); this mod's own last. */
async function setPaletteRows($: EngineInterface, name: string): Promise<void> {
  let rows: ConfigRow[]
  try {
    rows = await $.config.list()
  } catch {
    return
  }
  const targets = rows.filter(row => PALETTE_KEYS.includes(row.key) && (row.options ?? []).includes(name))
  for (const row of targets) {
    if (row.key === OWN_PALETTE_KEY || row.value === name) continue
    try {
      await $.config.set({ key: row.key, value: name })
    } catch {
      // A row that went away since the list: the others still change.
    }
  }
  if (targets.some(row => row.key === OWN_PALETTE_KEY && row.value !== name)) {
    $.clock.after(DEFER_MS, () => void setOwnPalette($, name))
  }
}

async function setOwnPalette($: EngineInterface, name: string): Promise<void> {
  try {
    await $.config.set({ key: OWN_PALETTE_KEY, value: name })
  } catch {
    // Nothing more to do: the other mods already changed.
  }
}

// ---------------------------------------------------------------- panes

async function togglePane($: EngineInterface, id: string, open: () => Promise<unknown>): Promise<boolean> {
  const panes = await $.ui.panes()
  if (panes.some(pane => pane.id === id)) {
    await $.ui.close({ id })
    return false
  }
  await open()
  return true
}

function short(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1000) return `${Math.round(n / 1000)}k`
  return String(n)
}

function percent(chance: number): string {
  return `${Math.round(chance * 1000) / 10}%`
}

/** One line inside Shenron's coil. */
type Inside =
  | { kind: 'text'; text: string; color?: string; bold?: boolean; dim?: boolean }
  | { kind: 'wish'; n: number; label: string; note: string; isOpen: boolean }
  | { kind: 'leave' }

function insideLines(s: ShenronSummon, have: number, inner: number, p: Palette): Inside[] {
  const blank: Inside = { kind: 'text', text: '' }
  const lines: Inside[] = []
  const balls =
    s.mode === 'summon' || have >= STARS
      ? '★ ★ ★ ★ ★ ★ ★'
      : `${dotBar(have)} ${have}/${STARS}`
  lines.push({ kind: 'text', text: balls, color: BALL.orange, bold: true })
  lines.push(blank)
  lines.push({ kind: 'text', text: 'I AM THE ETERNAL DRAGON.', color: p.gold, bold: true })
  lines.push({ kind: 'text', text: 'STATE YOUR WISH.', color: p.gold, bold: true })
  lines.push(blank)
  const isOpen = s.mode === 'summon' && s.phase === 'ask'
  for (const w of WISHES) lines.push({ kind: 'wish', n: w.n, label: w.label, note: w.note, isOpen })
  lines.push(blank)
  const toneColor = s.tone === 'refuse' ? p.danger : s.tone === 'speech' ? p.beam : p.gold
  for (const said of s.lines) {
    for (const text of wrap(said, inner - 2)) {
      lines.push({ kind: 'text', text, color: toneColor, bold: s.tone !== 'speech' && s.tone !== 'pet' })
    }
  }
  if (s.lines.length > 0) lines.push(blank)
  const footer =
    s.mode === 'preview'
      ? 'preview · gather all seven Dragon Balls to make a wish'
      : 'Esc to leave: the Dragon Balls stay with you'
  for (const text of wrap(footer, inner - 2)) lines.push({ kind: 'text', text, dim: true })
  lines.push({ kind: 'leave' })
  return lines
}

function wishWidth(inner: number): { width: number; withNotes: boolean } {
  const full = Math.max(...WISHES.map(w => 3 + w.label.length + (w.note ? 3 + w.note.length : 0)))
  if (full <= inner) return { width: full, withNotes: true }
  return { width: Math.max(...WISHES.map(w => 3 + w.label.length)), withNotes: false }
}

export const register: Register = (on, options) => {
  const rateName: RateName = options.findRate === 'rare' || options.findRate === 'frequent' ? options.findRate : 'normal'
  const cfg: Cfg = {
    palette: paletteOf(options.palette),
    rateName,
    rate: RATES[rateName],
    escape: options.ballEscape !== false,
    hintTail: options.hintTail !== false,
    animate: options.shenronAnimation !== false,
  }
  readying = null
  script = undefined
  scriptAt = 0
  animation = null

  on('session.start', async ($, e, next) => {
    await ready($)
    return next(e)
  })

  // A reload (a /dbztheme switch) drops this module's commands' backing: re-register on the next prompt.
  on('turn.start', async ($, e, next) => {
    await ready($)
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const ran = await next(e)
    if (e.agentId === undefined) {
      await ready($)
      await afterTechnique($, cfg)
    }
    return ran
  }).catch(($, e, next) => next(e)) // a dice roll, never a guard: the call always goes on

  on('ui.close', { id: PANE_SHENRON }, async ($, e, next) => {
    const closed = await next(e)
    stopAnimation()
    await update($, summonState, () => null)
    return closed
  }).catch(($, e, next) => next(e))

  on('command.run', { command: 'grab' }, async $ => {
    await ready($)
    return { text: await grab($, cfg) }
  })

  on('command.run', { command: 'shenron' }, async ($, e) => {
    await ready($)
    if (e.args.trim().toLowerCase() === 'preview') {
      await summon($, cfg, 'preview')
      return { text: 'Shenron rises (preview): gather all seven Dragon Balls to make a wish.' }
    }
    const have = (await read($, held)).length
    if (have < STARS) return { text: `Gather all seven Dragon Balls first. ${dotBar(have)} ${have}/${STARS}` }
    await summon($, cfg, 'summon')
    return { text: 'The sky darkens... SHENRON HAS BEEN SUMMONED!' }
  })

  on('command.run', { command: 'dragonradar' }, async $ => {
    await ready($)
    const isOpen = await togglePane($, PANE_RADAR, () =>
      $.ui.open({ id: PANE_RADAR, title: 'Dragon Radar', focus: true, rows: 26, columns: 44 }),
    )
    return { text: isOpen ? 'Dragon Radar on.' : 'Dragon Radar off.' }
  })

  on('command.run', { command: 'dbztheme' }, async ($, e) => {
    await ready($)
    const arg = e.args.trim()
    if (arg === '') {
      await $.ui.open({ id: PANE_THEME, title: 'DBZ color schemes', focus: true, closeOnEscape: true, rows: 16 })
      return { text: 'Pick a color scheme for every DBZ mod.' }
    }
    const palette = paletteNamed(arg)
    if (palette === undefined) {
      return { text: `No color scheme called "${arg}". Try: ${PALETTES.map(p => p.name).join(', ')}.` }
    }
    return { text: await applyTheme($, palette) }
  })

  if (cfg.hintTail) {
    on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
      const [have, out] = await Promise.all([read($, held), read($, ball)])
      const extra = out !== null ? ' ✨ /grab' : have.length >= STARS ? ' /shenron' : ''
      const mine = `🐉 ${dotBar(have.length)}${extra}`
      return next({ ...e, props: { ...e.props, tail: e.props.tail ? `${e.props.tail}  ${mine}` : `  ${mine}` } })
    })
  }

  // ------------------------------------------------------------ the Dragon Ball pane
  on('ui.render', { component: 'Pane', requestId: PANE_BALL }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = cfg.palette
    const out = await read($, ball)
    if (out === null) return <Text dimColor>The Dragon Ball is gone.</Text>
    const [upper, lower] = ballStars(out.star)
    return (
      <Box flexDirection="row" columnGap={2}>
        <Box flexDirection="column" flexShrink={0}>
          <Text color={BALL.orange}> ▄▄▄▄▄▄▄ </Text>
          <Box flexDirection="row">
            <Text color={BALL.orange}>█</Text>
            <Text color={BALL.star} backgroundColor={BALL.orange} bold>
              {upper}
            </Text>
            <Text color={BALL.orange}>█</Text>
          </Box>
          <Box flexDirection="row">
            <Text color={BALL.orange}>█</Text>
            <Text color={BALL.star} backgroundColor={BALL.orange} bold>
              {lower}
            </Text>
            <Text color={BALL.orange}>█</Text>
          </Box>
          <Text color={BALL.orange}> ▀▀▀▀▀▀▀ </Text>
        </Box>
        <Box flexDirection="column">
          <Text color={p.gold} bold>
            ✨ A Dragon Ball appeared!
          </Text>
          <Text color={p.beam}>{`The ${out.star}-Star Ball ( ${'★'.repeat(out.star)} )`}</Text>
          <Button key="grab" label="Grab it" hotkey="g" variant="primary" onPress={() => void grab($, cfg)} />
          <Text dimColor>{cfg.escape ? 'It flies away in 90 s · /grab' : 'It waits for you · /grab'}</Text>
        </Box>
      </Box>
    )
  })

  // ------------------------------------------------------------ the Dragon Radar
  on('ui.render', { component: 'Pane', requestId: PANE_RADAR }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = cfg.palette
    const [have, s, out, since] = await Promise.all([read($, held), read($, stats), read($, ball), read($, sinceFind)])
    const screen = radarScreen(e.props.bodyColumns, have, out?.star ?? null)
    const colorOf = (role: RadarRole) =>
      role === 'held' || role === 'you' ? p.gold : role === 'out' ? p.danger : p.readout
    return (
      <Box flexDirection="column">
        <Text bold color={p.heading}>
          ◢ DRAGON RADAR ◣
        </Text>
        <Box flexDirection="column" marginTop={1}>
          {screen.map(row => {
            const segs: { text: string; role: RadarRole }[] = []
            for (const cell of row) {
              const last = segs[segs.length - 1]
              if (last !== undefined && last.role === cell.role) last.text += cell.text
              else segs.push({ text: cell.text, role: cell.role })
            }
            return (
              <Box flexDirection="row">
                {segs.map(seg => (
                  <Text
                    color={colorOf(seg.role)}
                    dimColor={seg.role === 'grid' || seg.role === 'blip'}
                    bold={seg.role === 'held' || seg.role === 'out' || seg.role === 'you'}
                  >
                    {seg.text}
                  </Text>
                ))}
              </Box>
            )
          })}
        </Box>
        <Box flexDirection="column" marginTop={1}>
          <Text color={p.gold} bold>{`Dragon Balls ${starBar(have.length)} ${have.length}/${STARS}`}</Text>
          <Text color={p.readout}>{`Lifetime finds ${s.finds} · Wishes granted ${s.wishes}`}</Text>
          <Text color={p.readout}>
            {`Find rate ${cfg.rateName}: ${percent(cfg.rate.chance)} per tool call, sure by ${cfg.rate.pity}`}
          </Text>
          <Text color={p.readout}>{`Tool calls since the last find: ${since}`}</Text>
          {out !== null && <Text color={p.danger} bold>{`The ${out.star}-Star Ball is out! /grab`}</Text>}
          {have.length >= STARS && <Text color={p.danger} bold>All seven! /shenron</Text>}
        </Box>
        <Box marginTop={1}>
          <Button key="close" label="Close" role="dismiss" onPress={() => void $.ui.close({ id: PANE_RADAR })} />
        </Box>
      </Box>
    )
  })

  // ------------------------------------------------------------ /dbztheme
  on('ui.render', { component: 'Pane', requestId: PANE_THEME }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const s = await read($, stats)
    const current = cfg.palette
    return (
      <Box flexDirection="column">
        <Box flexDirection="row" flexWrap="wrap" columnGap={2}>
          <Text bold color={current.heading}>
            ⚡ COLOR SCHEMES
          </Text>
          <Text dimColor>for kamehameha, scouter and shenron</Text>
        </Box>
        <Box flexDirection="column" marginTop={1}>
          {PALETTES.map((pal, i) => {
            const hotkey = String((i + 1) % 10)
            if (pal.isSecret && !s.unlocked.includes(pal.name)) {
              return <Text dimColor>{`${hotkey}: ░░░░░░░░░░░░ ??? (wish only)`}</Text>
            }
            const isCurrent = pal.name === current.name
            return (
              <Button key={`theme-${pal.name}`} plain hotkey={hotkey} onPress={() => void chooseTheme($, pal)}>
                <Text color={pal.ki}>███</Text>
                <Text color={pal.heading}>███</Text>
                <Text color={pal.gold}>███</Text>
                <Text color={pal.danger}>███</Text>
                <Text bold color={isCurrent ? current.gold : undefined}>{` ${pal.label}${isCurrent ? ' ◀ current' : ''}`}</Text>
                <Text dimColor>{`  ${pal.tagline}`}</Text>
              </Button>
            )
          })}
        </Box>
        <Box marginTop={1}>
          <Button key="close" label="Close" role="dismiss" onPress={() => void $.ui.close({ id: PANE_THEME })} />
        </Box>
      </Box>
    )
  })

  // ------------------------------------------------------------ Shenron, coiled around the pane
  on('ui.render', { component: 'Pane', requestId: PANE_SHENRON }, async ($, e) => {
    const { Box, Text, Button } = $.ui.resolve(e)
    const p = cfg.palette
    const have = (await read($, held)).length
    const s: ShenronSummon = (await read($, summonState)) ?? {
      mode: have >= STARS ? 'summon' : 'preview',
      phase: 'ask',
      lines: [],
      tone: 'speech',
      eye: 'glow',
    }
    const frameTick = cfg.animate ? await read($, tick) : 0
    const W = Math.max(12, e.props.bodyColumns)
    const probe = dragonFrame(W, 40, 0, 'glow')
    const lines = insideLines(s, have, probe.inner, p)
    const H = Math.max(frameHeight(W, lines.length), Math.min(e.props.scroll.bodyRows, 80))
    const frame = dragonFrame(W, H, frameTick, s.eye)
    const top = Math.max(0, Math.floor((frame.content.length - lines.length) / 2))
    const at = new Map<number, Inside>()
    lines.forEach((line, i) => {
      const row = frame.content[top + i]
      if (row !== undefined) at.set(row, line)
    })
    const wishes = wishWidth(frame.inner)
    const pad = Math.max(0, Math.floor((frame.inner - wishes.width) / 2))

    const slot = (line: Inside | undefined, width: number, r: number) => {
      if (line === undefined || (line.kind === 'text' && line.text === '')) {
        return (
          <Text color={p.frame} dimColor>
            {sky(r, width, frameTick)}
          </Text>
        )
      }
      if (line.kind === 'text') {
        return (
          <Text color={line.color} bold={line.bold} dimColor={line.dim} wrap="truncate">
            {center(line.text, width)}
          </Text>
        )
      }
      if (line.kind === 'leave') {
        return (
          <Box width={width} justifyContent="center">
            <Button key="leave" label={s.mode === 'preview' ? 'Close' : 'Leave'} role="dismiss" onPress={() => void $.ui.close({ id: PANE_SHENRON })} />
          </Box>
        )
      }
      const note = wishes.withNotes && line.note ? `  · ${line.note}` : ''
      if (!line.isOpen) {
        return <Text dimColor wrap="truncate">{`${' '.repeat(pad)}${line.n}: ${line.label}${note}`.padEnd(width)}</Text>
      }
      return (
        <Box width={width} paddingLeft={pad}>
          <Button key={`wish-${line.n}`} plain hotkey={String(line.n)} onPress={() => void wish($, cfg, line.n)}>
            <Text color={p.beam} bold>
              {line.label}
            </Text>
            <Text dimColor>{note}</Text>
          </Button>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" width={W}>
        {frame.rows.map((row, r) => (
          <Box flexDirection="row" width={W}>
            {row.left.map(seg => (
              <Text color={seg.color} bold={seg.bold}>
                {seg.text}
              </Text>
            ))}
            {row.hole > 0 && (
              <Box width={row.hole} flexShrink={0}>
                {slot(at.get(r), row.hole, r)}
              </Box>
            )}
            {row.right.map(seg => (
              <Text color={seg.color} bold={seg.bold}>
                {seg.text}
              </Text>
            ))}
          </Box>
        ))}
      </Box>
    )
  })
}

async function chooseTheme($: EngineInterface, palette: Palette): Promise<void> {
  const text = await applyTheme($, palette)
  if (text.startsWith('Only')) $.ui.toast(text, { timeoutMs: 5000 })
}
