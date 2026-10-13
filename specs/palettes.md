# Station brief: color schemes in every DBZ mod (+ move Dragon Balls out of saiyan-status)

First read `D:\ClaudeProjects\ClaudeMods\specs\COMMON.md` and `D:\ClaudeProjects\ClaudeMods\specs\THEME.md`.
You work on THREE existing mods: `mods/kamehameha`, `mods/scouter`, `mods/saiyan-status`.
Another station is building a NEW mod `mods/shenron` at the same time: never touch that folder.
Each mod has a README; read its code before changing it. The previous builders left notes in
`~\.claude\projects\D--ClaudeProjects-ClaudeMods\memory\` (mod API gotchas): read them.

## 1. Palettes (kamehameha and scouter)
The canonical palette table is `D:\ClaudeProjects\ClaudeMods\shared\palettes.ts`. Copy it UNCHANGED to
`hooks/palettes.ts` in kamehameha and in scouter (a plugin imports only its own files).
- Add a `palette` userConfig field to each of the two mods, exactly:
  `"palette": { "type": "string", "title": "Color scheme", "description": "DBZ color scheme (also set by /dbztheme).", "default": "goku", "options": [<every PALETTE_NAMES value, in table order>] }`.
  The field MUST be named `palette` in both: the shenron mod's `/dbztheme` sets `kamehameha.palette` and
  `scouter.palette` through `$.config.set`, which reloads each module with the new option.
- Replace every hard-coded THEME color with the active palette's token (`paletteOf(options.palette)`):
  ki-blue → `ki`, beam-white → `beam`, gi-orange headings → `heading`, gi-blue → `frame`, ssj-gold →
  `gold`, the gauge rule → `gaugeColorOf`, kaioken-red → `danger`, scouter-green → `readout`.
  Nothing may stay hard-coded except dim text. Kamehameha's charge bar fades from `ki` toward `beam`.
- With `palette` unset or `goku` the mods must look exactly as they do now (goku = today's colors).
- Make the scouter pane's lens border use `frame`, and its title show the scheme: `◢ SCOUTER ◣ · Vegeta`.
- Tests: for each of the two mods, one test that mounts with `{ options: { palette: 'namek' } }` and checks a
  heading/gauge Text carries the namek color, and one that an unknown palette falls back to goku.
  The existing tests must keep passing.

## 2. saiyan-status: Dragon Balls move to the shenron mod
The new shenron mod owns Dragon Balls now (random finds, Shenron, wishes). In saiyan-status remove the
Dragon Ball feature entirely: the earn-on-turn logic, the `/dragonballs` command, the `dragonBalls`
toggle, the `★n` part of the status line, its tests and README lines. Leave the store data alone (do not
delete keys). Everything else in saiyan-status stays. Status line becomes e.g.
`⚡ SSJ2 · Ki 73% · Stamina 41% (2h13m) · Zeni $1.24`.

## 3. Docs
Update each touched mod's README (palette field, removed feature). Add a "Color schemes" section to
`D:\ClaudeProjects\ClaudeMods\README.md` listing the palettes (name, tagline; secret ones marked
"wish only") and saying `/dbztheme` (shenron mod) switches all mods at once.

## Done means
`claude plugin validate` clean and `claude plugin test` passing for ALL THREE mods. Then report-outcome as
COMMON.md says, note e.g. "palettes: 3 mods validate ok, N tests pass".
