// Shenron's drawings as plain data: the dragon coiled around the summon pane, the Dragon Radar and the
// Dragon Ball. Pure functions (no $), so a test can dump them as text and look at them.

/** Shenron's own colors: they stay dragon green whatever the palette. */
export const DRAGON = {
  body: '#2e8b57',
  scale: '#3cb371',
  shine: '#a6ffcb',
  belly: '#c9d77a',
  eye: '#ff3b30',
  eyeGlow: '#ff8a7a',
  eyeAngry: '#ff1a1a',
  horn: '#eadfb4',
  whisker: '#cdeed6',
  teeth: '#f6f3e8',
} as const

/** A Dragon Ball's orange and its red stars. */
export const BALL = { orange: '#ff9a1f', star: '#e3170a' } as const

export const STARS = 7

/** One run of same-colored characters. */
export type Seg = { text: string; color?: string; bold?: boolean; dim?: boolean }

/**
 * One row of the coil: frame cells, then (when `hole` > 0) a slot that many cells wide for the
 * content inside the coil, then more frame cells.
 */
export type FrameRow = { left: Seg[]; hole: number; right: Seg[] }

export type Eye = 'glow' | 'happy' | 'angry'

export type Frame = {
  rows: FrameRow[]
  /** Rows whose slot is the full inner width, top to bottom: where the content goes. */
  content: number[]
  /** Width of a content row's slot. */
  inner: number
}

/** Rows the big coil spends on itself (head and top band, claws and bottom band). */
export const FRAME_ROWS = 11
/** Columns the coil spends on itself (a 4-wide band and a 1-cell gap on each side). */
export const FRAME_COLUMNS = 10
/** The narrowest pane the full dragon (head, antlers, claws) fits; below it a plain coil. */
export const FULL_ART_COLUMNS = 44

type Cell = { ch: string; color?: string; bold?: boolean }

const HEAD: readonly { art: string; colors: string }[] = [
  // h horn, b body, s scale, e eye, t teeth, g belly
  { art: '      ╲│╱  ╲│╱     ', colors: '      hhh  hhh     ' },
  { art: '    ▗▄▄█▄▄▄▄█▄▄▖   ', colors: '    bbbhbbbbhbbb   ' },
  { art: '  ▄▟▓▓◢◉◣▓▓▓▓▒▓▒▓▙ ', colors: '  bbssbebssssssssb ' },
  { art: '◀▆█▓▓▓▓▓▓▓▓▒▓▒▓▒▓▓▌', colors: 'bbbsssssssssssssssb' },
  { art: ' ▜▼▼▼▼▀▀▀▀▀▀▀▀▀▜▓▒▌', colors: ' bttttgggggggggbssb' },
  { art: '               ▐▓▒▌', colors: '               gssb' },
]
const HEAD_WIDTH = 19

const PET_EYES: Record<Eye, string> = { glow: '◉', happy: '^', angry: '◉' }

function blank(width: number, height: number): Cell[][] {
  return Array.from({ length: height }, () => Array.from({ length: width }, () => ({ ch: ' ' }) as Cell))
}

function put(g: Cell[][], row: number, col: number, text: string, color?: string, bold?: boolean): void {
  const line = g[row]
  if (line === undefined) return
  let c = col
  for (const ch of Array.from(text)) {
    if (c >= 0 && c < line.length) line[c] = { ch, color, bold }
    c += 1
  }
}

function runs(cells: readonly Cell[]): Seg[] {
  const out: Seg[] = []
  for (const cell of cells) {
    const last = out[out.length - 1]
    const color = cell.ch === ' ' ? last?.color : cell.color
    if (last !== undefined && last.color === color && last.bold === cell.bold) last.text += cell.ch
    else out.push(cell.bold ? { text: cell.ch, color, bold: true } : { text: cell.ch, color })
  }
  return out
}

/**
 * Shenron coiled around a pane `width` x `height` cells: head with antlers, whiskers and red eyes at
 * the top right, the body down the right side, along the bottom (a claw at each bottom corner), up
 * the left side and along the top, its tail tapering off just before the head. `tick` moves the
 * shimmer along the scales and blinks the eye.
 */
