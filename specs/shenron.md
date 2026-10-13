# Station brief: `shenron` mod (random Dragon Balls, Shenron, wishes, /dbztheme)

First read `D:\ClaudeProjects\ClaudeMods\specs\COMMON.md` and `D:\ClaudeProjects\ClaudeMods\specs\THEME.md`.
Your folder: `D:\ClaudeProjects\ClaudeMods\mods\shenron\`. Plugin name: `shenron`. NEW mod; touch only this
folder. Another station is changing kamehameha, scouter and saiyan-status at the same time (adding color
schemes, and REMOVING saiyan-status's old Dragon Balls: you own Dragon Balls now).
Read the previous builders' notes first:
`~\.claude\projects\D--ClaudeProjects-ClaudeMods\memory\` (mod API gotchas), and look at
`mods/saiyan-status/hooks/register.tsx` for how /senzu compacts (compact refused inside a command hook:
answer first, compact ~150 ms later from `$.clock.after`) and how toasts were merged.

The user's words: "add a shenron dragon that wraps around the terminal window that you can interact with.
randomly find 7 dragon balls while using terminal and after collecting 7 have it grant you a wish xD"

## Colors
Copy `D:\ClaudeProjects\ClaudeMods\shared\palettes.ts` UNCHANGED to `hooks/palettes.ts`. Add the same
`palette` userConfig field the other mods get:
`"palette": { "type": "string", "title": "Color scheme", "description": "DBZ color scheme (also set by /dbztheme).", "default": "goku", "options": [<every PALETTE_NAMES value, in table order>] }`
and draw your windows in `paletteOf(options.palette)` (Shenron's own body stays dragon green, see below).

## 1. Random Dragon Ball finds
- While the user works, roll for a find after each tool call (after `next`) of the main thread.
  `findRate` userConfig (string, options `rare` / `normal` / `frequent`, default `normal`): per-tool-call
  chance about 1.5% / 3% / 8%, plus a pity rule (a guaranteed find after 60 / 40 / 15 tool calls without one).
  At most one ball is out at a time. The ball is a star count the user does not hold yet (1-7).
- A find: toast `✨ A Dragon Ball appeared! The 4-Star Ball, grab it! (/grab)` and open a small pane
  (`$.ui.open({ id: 'dragonball', rows: 4 })`, no focus: never steal the keyboard mid-turn) drawing an
  orange ball with its stars, e.g. `( ★★★★ )` in the 4-star ball, and `[ Grab it ]` (hotkey `g`).
  If the pane is not placed (narrow terminal; read `isPlaced`), the toast and `/grab` are enough.
- `/grab` (and the button) collects it: toast `Got the 4-Star Dragon Ball! ★★★★☆☆☆ 4/7`, close the pane.
- `ballEscape` (bool, default true): an uncollected ball flies away after 90 s
  (`The 4-Star Dragon Ball flew away...`). Off: it waits until grabbed.
- Persist in `$.store` (survives sessions): stars held, lifetime finds, wishes granted, unlocked secret
  palettes. Session-only bits (the ball out right now) in `$.state`.
- `hintTail` (bool, default true): append `🐉 ●●●●○○○` (or `DB 4/7`) to the PromptHint `tail`
  (another mod, kamehameha, also appends to it: keep `e.props.tail` and add yours, never replace).

## 2. /dragonradar
A pane (`id: 'dragonradar'`, toggles open/closed) drawing a Dragon Radar: a round green grid (readout
color) with the seven ball slots, held ones as bright `★n`, missing ones as dim blips, plus stats (held,
lifetime finds, wishes granted, current find rate, tool calls since the last find). `[ Close ]` button.

## 3. Shenron (the summoning) — the centerpiece
When the 7th ball is grabbed: toast `The sky darkens... SHENRON HAS BEEN SUMMONED!` and open the summon
pane: `$.ui.open({ id: 'shenron', focus: true, closeOnEscape: true, holdToasts: true, rows: <tall> })`.
- **The dragon wraps around the window**: draw Shenron's long body coiling around ALL FOUR EDGES of the
  pane as its frame: scaled body segments (e.g. `≈≈≈`/`∿∿∿`/`▓▒` or `§` along the top and bottom, `║ ≋`
  down the sides), the head with horns, whiskers and glowing red eyes at the top-right corner, the claws
  at a corner or two, the tail tapering off near the start. Size it to `e.props.bodyColumns` and the rows
  you get, so it always closes the loop. Body dragon green (`#2e8b57` / scales `#3cb371`), eyes red
  (`#ff3b30`), the text inside in the palette's `gold` / `beam`. Make it look GOOD: spend effort on the
  ASCII art; check it by dumping the drawn text in a throwaway test (see the memory notes) at 80, 110
  and 150 columns. The terminal's fullscreen layout docks a pane beside the transcript, floor to ceiling:
  read the Pane props and `viewport` and fill what you get.
