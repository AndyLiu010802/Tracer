# Fishing art prompts

## Tackle box bait atlas

Saved to `skins/tracer/fishing-art/baits-v1.png` (1536 × 1024), generated with the built-in imagegen tool and transparent alpha. The seven baits replace the old text-symbol bait emblems.

Use case: stylized-concept. Asset type: seven transparent fishing bait game sprites for a cozy pastoral hand-painted fishing game, matching beautifully painted rustic cottages and natural pond flora. Create one 1536x1024 landscape atlas, exactly FOUR columns by TWO rows of equal rectangular cells, SEVEN separate bait subjects, the LAST bottom-right cell fully empty transparent. Every complete subject must stay within the central 65 percent width and 55 percent height of its own cell with generous empty transparent gutters, centered. NO grid, background, shadows beyond the subject, labels, text, jars, bowls, tins, UI or frames. Genuine alpha transparency. Smooth hand-painted storybook realism, natural curves, detailed supple materials, subtle soft highlights, rich restrained color. NO pixels, voxels, flat vector icons, harsh outlines, glitter clouds or surrounding scenery. Exact row-major subjects: row1 column1 one curled terracotta-pink earthworm with detailed segments and a small bright green leaf; column2 three golden grain-dough bait balls with a few attached wheat grains; column3 two coral-pink small whole prawns curled together, delicate shells and feelers; column4 a curled blue-green bioluminescent grub with tiny cream markings, restrained turquoise luminosity confined to body. Row2 column1 one frost-blue plump insect grub beside two tiny translucent ice shards; column2 one small pink lotus bud with three pale jade pearl-seeds nestled at its base, refined Chinese fantasy bait; column3 three violet and gold stardust-dough nuggets, crystalline sheen and tiny attached gold flecks, no floating star field. Row2 column4 EMPTY. Consistent warm upper-left studio light. Keep all seven small natural objects isolated and equally readable at 64px. All organic baits appealing and friendly rather than gross. Highly polished original inventory art.

Final art direction: cozy pastoral hand-painted illustration and smooth soft 3D; no pixel art. Generated with the built-in imagegen tool, with transparent_background enabled. Images are bundled locally and require no network at runtime. Atlas crop rectangles are measured from final output rather than inferred from visual grid lines.

## decor

Saved to `skins/tracer/fishing-art/pond-decor-v2.png`.

Use case: style-transfer. This is a production transparent game atlas for a cozy pastoral fishing game. Edit the provided target image. Replace the pixel-art rendering with smooth, beautifully hand-painted storybook illustration and softly modelled materials. Absolutely NO pixel art, voxel, mosaic, low-resolution edges, dithering or blocky shading. Smooth antialiased contours, subtle brushwork and natural rounded forms. Preserve the EXACT canvas composition, subject positions, subject scale, number and order; keep generous transparent separation between each subject. No text, no labels, no border, no ground or backdrop. Preserve genuine transparent alpha. Target: the 12 separate garden props: broad tree, willow, bush, flowers; reeds, smooth river rocks, wooden dock, lantern; bench, bait basket, lily pads, blank signpost. Make leaves supple and organic, timber warm and textured, stone smooth and rounded, flowers delicate. Late afternoon pastoral light, muted rich greens, ochre wood, warm cream. Preserve each original object's bounding rectangle exactly and do not connect neighbouring objects.

## Legendary aquarium

The aquarium uses the shared `fishing-aquarium.js` / `fishing-aquarium.css` scene with live fish models from `fishing-art.js`. Glass, water, plants, substrate and cabinet are rendered locally; the retired cabin atlas is no longer bundled.

## Fish and rod model catalogs

Fish and rod cards are rendered from the same procedural models as the live fishing scene. Run `node dev/build-fishing-catalog-art.cjs` to rebuild `fish-model-v1.png`, `rods-model-v1.png` and `catalog-model-v1.json`. The superseded illustrated fish and rod sheets and their generation prompts have been retired.