export function dragonFrame(width: number, height: number, tick: number, eye: Eye): Frame {
  if (width < FULL_ART_COLUMNS || height < FRAME_ROWS + 1) return plainCoil(width, Math.max(height, 3), tick, eye)
  const W = width
  const H = height
  const g = blank(W, H)
  const hx = W - HEAD_WIDTH
  // The shimmer runs along the body: p is a cell's place along the loop.
  const shine = (p: number) => (((p - tick * 2) % 18) + 18) % 18 < 2
  const scale = (p: number, ch: string) => ({ ch, color: shine(p) ? DRAGON.shine : DRAGON.scale })
  const setScale = (row: number, col: number, p: number, ch: string) => {
    const line = g[row]
    if (line !== undefined && col >= 0 && col < W) line[col] = scale(p, ch)
  }
  const checker = (row: number, col: number) => ((row + col) % 2 === 0 ? '▓' : '▒')
  // Loop positions: down the right side, back along the bottom, up the left, along the top.
  const pRight = (row: number) => row
  const pBottom = (col: number) => H + (W - col)
  const pLeft = (row: number) => H + W + (H - row)
  const pTop = (col: number) => 2 * H + W + col

  // Top band (rows 0-2): back with spines, scales, belly; the tail tapers off before the head.
  const tip = hx - 2
  put(g, 0, 1, '▗', DRAGON.body)
  for (let c = 2; c <= tip - 9; c++) put(g, 0, c, c % 6 === 3 && c > 3 ? '▲' : '▄', DRAGON.body)
  put(g, 0, tip - 8, '▖', DRAGON.body)
  put(g, 1, 0, '▐', DRAGON.body)
  for (let c = 1; c <= tip - 4; c++) setScale(1, c, pTop(c), c >= tip - 5 ? (c === tip - 4 ? '░' : '▒') : checker(1, c))
  put(g, 1, tip - 3, '≈~-·', DRAGON.whisker)
  put(g, 2, 0, '▐', DRAGON.body)
  setScale(2, 1, pLeft(2), checker(2, 1))
  setScale(2, 2, pLeft(2), checker(2, 2))
  put(g, 2, 3, '▛', DRAGON.belly)
  for (let c = 4; c <= tip - 7; c++) put(g, 2, c, '▀', DRAGON.belly)
  put(g, 2, tip - 6, '▘', DRAGON.belly)

  // Left band (from row 3) and right band (below the head), down to the bottom band.
  for (let r = 3; r <= H - 4; r++) {
    put(g, r, 0, '▐', DRAGON.body)
    setScale(r, 1, pLeft(r), checker(r, 1))
    setScale(r, 2, pLeft(r), checker(r, 2))
    put(g, r, 3, '▌', DRAGON.belly)
  }
  for (let r = 6; r <= H - 4; r++) {
    put(g, r, W - 4, '▐', DRAGON.belly)
    setScale(r, W - 3, pRight(r), checker(r, W - 3))
    setScale(r, W - 2, pRight(r), checker(r, W - 2))
    put(g, r, W - 1, '▌', DRAGON.body)
  }

  // Bottom band (last 3 rows): belly, scales, back with spines pointing down.
  const b = H - 3
  put(g, b, 0, '▐', DRAGON.body)
  setScale(b, 1, pLeft(b), checker(b, 1))
  setScale(b, 2, pLeft(b), checker(b, 2))
  put(g, b, 3, '▙', DRAGON.belly)
  for (let c = 4; c <= W - 5; c++) put(g, b, c, '▄', DRAGON.belly)
  put(g, b, W - 4, '▟', DRAGON.belly)
  setScale(b, W - 3, pRight(b), checker(b, W - 3))
  setScale(b, W - 2, pRight(b), checker(b, W - 2))
  put(g, b, W - 1, '▌', DRAGON.body)
  put(g, b + 1, 0, '▐', DRAGON.body)
  for (let c = 1; c <= W - 2; c++) setScale(b + 1, c, pBottom(c), checker(b + 1, c))
  put(g, b + 1, W - 1, '▌', DRAGON.body)
  put(g, b + 2, 1, '▝', DRAGON.body)
  for (let c = 2; c <= W - 3; c++) put(g, b + 2, c, c % 6 === 3 && c < W - 4 ? '▼' : '▀', DRAGON.body)
  put(g, b + 2, W - 2, '▘', DRAGON.body)

  // A claw at each bottom corner, reaching up from the belly.
  for (const at of [5, W - 8]) {
    put(g, H - 5, at, '╲│╱', DRAGON.horn)
    put(g, H - 4, at, '▗█▖', DRAGON.body)
  }

  // The head, top right: antlers, brow and eye, snout, jaw with teeth, the neck into the right band.
  HEAD.forEach((line, r) => {
    const art = Array.from(line.art)
    const codes = Array.from(line.colors)
    art.forEach((ch, i) => {
      if (ch === ' ') return
      const code = codes[i] ?? 'b'
      const color =
        code === 'h' ? DRAGON.horn
          : code === 't' ? DRAGON.teeth
            : code === 'g' ? DRAGON.belly
              : code === 'e' ? DRAGON.eye
                : DRAGON.body
      if (code === 's') setScale(r, hx + i, pRight(r), ch)
      else put(g, r, hx + i, ch, color)
    })
  })
  drawEye(g, 2, hx + 6, tick, eye)

  // Whiskers flowing from the snout down to the left, waving with the tick.
  const wave = tick % 4 < 2
  put(g, 3, hx - 4, wave ? '~≈≈≈' : '≈∿≈~', DRAGON.whisker)
  put(g, 4, hx - 7, wave ? '∿≈~' : '~≈∿', DRAGON.whisker)
  put(g, 5, hx - 10, wave ? '~∿≈' : '≈~∿', DRAGON.whisker)
  put(g, 5, hx + 2, wave ? '╰~' : '╰≈', DRAGON.whisker)

  const rows: FrameRow[] = []
  const content: number[] = []
  for (let r = 0; r < H; r++) {
    let hole: [number, number] | null = null
    if (r >= 3 && r <= 5) hole = [5, hx - 11]
    else if (r >= H - 5 && r <= H - 4) hole = [9, W - 9]
    else if (r > 5 && r < H - 5) hole = [5, W - 5]
    if (r > 5 && r < H - 5) content.push(r)
    rows.push(rowOf(g[r]!, hole))
  }
  return { rows, content, inner: W - FRAME_COLUMNS }
}

