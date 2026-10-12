# Desktop garden scene synchronization

The default desktop view now renders `TracerGardenWorldView`, the same live scene used by the application, in compact mode. It shares all six regional backgrounds, ground anchors, plant artwork, collectible artwork, layout transforms and styles. Compact mode hides the surrounding panels, retains harvest controls, and renders plant poses without an idle animation loop. This is a layered isometric view, not a screenshot or a freely rotating 3D reconstruction.

Since 0.4.7, the desktop has no orbit mode or WebGL dependencies. Its header appears on hover (or keyboard focus), and the bottom status bar is removed. Hiding the header does not change the scene bounds.

`garden.js` publishes accepted workspace data using the same plant stage calculation and page ordering as the application. The native bridge only forwards known furniture IDs and bounded positions, scale, orientation and mirror state; it continues to enforce account/session isolation. Unsaved edits do not replace the accepted scene. Switching farms replaces the visible placement list rather than retaining the preceding farm's furniture.

The shared furniture CSS mirrors only the outer SVG. Mirroring the nested atlas viewport also would move some furniture outside its crop and make it disappear.

Validation:

- `node --test desktop/test/garden.test.js test/garden-desktop-3d.test.js test/garden-collectibles.test.js`
- `node dev/qa-garden-live-sync.cjs`: isolated application, real purchase/save/reload flow, pagination, growth stages, movement, scaling, orientation, mirror and removal.
- `node dev/qa-garden-desktop-sync.cjs`: six regional scenes, furniture transforms, harvest, hover/keyboard controls, absence of orbit/footer, idle behavior, hiding and restoration.
- `node dev/desktop-pack-assets.cjs`: includes the shared scene dependencies and all fifteen furniture atlases.

QA uses synthetic workspaces under `.cache`; it does not modify the user's saved garden. No installer is rebuilt by these checks.
