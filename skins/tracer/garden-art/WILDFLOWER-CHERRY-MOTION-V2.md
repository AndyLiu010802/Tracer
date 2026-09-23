# Wildflower and cherry: 16 actions, 16 frames each

Generated individually using the built-in imagegen tool. Original transparent PNG pixels are preserved. Normal and shiny identities reference bottom-middle and bottom-right creatures in the existing kind-v2.png illustration atlas. Existing wildflower idle, greet and celebrate v1 sheets are reused; every other action is generated separately as v2.

Runtime measurements and acceptance are recorded by the companion atlas build tool. A requested 2048 px sheet is not assumed to have that output resolution.

## Common generation constraints

Production 16-frame CONTINUOUS animation sprite sheet for ONE exact existing character. Detailed soft hand-painted cozy pastoral game illustration, cute and warm, same fine rendering as reference. Exactly 4 columns by 4 rows = 16 equal cells in reading order, square 2048x2048 RGBA PNG with REAL transparent alpha outside character. All 16 cells show the SAME full-body character at the SAME scale and fixed frontal three-quarter camera, identical lighting, botanical head size, costume, face design and palette. Each 512px cell: character centered x256, shared ground baseline y434, full artwork confined x88..424, y62..440; large clean transparent gutters on ALL four sides. No cropped petals, leaves, stems or feet, no overlap between cells. Props if specified stay within those bounds. Motion unfolds in tiny sequential steps, not 16 unrelated poses or character designs. Except rest/walk, frame 16 returns smoothly to frame 1. Never stretch/squash the entire drawing. NO background fill, checkerboard, scenery, ground/shadow, vignette, glow cloud, grid, frame borders, text, captions or numbers. Preserve exquisite details. Background MUST be transparent, not simulated transparency.

## Character identity prompts

### wildflower-normal

Use ONLY the pink wildflower creature in the BOTTOM MIDDLE of the reference atlas: same pink daisy petal bonnet with golden stamens, cream pear-shaped little body, warm amber eyes, tiny soft mouth, green leaf collar and sleeves, two little brown root feet. No redesign.

### wildflower-shiny

Use ONLY the shiny wildflower creature in the BOTTOM RIGHT of the reference atlas: pearly pale lavender-white daisy bonnet with delicate gold tips and little gold flower ornaments, warm amber eyes, pale mint-cream pear body, teal leaf collar and sleeves, small brown root feet. Retain original shiny colors in every frame. No redesign.

### cherry-normal

Use ONLY the cherry creature in the BOTTOM MIDDLE of reference atlas: large twin glossy ruby-red cherries form the bonnet, two joined curved green stems above the head with ONE veined green leaf at their meeting point, cream round face and little body, large warm amber-brown eyes, pink cherry-blossom collar with one centered five-petal flower, green leaf cloak/sleeves, two small brown root feet. Bonnet cherries are attached parts, always exactly two and unchanged.

### cherry-shiny

Use ONLY the SHINY cherry creature in the BOTTOM RIGHT of reference atlas: large twin translucent rosy-pink/opalescent cherries with tiny warm gold flecks form the bonnet, two joined curved gold stems above head with ONE blue-teal veined leaf, cream face/body, purple-violet eyes, pale pink cherry-blossom collar with one centered five-petal flower, blue-teal leaf cloak/sleeves, small brown root feet. Keep two iridescent cherries and shiny palette identical. No floating sparkle effects.

## Action prompts

### idle

Gentle breathing and a single blink. Frames 1-4 quietly breathe in, 5-7 eyes half close, 8-9 eyes fully closed in a soft smile, 10-12 reopen, 13-16 settle into the exact first neutral pose. Feet planted.

### greet

A warm hand wave. Frames 1-3 neutral, 4-6 lift screen-left little hand beside cheek, 7-10 two small wrist waves with one blink, 11-13 lower hand, 14-16 return to neutral. Feet planted.

### walk

One smooth WALK-IN-PLACE cycle. Frames 1-4 left foot advances as right arm advances, 5-8 weight transfers, 9-12 right foot advances with left arm, 13-16 return to cycle start. Keep body centered, tiny root feet visible, no travel across cell.

### hop

One little joyful jump. Frames 1-3 neutral, 4-6 gently crouch with arms low, 7-9 spring upward with both feet visibly lifted a small distance, 10-12 descend and softly land, 13-16 return to neutral. Same ground baseline across cells; lifted feet intentionally sit ABOVE it.

