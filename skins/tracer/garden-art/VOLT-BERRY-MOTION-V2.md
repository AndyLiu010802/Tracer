# Volt berry companion animation v2

Mode: built-in ImageGen, separate call per original transparent sprite sheet. Original PNG pixels and alpha are copied unchanged. Source identity: `volt_berry-v2.png`, bottom-middle normal companion and bottom-right shiny companion.

Target: 2 forms x 16 actions x 16 continuous frames = 32 sheets / 512 frames.

Actions: idle, greet, walk, hop, water, pet, music, celebrate, rest, focus, breeze, stretch, look, shy, eat, thanks.

Acceptance: visually review identity, continuous action, complete limbs and safe margins; use `inspectSheet` for RGBA alpha, sixteen distinct frames and measured crop geometry. Preserve source pixels. The coordinator rebuilds the global atlas only after all assets pass. Rest remains eyes-closed for frames 9–16; hopping retains drawn lift.

Status (2026-09-23): identity atlas and all 32 normal/shiny action sheets are complete. The 288-sheet plant audit and browser playback verification pass. See `COMPANION-MOTION-V3-PROMPTS.json` and `COMPANION-MOTION-V3-SOURCES.json` for generation and correction records.