- `shenronAnimation` (bool, default true): while the pane is open, scales shimmer and the eyes glow/blink
  (`$.clock.every`, at most 4 fps, stopped when it closes).
- Inside the coil: `I AM THE ETERNAL DRAGON. STATE YOUR WISH.` and the wishes as Buttons, hotkeys 1-5:
  1. **Restore my Ki**: compact the conversation (as /senzu does in saiyan-status: deferred compact).
  2. **Grant me a new power**: unlock a secret palette (`golden-frieza`, then `super-saiyan-rose`; once both
     are unlocked, a random other palette) and switch every DBZ mod to it (as /dbztheme does).
  3. **Share your wisdom**: one short Claude Code / coding tip in Shenron's voice from
     `$.model.complete` on a small model (`claude-haiku-5-5`, at most ~120 output tokens; read
     `ModelCompleteResult`), shown in the coil; when it is not answered, use one of ~10 built-in tips.
  4. **Make me immortal**: Shenron refuses (`THAT IS BEYOND MY POWER.`), the balls stay, wish again.
  5. **Pet Shenron**: he reacts (a random line, the eyes change), nothing is spent.
  A granted wish (1-3): `YOUR WISH HAS BEEN GRANTED. FAREWELL!`, after ~3 s the pane closes, the balls
  scatter (held stars → none; toast `The Dragon Balls scattered across the Earth...`), wishes granted +1.
- `/shenron`: with 7 balls, open the summon pane; otherwise answer
  `Gather all seven Dragon Balls first. ●●●○○○○ 3/7`. `/shenron preview` opens the pane to look at it
  (wishes shown but disabled, a dim `preview` note) so the user can see the dragon without 7 balls.

## 4. /dbztheme (color schemes for every DBZ mod)
- `/dbztheme` with no argument: a pane listing every palette as a Button (label + tagline, a few colored
  sample blocks `███` in its ki/heading/gold/danger), the current one marked, secret ones shown as
  `??? (wish only)` and disabled until unlocked. Pressing one applies it.
- `/dbztheme <name>`: apply directly; a locked secret one answers `Only Shenron can grant that power.`.
- Applying: for every row in `$.config.list()` whose key is `kamehameha.palette`, `scouter.palette` or
  `shenron.palette` (whichever exist; read each row's `options` and skip rows that lack the name), call
  `$.config.set({ key, value: name })`. Each mod reloads with the new colors. Toast
  `Transformed! Color scheme: Super Saiyan Blue`. Note: setting your own row reloads your module: keep
  everything that must survive in `$.state` / `$.store`, and do the toast before or via state.

## Toggles (`userConfig`)
`palette` (goku), `findRate` (normal), `ballEscape` (true), `hintTail` (true), `shenronAnimation` (true).

## Done means
validate clean; tests (mock the randomness: put the roll behind a small function you can drive, e.g. a
`rng` you replace in tests, or `mock` what the kit offers) for: a find after the pity count, `/grab`
collecting it and the toast, escape after 90 s, the 7th grab opening the shenron pane on terminal AND
desktop with the wish buttons and the dragon frame (top and bottom rows of body glyphs present), wish 4
keeps the balls, wish 2 unlocks golden-frieza and calls `$.config.set` for the palette rows, wish 1
compacts (deferred), `/shenron preview`, `/dbztheme namek` setting the rows and refusing a locked secret.
Write the README (every command, toggle, how to see Shenron quickly with `/shenron preview` and
`findRate: frequent`). Then report-outcome as COMMON.md says.
