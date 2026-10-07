# Retired feature cleanup

2026-10-06. The user requested removal of unused feature code, components and assets. This pass checks the current working tree rather than restoring older files from Git. Existing deletions and the in-progress fishing/aquarium changes are preserved.

## Removed in this pass

97 files, 61,047,174 bytes (58.22 MiB), were removed after resolving each path inside the workspace. The first 96 files were also checked against the SHA-256 inventory before deletion; the final obsolete cabin sheet was removed during the aquarium replacement. No user account, workspace, generated personal artwork, or backup was deleted. The exact file list appears below; sizes and hashes for the first 96 are in `.cache/retired-cleanup-20261006.json`.

- Superseded illustrated fish and rod sheets: `fish-v1.png` and `rods-v2.png`. Runtime markup, catalog generation, visual QA, and package asset checks use `fish-model-v1.png` and `rods-model-v1.png` instead. Active bait and fishing scenery artwork remains.
- The superseded `cabins-v2.png` sheet (2,783,573 bytes), its packaging entry, generation prompt and 16 dead cabin CSS rules were removed when the shared aquarium replaced the cabin/showcase components. Aquarium code and current rendering assets remain.
- Two old garden companion perch images and their dedicated `qa-garden-props.cjs` script. Repository references were confined to that retired perch test; current garden markup no longer constructs the companion perch.
- Retired pet, plant companion, trail, Brook, alchemy, anime and skeletal-rig demonstrations: isolated guides, generated prompt manifests, screenshots and videos. Their implementation and player modules had already been removed. Current task garden, furniture, stickers, fishing research, and historical release records remain.
- Obsolete fish/rod generation prompts were removed from the mixed active fishing-art guide. The active prompt sections remain, alongside the current model catalog build command. Current appearance documentation no longer links to removed companion instructions.

The previous retirement inventory records 1,524 already-removed files (2,033,165,001 bytes). That earlier cleanup is preserved and is not counted again in the 97 files above.

## Required compatibility retained

| Files | Live reason for retaining them |
| --- | --- |
| `skins/tracer/pet-model.js`, `pet-animation.js` | Loaded before account preferences by the current HTML entry point; validate historical character records and animation manifests during backup restore. |
| `lib/pet-image.js`, `pet-package.js`, `companion-backup.js` | Used by account, portable and workspace backups, legacy package endpoints and restored artwork asset serving. Removing them would break historical backups. |
| `public/companion-work.js` | Despite its historical name, it validates task creation receipts and participates in active workspace merging and sync. |
| `skins/tracer/task-garden.js`, `public/task-garden.js` | Preserve historical garden variants and layout fields while serving the active task garden. Data compatibility fields are not an active companion renderer. |
| Ordinary garden plants, furniture and pet-themed stickers | Still used by active garden and sticker catalogs. The word “pet” in a sticker filename does not make it retired. |

## Active tooling repaired

`dev/sticker-art-assets.cjs` previously imported the removed companion atlas builder solely for PNG decoding. It now imports `dev/png-rgba.cjs`, a small local RGBA8 reader without character generation or image-writing features. It handles all five PNG row filters and rejects unsupported or truncated input.

`dev/verify-macos-release.cjs` previously loaded the removed character artwork and built-in animation players. Its data smoke check now loads only the retained historical backup validators and the active fishing model. Source parity, architecture, privacy, signing, native AI runtime, served assets and application startup checks remain.

Unreachable retired character transformation branches were removed from `dev/commercial-release.cjs`. The actual commercial overlay for retained character backup data, local-effects removal and packaging guards remain.

Validation completed:

- `node --test test/asset-audit-tools.test.js`: 2 tests passed, covering all five PNG filters and the release check's actual module dependency list.
- `node dev/sticker-art-assets.cjs`: all 72 sticker images passed, with no missing or rejected images.
- Historical character/animation, companion backup/package, fishing package and resource audit tests: 53 passed.
- Commercial character/local-effects packaging guards and resource audit tests: 8 passed. The two resource audit cases are shared with the 53-test run; these are separate runs, not 61 unique tests.
- Syntax checks for all 12 changed development scripts passed. Full native Mac signing/startup checks require macOS and were not run on Windows.
- `dev/qa-garden-store.cjs`: passed in an isolated temporary workspace, including purchases, all six furniture views, drag/flip/hide, failed save/retry, reload, wallpapers/materials, account purchases and Chinese/English mobile layout. Screenshots: `.cache/garden-store-ntb1Yi`.
- `dev/qa-task-garden-world.cjs`: seed withdrawal/restart, live task cards, paging and narrow layout passed; the run then stopped at its existing rare-plant fixture expectation (`rare` expected, `normal` rendered, line 78). This pass did not change active garden rarity logic and does not claim that script fully passed.

Final aquarium integration: 167 targeted tests passed across fishing, aquarium desktop permissions, model catalogs, signed backups, application startup fixtures, packaging, localization and retired-feature guards. The full fishing UI and dedicated aquarium browser/desktop checks also passed. The attempted whole-repository unit run was interrupted after the historical `pet-animation.test.js` remained unfinished; an isolated run of that file also remained unfinished. This report does not claim a complete repository-wide pass. Two startup fixture stubs missing the new aquarium module were fixed and all 51 related startup/routing tests then passed.

## Mixed active garden and QA cleanup

Removed only selectors for the nonexistent companion/perch subtree from `garden-home.css`, `garden-theme.css`, `garden-pastoral.css`, `garden-collection-shop.css`, and `garden-world.css`. Chromium parsed both the original and cleaned stylesheets; every active selector, declaration and nested container rule is unchanged after filtering the retired selectors. This check also caught and corrected an intermediate malformed comment before final verification.

