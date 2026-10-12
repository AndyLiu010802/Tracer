# Furniture purchases and art postcards

Furniture now requires only the listed coins. Historical harvest/species milestones no longer block buying, validating or merging purchases. Existing prices, receipts, ownership and placement remain intact. Failed local actions can be retried.

The twelve stationery backgrounds in `skins/tracer/postcard-art/*-v2.png` were generated with the built-in `image_gen.imagegen` tool. Originals were copied without modification. Exact prompts and source filenames are recorded in `skins/tracer/postcard-art/generation-v2.json`.

The shop loads visible artwork on demand, retains painted thumbnails and limits its decoded background cache. The editor offers artwork thumbnails, retries failed background loads, and prevents export until the chosen artwork, planet and stickers are available.

World composition supports pointer dragging, arrow keys, a size slider and reset. Preferences are stored locally per account and planet; they are not cloud-synced. Style changes retain the user's offset and scale relative to each artwork's illustration centre. The planet's visible bounds are measured once per snapshot, excluding faint transparent glow, so asymmetric canvas margins do not shift its apparent centre. Preview and 2400 × 1600 PNG export share the same placement calculation.

Validation:

- `test/garden-collectibles.test.js`: purchases with no harvests, fixed deductions, no duplicate charges, reload, merging and furniture placement.
- `test/postcards.test.js`: shared wallet and immutable purchase receipts.
- `test/postcard-world-layout.test.js`: preference isolation, corrupt storage, bounds, proportional export coordinates and visible-content centring.
- `dev/qa-furniture-postcards.cjs`: real browser purchases, reload, all twelve styles, sticker editing, planet dragging/resizing/reset, exported image coordinates, failed artwork retry and mobile layout.
- `dev/desktop-pack-assets.cjs`: generated art and rendering modules are retained by packaging.

The wider isolated test run had a Windows process crash in `server.test.js`; its separate isolated rerun passed all 15 tests. Other tests in that run passed, including all 68 desktop tests. No installer or release was generated for this change.
