/** The Dragon Ball out right now, waiting for /grab. */
export type ShenronBall = {
  /** 1-7: how many stars it has. */
  star: number
  /** When it appeared ($.clock.now()). */
  appearedAt: number
}

/** The figures kept across sessions (mirrors of $.store). */
export type ShenronStats = {
  /** Dragon Balls that ever turned up. */
  finds: number
  /** Wishes Shenron granted. */
  wishes: number
  /** Secret palettes a wish unlocked (golden-frieza, super-saiyan-rose). */
  unlocked: string[]
}

/** How Shenron's eyes look: glowing (and blinking), happy (petted), angry (refusing). */
export type ShenronEye = 'glow' | 'happy' | 'angry'

/** The summon pane: a real summoning or a preview, and where the wish stands. */
export type ShenronSummon = {
  mode: 'summon' | 'preview'
  /** ask: wishes open; thinking: a wish is under way; granted: farewell, the pane closes soon. */
  phase: 'ask' | 'thinking' | 'granted'
  /** What Shenron says inside the coil. */
  lines: string[]
  /** How the lines are colored. */
  tone: 'speech' | 'refuse' | 'pet' | 'grant'
  eye: ShenronEye
}

declare module 'claude-code' {
  interface PluginState {
    shenron: {
      /** Stars of the Dragon Balls held, sorted (mirror of $.store 'stars'). */
      held: number[]
      stats: ShenronStats
      /** Session only: the ball out right now. */
      ball: ShenronBall | null
      /** Session only: main-thread tool calls since the last find (the pity count). */
      sinceFind: number
      /** The summon pane's state; null while it is closed. */
      summon: ShenronSummon | null
      /** Animation frame of the summon pane. */
      tick: number
    }
  }
}