Mixed QA scripts retain active coverage while removing retired `Tracer.pet` setup and assertions: `qa-garden-home`, `qa-garden-pastoral`, `qa-garden-market`, `qa-garden-store`, and `qa-task-garden-world`. The store QA now tests drag, flip, hide/show, failed save and reload using the active reading bench furniture. Task-garden's no-manual-planting assertion targets the planting selector rather than every select element, allowing the active furniture layout selector. Garden collection, economy, harvest, persistence, furniture, material and wallpaper assertions remain.

Performance and lifecycle tools (`qa-commercial-performance`, `audit-performance`, `qa-desktop-lifecycle`) wait for the active fishing controller instead of the retired pet controller. Negative assertions that retired companion UI stays absent remain intentionally. Packaging exclusions, historical backup endpoints and data fields also remain intentionally.

## Exact deleted file list

- `skins/tracer/fishing-art/cabins-v2.png`
- `docs/alchemy-actions.png`
- `docs/alchemy-alphonse-craft-prompt.txt`
- `docs/alchemy-alphonse-life-prompt.txt`
- `docs/alchemy-art-manifest.json`
- `docs/alchemy-brothers-v2.webm`
- `docs/alchemy-brothers.md`
- `docs/alchemy-brothers.png`
- `docs/alchemy-brothers.webm`
- `docs/alchemy-desktop-v2.png`
- `docs/alchemy-edward-craft-prompt.txt`
- `docs/alchemy-edward-kitten-prompt.txt`
- `docs/alchemy-edward-life-prompt.txt`
- `docs/alchemy-linked-v2.png`
- `docs/alchemy-prompts.md`
- `docs/alchemy-props-prompt.txt`
- `docs/alchemy-v2-inbetween-prompts.json`
- `docs/alchemy-v2-prompts.json`
- `docs/alchemy-walk-rig-prompt.txt`
- `docs/anime-companion-art-prompts.json`
- `docs/anime-companions-preview.png`
- `docs/anime-companions-preview.webm`
- `docs/anime-companions.md`
- `docs/brook-continuity-prompts.json`
- `docs/brook-continuity.md`
- `docs/brook-continuous-transitions.png`
- `docs/brook-daily-performance.webm`
- `docs/brook-daily-prompts.json`
- `docs/brook-daily-sequence.png`
- `docs/brook-daily.md`
- `docs/brook-feather-v2-prompts.json`
- `docs/brook-feather-v2.webm`
- `docs/brook-fish-cels.png`
- `docs/brook-fish-happy-prompts.json`
- `docs/brook-fish-inbetweens-prompts.json`
- `docs/brook-fish-response.webm`
- `docs/brook-full-props.png`
- `docs/brook-lightness-comparison.png`
- `docs/brook-lightness-comparison.webm`
- `docs/brook-living-direction.md`
- `docs/brook-painted-16-actions.png`
- `docs/brook-painted-art-prompts.json`
- `docs/brook-painted-motion.md`
- `docs/brook-painted-prone.png`
- `docs/brook-painted-transitions.webm`
- `docs/brook-play.md`
- `docs/brook-remade-performance.webm`
- `docs/brook-remade-sequence.png`
- `docs/brook-remade-sleep.png`
- `docs/brook-remake-prompts.json`
- `docs/brook-remake.md`
- `docs/brook-skeletal-16-actions.png`
- `docs/brook-skeletal-16-actions.webm`
- `docs/brook-skeletal-fishing-phases.png`
- `docs/brook-skeletal-original-and-bones.png`
- `docs/brook-skeletal-preview.md`
- `docs/brook-skeletal-shoulders-before-after.png`
- `docs/brook-social-performance.webm`
- `docs/brook-social-prompts.json`
- `docs/brook-social-sequence.png`
- `docs/brook-social.md`
- `docs/brook-supported-sleep.png`
- `docs/brook-supported-wake.png`
- `docs/brook-waddle-and-snack.png`
- `docs/commercial-pet-visual-audit.md`
- `docs/companion-acting.md`
- `docs/companion-images-2026-09-25.md`
- `docs/companion-motion-v3-plants.png`
- `docs/companion-motion-v3-sprout.png`
- `docs/companion-motion-v3.md`
- `docs/companion-originals.md`
- `docs/companion-painted-v2-prompts.json`
- `docs/companion-skeletal-rigs.md`
- `docs/creature-rig-preview.webm`
- `docs/creature-rig-profiles.png`
- `docs/creature-rig-research.md`
- `docs/edward-spaced-transition-prompts.json`
- `docs/ember-anatomy-review.md`
- `docs/garden-trail-performance.json`
- `docs/illustrated-companion-rig.md`
- `docs/illustrated-companion-rig.png`
- `docs/moss-soft-motion.png`
- `docs/neon-orchid-trail-resolution.png`
- `docs/neon-orchid-trail-smooth.png`
- `docs/neon-orchid-trail-smooth.webm`
- `docs/photo-companion-generation-reliability.md`
- `docs/pixel-companions.md`
- `docs/plant-companion-motion.md`
- `docs/shiny-companion-trails.md`
- `docs/shiny-companion-trails.png`
- `docs/shiny-companion-trails.webm`
- `docs/shiny-trail-controls.png`
- `skins/tracer/fishing-art/rods-v2.png`
- `skins/tracer/fishing-art/fish-v1.png`
- `skins/tracer/garden-art/garden-perch-meadow-v2.png`
- `skins/tracer/garden-art/garden-perch-cyber-v2.png`
- `dev/qa-garden-props.cjs`