function drawEye(g: Cell[][], row: number, col: number, tick: number, eye: Eye): void {
  if (eye === 'angry') {
    put(g, row, col, '▙', DRAGON.body)
    put(g, row, col + 1, '◉', DRAGON.eyeAngry, true)
    put(g, row, col + 2, '▟', DRAGON.body)
    return
  }
  if (eye === 'happy') {
    put(g, row, col + 1, PET_EYES.happy, DRAGON.eyeGlow, true)
    return
  }
  const isBlink = tick % 14 === 13
  const isBright = tick % 2 === 0
  put(g, row, col + 1, isBlink ? '━' : isBright ? '◉' : '●', isBright ? DRAGON.eye : DRAGON.eyeGlow, true)
}

function rowOf(cells: Cell[], hole: [number, number] | null): FrameRow {
  if (hole === null || hole[1] <= hole[0]) return { left: runs(cells), hole: 0, right: [] }
  return { left: runs(cells.slice(0, hole[0])), hole: hole[1] - hole[0], right: runs(cells.slice(hole[1])) }
}

/** A narrow pane: a thin coil (scales all round, one red eye) instead of the full dragon. */
function plainCoil(width: number, height: number, tick: number, eye: Eye): Frame {
  const W = Math.max(width, 8)
  const H = height
  const g = blank(W, H)
  const shine = (p: number) => (((p - tick) % 12) + 12) % 12 === 0
  const sc = (p: number) => (shine(p) ? DRAGON.shine : DRAGON.scale)
  put(g, 0, 0, '▗', DRAGON.body)
  for (let c = 1; c < W - 1; c++) put(g, 0, c, c % 2 ? '≋' : '≈', sc(c))
  put(g, 0, W - 3, eye === 'happy' ? '^' : '◉', eye === 'happy' ? DRAGON.eyeGlow : DRAGON.eye, true)
  put(g, 0, W - 1, '▖', DRAGON.body)
  for (let r = 1; r < H - 1; r++) {
    put(g, r, 0, '§', sc(W + r))
    put(g, r, W - 1, '§', sc(r))
  }
  put(g, H - 1, 0, '▝', DRAGON.body)
  for (let c = 1; c < W - 1; c++) put(g, H - 1, c, c % 2 ? '≋' : '≈', sc(W + H + c))
  put(g, H - 1, W - 1, '▘', DRAGON.body)
  const rows: FrameRow[] = []
  const content: number[] = []
  for (let r = 0; r < H; r++) {
    const isInside = r > 0 && r < H - 1
    if (isInside) content.push(r)
    rows.push(rowOf(g[r]!, isInside ? [2, W - 2] : null))
  }
  return { rows, content, inner: W - 4 }
}

/** The frame's height for `lines` rows of content: what the summon pane asks for. */
export function frameHeight(width: number, lines: number): number {
  return width < FULL_ART_COLUMNS ? lines + 2 : lines + FRAME_ROWS
}

