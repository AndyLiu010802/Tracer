# Peach normal final four actions

Mode: built-in imagegen. Original PNG alpha and pixels preserved. Identity reference: peach-v2.png, bottom-middle normal creature only. Four independent calls produce look, shy, eat and thanks, each 4 × 4 consecutive frames.

## Identity

Use ONLY NORMAL PEACH sprite in BOTTOM MIDDLE of identity atlas. Rounded pink-peach fruit-shaped head/bonnet with fine peach fuzz and central cleft, cream round face and large warm amber-brown eyes, rosy cheeks, soft small cream petal-shaped plump torso, green leaf collar/cape with little pink blossoms, a larger pale PINK peach blossom with gold stamens and pointed green leaves above forehead, tiny cream hands and thin brown root feet. Same cute woodland fairy proportions, precisely two arms and two feet, do not change crown arrangement.

## Common framing

Production 16-frame CONTINUOUS animation sprite sheet for ONE exact existing character. Detailed soft hand-painted cozy pastoral game illustration, cute and warm, same fine rendering as reference. Exactly 4 columns by 4 rows = 16 equal cells in reading order, square 2048x2048 RGBA PNG with REAL transparent alpha outside character. All 16 cells show the SAME full-body character at the SAME scale and fixed frontal three-quarter camera, identical lighting, botanical head size, costume, face design and palette. Each equal cell is mostly transparent padding: ALL character artwork occupies only the CENTRAL 60% of cell height and central 60% width, leaving 20% genuinely empty alpha on EVERY side. Entire stem top, leaf tips, petals and feet are inside this central area. Shared standing foot baseline is at 78% of each cell height. Do not zoom to fill cells. This generous padding is a required game-engine safety margin. No cropped petals, leaves, stems or feet, no overlap between cells. Props if specified stay within those bounds. Motion unfolds in tiny sequential steps, not 16 unrelated poses or character designs. Except rest/walk, frame 16 returns smoothly to frame 1. Never stretch/squash the entire drawing. NO background fill, checkerboard, scenery, ground/shadow, vignette, glow cloud, grid, frame borders, text, captions or numbers. Preserve exquisite details. Background MUST be transparent, not simulated transparency.

## look

Curiously looking around. Frames 1-3 neutral, 4-6 turn head slightly to screen-left and glance, 7-8 return center, 9-11 turn slightly screen-right and glance, 12-13 little inquisitive head tilt, 14-16 return center neutral. Keep full face mostly visible, feet planted, no large rotation.

## shy

A cute bashful reaction. Frames 1-3 neutral, 4-6 small leaf hands rise to cheeks, 7-10 blush softly and tip head with eyes looking down, 11-13 peek toward viewer, 14-16 lower hands and return neutral. Keep leaf hands readable, no hearts or floating symbols.

## eat

A tiny snack. Frames 1-3 neutral, 4-6 lift ONE small golden berry held in leaf hand, 7-10 take two tiny nibbles with sweet closed-eye smile, 11-13 swallow and lower hand as berry disappears, 14-16 return neutral. The snack is very small; bonnet fruits/petals must remain unchanged.

## thanks

A warm thank-you bow. Frames 1-3 neutral, 4-6 bring both hands together over chest, 7-10 incline the upper body forward a little with a closed-eye grateful smile, 11-13 rise, 14-16 return neutral. Feet stay grounded, bonnet tilts as a solid unchanged shape.

Each final prompt combines identity, the relevant action and common framing. Final assets: peach-normal-{look,shy,eat,thanks}-v2.png in this directory. Acceptance uses the source PNG inspector and actual in-app cropper.

