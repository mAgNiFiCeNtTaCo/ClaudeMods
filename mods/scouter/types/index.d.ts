/** One row of the context breakdown, as /context lists it. */
export type ScouterCategory = {
  name: string
  tokens: number
  kind: 'used' | 'free' | 'buffer' | 'deferred'
}

/** One rate-limit window as last read. */
export type ScouterLimit = {
  kind: string
  percentUsed: number
  resetsAt?: string
}

/** The session's figures as `$.session.usage()` last answered them; null where unknown. */
export type ScouterSnapshot = {
  startedAt: number | null
  contextTokens: number | null
  contextWindow: number | null
  contextPercent: number | null
  rateLimits: ScouterLimit[]
  costUsd: number | null
}

/** Attacks (turns), techniques (tool calls) and what they touched. */
export type ScouterBattle = {
  attacks: number
  techniques: number
  failed: number
  tools: Record<string, number>
  edited: string[]
}

/** Which stamina thresholds already fired for the 5h window that resets at `resetsAt`. */
export type ScouterStamina = {
  resetsAt: string
  fired: number[]
}

declare module 'claude-code' {
  interface PluginState {
    scouter: {
      isOpen: boolean
      autoTried: boolean
      model: string | null
      power: number
      over9000: boolean
      battle: ScouterBattle
      snapshot: ScouterSnapshot | null
      breakdown: ScouterCategory[] | null
      stamina: ScouterStamina | null
      now: number
    }
  }
}