// ---------------------------------------------------------------- the Dragon Radar

export type RadarRole = 'grid' | 'ring' | 'you' | 'held' | 'blip' | 'out' | 'none'
export type RadarCell = { text: string; role: RadarRole }

/**
 * The radar's round screen as rows of cells: a ring, a square grid, you at the center, and the
 * seven ball slots around you: `★n` for a ball held, a dim blip for a missing one, `◉n` for the
 * ball that is out right now.
 */
export function radarScreen(width: number, held: readonly number[], out: number | null): RadarCell[][] {
  const R = Math.max(3, Math.min(6, Math.floor((width - 1) / 4)))
  const cols = 4 * R + 1
  const rows = 2 * R + 1
  const cx = 2 * R
  const g: RadarCell[][] = Array.from({ length: rows }, () =>
    Array.from({ length: cols }, () => ({ text: ' ', role: 'none' }) as RadarCell),
  )
  // The grid inside the ring.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      const dx = (x - cx) / 2
      const dy = y - R
      if (Math.sqrt(dx * dx + dy * dy) >= R - 0.4) continue
      const onV = (x - cx) % 6 === 0
      const onH = (y - R) % 3 === 0
      if (onV || onH) g[y]![x] = { text: onV && onH ? '┼' : onV ? '│' : '─', role: 'grid' }
    }
  }
  // The ring, traced once per row (its sides) and once per column (its top and bottom).
  const ring = (x: number, y: number) => {
    const cell = g[y]?.[x]
    if (cell !== undefined) g[y]![x] = { text: ringChar((x - cx) / 2, y - R), role: 'ring' }
  }
  for (let y = 0; y < rows; y++) {
    const half = 2 * Math.sqrt(Math.max(0, R * R - (y - R) * (y - R)))
    ring(Math.round(cx - half), y)
    ring(Math.round(cx + half), y)
  }
  for (let x = 0; x < cols; x++) {
    const dx = (x - cx) / 2
    const h = Math.sqrt(Math.max(0, R * R - dx * dx))
    ring(x, Math.round(R - h))
    ring(x, Math.round(R + h))
  }
  g[R]![cx] = { text: '▲', role: 'you' }
  for (let star = 1; star <= STARS; star++) {
    const angle = ((star - 1) / STARS) * 2 * Math.PI - Math.PI / 2
    const r = R * 0.62
    const x = Math.round(cx + Math.cos(angle) * r * 2)
    const y = Math.round(R + Math.sin(angle) * r)
    const isHeld = held.includes(star)
    const role: RadarRole = isHeld ? 'held' : out === star ? 'out' : 'blip'
    const mark = isHeld ? '★' : out === star ? '◉' : '•'
    const line = g[y]!
    line[x] = { text: mark, role }
    if (x + 1 < cols) line[x + 1] = { text: String(star), role }
  }
  return g
}

function ringChar(dx: number, dy: number): string {
  // The tangent of the ring at this cell, in cells (a cell is twice as tall as it is wide).
  const tx = -dy * 2
  const ty = dx
  const angle = (Math.atan2(ty, tx) * 180) / Math.PI
  const a = ((angle % 180) + 180) % 180
  if (a < 30 || a > 150) return dy < 0 ? '▁' : '▔'
  if (a > 70 && a < 110) return dx < 0 ? '▏' : '▕'
  return a < 90 ? '╲' : '╱'
}

// ---------------------------------------------------------------- the Dragon Ball

/** The two star rows inside a ball of `star` stars, each 7 cells wide. */
export function ballStars(star: number): [string, string] {
  const layouts: Record<number, [string, string]> = {
    1: ['   ★   ', '       '],
    2: ['   ★   ', '   ★   '],
    3: ['  ★ ★  ', '   ★   '],
    4: ['  ★ ★  ', '  ★ ★  '],
    5: [' ★ ★ ★ ', '  ★ ★  '],
    6: [' ★ ★ ★ ', ' ★ ★ ★ '],
    7: [' ★★★★  ', '  ★★★  '],
  }
  return layouts[star] ?? ['       ', '       ']
}

// ---------------------------------------------------------------- text

/** `★★★★☆☆☆` for 4 of 7. */
export function starBar(count: number): string {
  return '★'.repeat(count) + '☆'.repeat(Math.max(0, STARS - count))
}

/** `●●●●○○○` for 4 of 7. */
export function dotBar(count: number): string {
  return '●'.repeat(count) + '○'.repeat(Math.max(0, STARS - count))
}