### water

Enjoying gentle watering. Frames 1-3 attentive neutral, 4-6 cup both leaf sleeves to catch two tiny water drops, 7-10 raise face happily with a blink, 11-13 shake two small droplets off leaves, 14-16 dry neutral. Tiny transparent isolated droplets only, no large watering can.

### pet

Being gently stroked by an invisible caretaker. Frames 1-3 neutral, 4-7 tilt head to screen-left and close eyes contentedly, 8-11 lean softly the other way with a tiny pleased smile, 12-16 reopen eyes and return neutral. No human hands or extra person. No squashing or size changes.

### music

A cozy small dance. Frames 1-3 neutral, 4-6 little left side-step and leaf hands lift, 7-10 small right side-step and rhythmic hand sway, 11-13 gently bounce on toes, 14-16 return neutral. Full detailed body stays at same scale, small graceful motion, no music notes.

### celebrate

A delighted celebration. Frames 1-3 neutral, 4-6 raise BOTH leaf arms in a V with bright happy eyes, 7-9 one tiny victorious upward hop, 10-12 soft landing while arms remain raised, 13-16 lower arms into initial neutral pose. No confetti. Preserve feet and fixed ground level.

### rest

Settling into a peaceful nap. Frames 1-3 standing but drowsy, 4-6 softly lower into a compact seated resting pose, 7-10 eyes fully closed, head rests on leaf sleeve and breathes gently, 11-13 continue relaxed breathing, 14-16 calm asleep endpoint. Do not morph body or remove feet; this action intentionally ends asleep.

### focus

A quietly concentrated loop. Frames 1-4 calm neutral looking slightly down, 5-8 bring leaf hands together attentively at belly, 9-12 a tiny thoughtful nod and gentle blink, 13-16 return to initial quiet stance. No book or text, no props, very restrained movement.

### breeze

A passing breeze ruffles the plant. Frames 1-3 neutral, 4-6 botanical bonnet/leaf tips lean gently right while body holds its position, 7-10 slightly stronger flutter of leaves with a closed-eye happy smile, 11-13 wind dies down, 14-16 return exactly neutral. No gust lines or effects, identity never changes.

### stretch

A sleepy, sweet stretch. Frames 1-3 neutral, 4-6 raise leaf arms slowly overhead, 7-10 stand on tiptoes and stretch with one small yawn and closed eyes, 11-13 lower arms, 14-16 settle into neutral alert smile. Do not elongate the torso, use joint poses.

### look

Curiously looking around. Frames 1-3 neutral, 4-6 turn head slightly to screen-left and glance, 7-8 return center, 9-11 turn slightly screen-right and glance, 12-13 little inquisitive head tilt, 14-16 return center neutral. Keep full face mostly visible, feet planted, no large rotation.

### shy

A cute bashful reaction. Frames 1-3 neutral, 4-6 small leaf hands rise to cheeks, 7-10 blush softly and tip head with eyes looking down, 11-13 peek toward viewer, 14-16 lower hands and return neutral. Keep leaf hands readable, no hearts or floating symbols.

### eat

A tiny snack. Frames 1-3 neutral, 4-6 lift ONE small golden berry held in leaf hand, 7-10 take two tiny nibbles with sweet closed-eye smile, 11-13 swallow and lower hand as berry disappears, 14-16 return neutral. The snack is very small; bonnet fruits/petals must remain unchanged.

### thanks

A warm thank-you bow. Frames 1-3 neutral, 4-6 bring both hands together over chest, 7-10 incline the upper body forward a little with a closed-eye grateful smile, 11-13 rise, 14-16 return neutral. Feet stay grounded, bonnet tilts as a solid unchanged shape.

Each final prompt combines the relevant identity, the relevant action progression, and the common constraints. The original character atlas is passed as an identity reference; where used, the corresponding idle sheet is a continuity reference.

## Framing correction after first acceptance pass

For subsequent sheets and replacements of clipped sheets, the common framing instruction above is superseded by: ALL character artwork occupies only the CENTRAL 60% of each cell height and width, leaving 20% genuinely empty alpha on EVERY side. Entire stem top, leaf tips, petals and feet stay inside that central area. Shared standing foot baseline is at 78% of each cell height. Do not zoom to fill cells. Only the original kind atlas is used as the identity reference, so earlier tightly framed motion sheets do not propagate their framing. The original PNG remains unchanged; rejected workspace copies are backed up under `.cache/companion-motion-rejected` before replacement.
