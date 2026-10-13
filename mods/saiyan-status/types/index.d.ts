/** The figures the status line shows; null until the engine has a reading. */
export type SaiyanUsage = {
  /** Context fill, whole percent. */
  ki: number | null
  /** 5-hour rate-limit window used, percent. */
  stamina: number | null
  /** When the 5-hour window resets, ISO 8601. */
  resetsAt: string | null
  /** Session cost in USD. */
  zeni: number | null
}

/** Auto Senzu: armed below 92%, pending at 92%+, spent once it compacted (until Ki drops again). */
export type SaiyanAutoSenzu = 'armed' | 'pending' | 'spent'

/** Which stamina thresholds were already toasted for one 5-hour window. */
export type SaiyanStaminaWarned = { resetsAt: string; levels: number[] }

declare module 'claude-code' {
  interface PluginState {
    'saiyan-status': {
      usage: SaiyanUsage
      /** Tier index (0 Base .. 5 Limit Breaker) of the last Ki reading. */
      lastTier: number | null
      /** The 85% "Senzu Bean is ready" toast fired; re-armed when Ki drops below 85%. */
      senzuOffered: boolean
      autoSenzu: SaiyanAutoSenzu
      staminaWarned: SaiyanStaminaWarned
    }
  }
}