/** Word-wraps `text` to `width` columns; a word longer than a line is cut. */
export function wrap(text: string, width: number): string[] {
  const w = Math.max(4, width)
  const out: string[] = []
  for (const para of text.split('\n')) {
    let line = ''
    for (const word of para.split(/\s+/).filter(Boolean)) {
      const piece = word.length > w ? word.slice(0, w) : word
      if (line === '') line = piece
      else if (line.length + 1 + piece.length <= w) line += ` ${piece}`
      else {
        out.push(line)
        line = piece
      }
    }
    out.push(line)
  }
  return out
}

/** An empty stretch of the dark sky inside the coil: a few dim stars that twinkle with the tick. */
export function sky(row: number, width: number, tick: number): string {
  let line = ''
  for (let c = 0; c < width; c++) {
    const h = (row * 31 + c * 17 + 7) % 43
    line += h === 0 ? ((tick + row + c) % 7 === 0 ? '+' : '·') : ' '
  }
  return line
}

/** `text` padded with spaces to exactly `width` cells, centered; cut when longer. */
export function center(text: string, width: number): string {
  const chars = Array.from(text)
  if (chars.length >= width) return chars.slice(0, width).join('')
  const left = Math.floor((width - chars.length) / 2)
  return ' '.repeat(left) + text + ' '.repeat(width - chars.length - left)
}

/** Every frame row as plain text, the slots filled with `fill`: for looking at the art in a test. */
export function frameText(frame: Frame, fill = ' '): string[] {
  return frame.rows.map(row => {
    const left = row.left.map(s => s.text).join('')
    const right = row.right.map(s => s.text).join('')
    return left + fill.repeat(row.hole) + right
  })
}

/** The narrowest band the prompt coil is drawn in; below it the coil is left out. */
export const COIL_COLUMNS = 24

/**
 * Shenron coiled along the top of the band above the prompt: his tail at the left, the body across
 * with the seven Dragon Ball slots in it (held ones orange), his head at the right. `tall` adds a row
 * of dorsal spines and antlers above. `tick` >= 0 runs a shine along the scales; -1 draws none.
 * Every row is exactly `width` cells.
 */
export function coilRows(width: number, tick: number, held: readonly number[], isBallOut: boolean, tall: boolean): Seg[][] {
  const w = Math.max(COIL_COLUMNS, width)
  const g = blank(w, tall ? 2 : 1)
  const body = tall ? 1 : 0
  // Head at the right end: snout facing out, then a whisker, or the Dragon Ball he found.
  const head = '▓█◉██▙▶'
  const hx = w - head.length - 2
  put(g, body, 0, '∽', DRAGON.scale)
  put(g, body, 1, '≈≈', DRAGON.body)
  for (let c = 3; c < hx; c += 1) put(g, body, c, c % 2 === 0 ? '▓' : '▒', c % 2 === 0 ? DRAGON.body : DRAGON.scale)
  put(g, body, hx, head, DRAGON.body)
  put(g, body, hx + 2, '◉', DRAGON.eye, true)
  if (isBallOut) put(g, body, hx + head.length, '●', BALL.orange, true)
  else put(g, body, hx + head.length, '∾', DRAGON.whisker)
  // The seven Dragon Ball slots, spread along the body.
  const from = 5
  const span = hx - 2 - from
  if (span >= STARS) {
    for (let i = 0; i < STARS; i += 1) {
      const c = from + Math.round((i * span) / (STARS - 1))
      const isHeld = held.includes(i + 1)
      put(g, body, c, isHeld ? '●' : '○', isHeld ? BALL.orange : DRAGON.belly, isHeld)
    }
  }
  // The shine: two cells of light gliding from tail to head over the scales.
  if (tick >= 0 && hx > 3) {
    const at = 3 + (tick % (hx - 3))
    for (const c of [at, at + 1]) {
      const cell = g[body]![c]
      if (cell !== undefined && c < hx && (cell.ch === '▓' || cell.ch === '▒')) g[body]![c] = { ch: cell.ch, color: DRAGON.shine }
    }
  }
  if (tall) {
    for (let c = 6; c < hx - 1; c += 6) put(g, 0, c, '▴', DRAGON.body)
    put(g, 0, hx + 1, '╲│╱╲│╱', DRAGON.horn)
  }
  return g.map(runs)
}

/** The dragon's tail under the prompt, before the Dragon Ball count on the hint line. */
export const COIL_TAIL = '╰≈≈≈∽'
