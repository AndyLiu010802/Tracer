# Planet postcards

Open **Shop → Postcards** to collect stationery with garden coins. Open **Flower constellation → Create a postcard** to use the selected world's current viewing angle. The left side contains the actual world; the right side contains the project, date, editable recipient, message and sender. Export produces a 2400 × 1600 PNG. The message is limited to 180 characters; drafts last for the open editor session.

| Edition | Price | Art direction |
| --- | ---: | --- |
| A letter from the meadow | Free | Cream stock, sage field, editorial serif typography, terracotta accent |
| Forest keepsake | 60 coins | Botanical archive, dark green arch, leaf linework, specimen postage stamp |
| Vintage correspondence | 80 coins | Airmail border, tilted photo paper, translucent tape and cancellation marks |
| The midnight post | 120 coins | Navy paper, celestial plotting rings, star details and champagne ink |

These are original code-rendered layouts informed by contemporary stationery references, not copies of templates or a claim of a ranked best-selling style. References consulted September 24, 2026:

- [The Oxford Kitchen & Garden Co — Hand-Drawn Stationery Trends for 2026](https://theoxfordkitchenandgardenco.com/blogs/latest-news/hand-drawn-stationery-trends-for-2026): personal artwork, paper texture, whitespace and expressive type.
- [Cavallini — Vintage Postcards](https://www.cavallini.com/vintage-postcards): cream paper and archival botanical presentation.
- [Kartenkarge — Postkarten Trends 2026](https://blog.kartenkarge.de/2026/08/05/postkarten-trends-2026/): individual illustration, tactile material and meaningful keepsakes.

## Implementation and checks

`postcards.js` shares its drawing function between shop thumbnails, editor previews and downloads. Planet snapshots wait for decoded local assets, render at export resolution, preserve the current yaw and pitch, and exclude selection highlights. Failed image loads keep export disabled with a retry instruction. The renderer cleans up offscreen observers and animation handles.

`taskGarden.market.postcards.purchases` stores immutable edition IDs and purchase timestamps. Client and server validation share the catalog and wallet accounting; merge deduplicates purchases, retains accepted ownership and reconciles competing purchases against available coins. No external payment service is involved.

Validation: `node --test test/postcards.test.js test/task-garden*.test.js test/garden-planets-view.test.js`; `node dev/qa-postcards.cjs` with Playwright Core and Edge. The browser check uses an isolated temporary workspace, exercises real saves and reloads, tests locked styles, exports and reads a PNG, checks mobile layout and long English copy, and writes a four-style contact sheet into its `.cache/postcards-*` directory.
