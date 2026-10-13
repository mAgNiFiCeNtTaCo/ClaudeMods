/** The turn being charged right now. */
export type KamehamehaCharge = {
  /** `$.clock.now()` when the turn started. */
  startedAt: number
  /** Tool calls so far (techniques). */
  techniques: number
  /** Model requests so far. */
  steps: number
  /** The last tool called, shortened; null before the first. */
  tool: string | null
}

/** The animation clock: frame index and the time it was taken. */
export type KamehamehaTick = { frame: number; now: number }

/** The last finished turn (attack). */
export type KamehamehaAttack = {
  /** fire / fizzle: the 4 s moment after the turn; summary: settled. */
  phase: 'fire' | 'fizzle' | 'summary'
  isFizzle: boolean
  firedAt: number
  durationMs: number
  techniques: number
  /** Every token the turn's requests sent and received; absent when none counted. */
  tokens?: number
}

/** The context window as Ki; fields absent until the engine has them. */
export type KamehamehaKi = { tokens?: number; window?: number; percent?: number }

/** One rate-limit window as the gauges read it. */
export type KamehamehaLimit = { kind: string; percentUsed: number; resetsAt?: string }

/** What the power gauges under the band read, besides Ki. */
export type KamehamehaMeters = {
  /** The rate-limit windows of the last reading; empty off a subscription. */
  limits: KamehamehaLimit[]
  /** Session cost in USD; absent where the host keeps no ledger. */
  usd?: number
  /** Input tokens served from the prompt cache, summed over finished turns. */
  cacheRead: number
  /** All input tokens (uncached, cache-written, cache-read) over the same turns. */
  cacheTotal: number
  /** Finished turns that reported usage. */
  attacks: number
  /** `$.clock.now()` of the last refresh, for the reset countdowns. */
  now: number
}

declare module 'claude-code' {
  interface PluginState {
    kamehameha: {
      charge: KamehamehaCharge | null
      tick: KamehamehaTick
      last: KamehamehaAttack | null
      ki: KamehamehaKi
      isHidden: boolean
      meters: KamehamehaMeters
    }
  }
}
