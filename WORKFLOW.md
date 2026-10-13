# ClaudeMods: workflow record

Who did what when several sessions worked on the project. Transcripts live in
`~/.claude/projects/D--ClaudeProjects-ClaudeMods/<id>*.jsonl`. `WORKFLOW.html` is the picture of this.

## 2026-10-13: first build with a nodeterm team

### At a glance
6 Claude sessions: 1 lead (orchestrator) and 5 builder stations, all in the shared working tree (no
worktrees, by request), grouped in the canvas frame "DBZ Mods Team".

```
lead 99f66f20: specs/THEME.md + COMMON.md + one brief per mod
   ├─> Kamehameha  3fef8927 ─┐
   ├─> Scouter     a8c9e181 ─┼─> lead adds power gauges to kamehameha
   └─> Saiyan-St.  bda0f5b4 ─┘
lead: specs/palettes.md + specs/shenron.md
   ├─> Palettes    d8361d6e ─┐
   └─> Shenron     bb70fba2 ─┴─> lead: goku warn fix, /gauges fix, sync + live check
```

### Timeline (local time, CDT)
| Time | What happened |
| --- | --- |
| 14:13 | User asks for DBZ mods with a Kamehameha progress bar, context and usage info |
| 14:17-14:28 | Kamehameha, Scouter, Saiyan-Status stations build their mods |
| 14:44 | User: "we need progress bars under these screens" for usage/context: lead builds the power gauges |
| 14:54 | User: new color schemes and a Shenron wrapped round the window, 7 Dragon Balls, a wish |
| 14:57-15:04 | Palettes station: shared palette in three mods, Dragon Balls out of saiyan-status |
| 14:57-16:13 | Shenron station builds the shenron mod |
| 15:07 | User: "revert wut i did": they had pressed Hide and lost the gauges: lead adds `/gauges` |
| 16:57-17:08 | Lead re-runs all checks, starts `try-mods.cmd` in a canvas terminal, checks the screen |

### Every session
| Stage | Session | Role (node) | Time | Files | Built / found | Outcome |
| --- | --- | --- | --- | --- | --- | --- |
| Lead | 99f66f20 | Orchestrator (term-mv7271cv) | 14:13-17:08 | specs/*, README, try-mods.cmd, shared/palettes.ts, kamehameha gauges | Briefs, power gauges + hint bars, goku warn fix, `/gauges`, final checks and live look | done |
| Build 1 | 3fef8927 | Kamehameha (term-mv72byul) | 14:17-14:28 | mods/kamehameha/* | Charge band, beam, summary, Ki gauge; 7 tests | done |
| Build 1 | a8c9e181 | Scouter (term-mv72bzsr) | 14:17-14:27 | mods/scouter/* | `/scouter` pane, 9000 toast, stamina alerts; 7 tests | done |
| Build 1 | bda0f5b4 | Saiyan-Status (term-mv72c0q4) | 14:17-14:28 | mods/saiyan-status/* | Status line, transformations, `/senzu`, Dragon Balls (later moved); 16 tests | done |
| Build 2 | d8361d6e | Palettes (term-mv73s1bx) | 14:57-15:04 | three mods' palettes, READMEs | Shared palette in kamehameha/scouter/saiyan-status; removed saiyan Dragon Balls; flagged goku warn color | done |
| Build 2 | bb70fba2 | Shenron (term-mv73s0j1) | 14:57-16:13 | mods/shenron/* | Dragon Balls, `/grab`, `/dragonradar`, `/shenron` art + wishes, `/dbztheme`; 23 tests | done |

### What went wrong, and the lesson
- `spawn-team` is refused while the project is off screen: open each station with `open-agent --run-now`.
- A station's headless `claude -p` flipped it to NEEDS YOU (hook env inherited): a false alarm, not a question.
- The Palettes brief copied the shared table "unchanged", which carried a wrong goku `warn` color; the
  station flagged it instead of guessing, and the lead fixed it. Lesson: give stations a reference to
  check against, and ask them to report mismatches.
- `[ Hide ]` had no visible way back, and the user thought something broke. Lesson: every hide/close
  control must say how to bring the thing back.
- No prompts were cut off.
