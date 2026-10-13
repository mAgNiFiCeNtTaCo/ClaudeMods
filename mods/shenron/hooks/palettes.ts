// DBZ color schemes shared by every ClaudeMods mod. CANONICAL COPY: each mod keeps an identical copy
// at hooks/palettes.ts (a plugin can only import its own files). Change this file, then copy it over.
//
// A mod picks its palette from its `palette` userConfig field (a string with these names as options);
// the shenron mod's /dbztheme sets that field on every DBZ mod at once through $.config.set.

export type Palette = {
  /** The name stored in the `palette` userConfig field. */
  name: PaletteName
  /** What /dbztheme shows. */
  label: string
  /** Who it is, one line, for /dbztheme. */
  tagline: string
  /** Wish-only: hidden as ??? in /dbztheme until Shenron grants it. */
  isSecret: boolean
  /** Energy: charge bars, ki gauges at low fill, the beam's edge (was ki-blue). */
  ki: string
  /** Brightest energy: the beam core, "HA!" (was beam-white). */
  beam: string
  /** Headings and labels: SCOUTER, KI, STAMINA (was gi-orange). */
  heading: string
  /** Secondary labels and borders (was gi-blue). */
  frame: string
  /** Highlights, 50-70% fill, the time marker (was ssj-gold). */
  gold: string
  /** 70-85% fill (was gi-orange in the gauge rule). */
  warn: string
  /** Danger, 85%+ fill, runs-out warnings (was kaioken-red). */
  danger: string
  /** Readout text in panes (was scouter-green). */
  readout: string
}

export type PaletteName =
  | 'goku'
  | 'vegeta'
  | 'namek'
  | 'frieza'
  | 'super-saiyan-blue'
  | 'ultra-instinct'
  | 'majin-buu'
  | 'kaioken'
  | 'golden-frieza'
  | 'super-saiyan-rose'

export const PALETTES: readonly Palette[] = [
  {
    name: 'goku', label: 'Goku', tagline: 'Orange gi, blue ki. The classic.', isSecret: false,
    ki: '#4fc3ff', beam: '#e8f8ff', heading: '#ff7a00', frame: '#1e5bd8',
    gold: '#ffd400', warn: '#ff7a00', danger: '#ff3b30', readout: '#39ff14',
  },
  {
    name: 'vegeta', label: 'Vegeta', tagline: 'Saiyan armor and a Final Flash.', isSecret: false,
    ki: '#ffe14d', beam: '#fffbe0', heading: '#3d6bff', frame: '#f0f4ff',
    gold: '#ffd400', warn: '#ff9a3c', danger: '#ff3b30', readout: '#a8c4ff',
  },
  {
    name: 'namek', label: 'Namek', tagline: 'Green skies and Piccolo calm.', isSecret: false,
    ki: '#7ee08a', beam: '#e6ffe8', heading: '#3fa34d', frame: '#8fd3c8',
    gold: '#d4e157', warn: '#ffb74d', danger: '#ff5252', readout: '#b7f5a0',
  },
  {
    name: 'frieza', label: 'Frieza', tagline: 'Purple, white and a Death Beam.', isSecret: false,
    ki: '#c77dff', beam: '#fbeaff', heading: '#9d4edd', frame: '#e0aaff',
    gold: '#ff6ad5', warn: '#ff9e64', danger: '#ff2e63', readout: '#e0aaff',
  },
  {
    name: 'super-saiyan-blue', label: 'Super Saiyan Blue', tagline: 'God ki, cyan aura.', isSecret: false,
    ki: '#00c2ff', beam: '#e0fbff', heading: '#0066ff', frame: '#7ae7ff',
    gold: '#7ae7ff', warn: '#ffb000', danger: '#ff3b30', readout: '#7ae7ff',
  },
  {
    name: 'ultra-instinct', label: 'Ultra Instinct', tagline: 'Silver, quiet, untouchable.', isSecret: false,
    ki: '#c0c8d8', beam: '#ffffff', heading: '#8a9bb8', frame: '#9ad0ff',
    gold: '#e8eef8', warn: '#ffc46b', danger: '#ff5c7a', readout: '#dfe7f5',
  },
  {
    name: 'majin-buu', label: 'Majin Buu', tagline: 'Pink, bouncy, turns things into candy.', isSecret: false,
    ki: '#ff8fc7', beam: '#fff0f7', heading: '#d63384', frame: '#ffd1e8',
    gold: '#ffd166', warn: '#ff9f43', danger: '#ff3860', readout: '#ffc2e0',
  },
  {
    name: 'kaioken', label: 'Kaioken', tagline: 'Times twenty. Everything is red.', isSecret: false,
    ki: '#ff5a4e', beam: '#ffe3e0', heading: '#ffb000', frame: '#ff8a80',
    gold: '#ffd400', warn: '#ff9a3c', danger: '#ff1744', readout: '#ff8a80',
  },
  {
    name: 'golden-frieza', label: 'Golden Frieza', tagline: 'A wish only. Gold and violet.', isSecret: true,
    ki: '#ffcc00', beam: '#fff6cc', heading: '#7b2cbf', frame: '#ffd95a',
    gold: '#ffe066', warn: '#ff9e64', danger: '#ff2e63', readout: '#ffe066',
  },
  {
    name: 'super-saiyan-rose', label: 'Super Saiyan Rose', tagline: 'A wish only. Rose ki, silver edge.', isSecret: true,
    ki: '#ff5fa2', beam: '#ffe6f1', heading: '#c0c0c0', frame: '#ff9ec8',
    gold: '#ffb3d1', warn: '#ffb86b', danger: '#ff2d55', readout: '#ffc2dc',
  },
]

export const PALETTE_NAMES: readonly PaletteName[] = PALETTES.map(p => p.name)

/** The palette for a `palette` option value; unknown or missing falls back to goku. */
export function paletteOf(name: unknown): Palette {
  return PALETTES.find(p => p.name === name) ?? PALETTES[0]!
}

/** THEME's gauge rule in a palette's colors: 0-50 ki, 50-70 gold, 70-85 warn, 85+ danger. */
export function gaugeColorOf(p: Palette, percent: number): string {
  if (percent >= 85) return p.danger
  if (percent >= 70) return p.warn
  if (percent >= 50) return p.gold
  return p.ki
}
