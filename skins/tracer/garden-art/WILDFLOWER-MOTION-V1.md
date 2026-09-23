# Wildflower motion, first refinement

Scope: only the mature rare wildflower companion and its shiny variant. Ordinary flowers remain faceless. Other species keep their existing illustrations and motion.

Generated using the built-in ImageGen tool, with `wildflower-v2.png` as the identity/palette reference and the first idle sheet as the animation reference. The six original transparent RGBA files are stored in this directory:

- `wildflower-normal-idle-v1.png`
- `wildflower-normal-greet-v1.png`
- `wildflower-normal-celebrate-v1.png`
- `wildflower-shiny-idle-v1.png`
- `wildflower-shiny-greet-v1.png`
- `wildflower-shiny-celebrate-v1.png`

Each sheet contains 16 frames in a 4 × 4 grid. Actual output is 1254 × 1254, so the runtime uses measured integer crop boundaries rather than assuming the requested 2048 × 2048 size. The original PNG pixels and alpha are unchanged. `garden-wildflower-atlas.js` records alpha bounds and one fixed scale per sheet; the root anchor is (80,151). Celebration adds a restrained 7-unit hop with a matching ground shadow.

Idle gives the character a quiet interval between short blinks. Greeting and celebration return to a shared neutral drawing, run once, and cannot restart on repeated clicks. Focus, sleep, reduced motion, hidden pages and leaving the viewport cancel temporary actions without later replay. Only successfully committed new task counts trigger celebrations; initial loading, reloads, failed saves and project reordering do not.

All instances reuse one scheduler and one decoded copy of each sheet per document. A failed asset load retains the existing illustrated sprite. Late image loads cannot revive a destroyed player.

## Final prompts

### normal / idle

Use case: identity-preserve.
Edit target/reference: attached atlas. Use ONLY the pink wildflower creature in the BOTTOM MIDDLE cell as the exact character identity. Ignore all other subjects. Keep her cream pear-shaped body, amber eyes, tiny mouth, layered pink daisy bonnet with golden stamens, green leaf collar and sleeves, two little root feet. Match the exquisite soft detailed painted art exactly.
Make a production ANIMATION sprite sheet for this single creature's gentle IDLE AND BLINK action. Square 2048x2048 transparent PNG. EXACTLY 4 columns x 4 rows, 16 equal 512x512 cells in reading order. Same character at exactly same scale, position, camera, lighting, colors, proportions and detailed bonnet in every frame. Do not redesign between frames. Every frame shows full body, no crop, front view angled very slightly left as reference. Fixed root-foot baseline at local y452, body center x256, maximum art bounds x70..442 and y50..454, no ground/shadow/background. Both root feet stay planted in identical positions.
Motion is tiny and believable: frames 1-4 gentle breathing in, body rises 1-2 pixels while feet stay fixed and leaves lift slightly; frames 5-6 eyes relax to half closed; frames 7-8 both eyes CLOSED in a sweet smile with curved lids; frames 9-10 reopen the SAME amber eyes; frames 11-14 gently breathe out, leaf sleeve tips settle; frames 15-16 EXACTLY return to initial open-eyed neutral pose for a seamless loop. Mouth stays small soft smile, no talking or exaggerated grin. Petals have subtle secondary settling, no head bobbing, no stretching the whole sprite.
This is a usable animation sheet, not character concepts: all 16 cells repeat the same character with SMALL successive frame changes. NO text, numbers, grid lines, props, scenery or particles. Truly transparent alpha outside each sprite. Preserve illustration detail.

### normal / greet

Use case: identity-preserve. Create one production animation sprite sheet for the WILDFLOWER companion.
Image 1 is the identity and palette reference. Image 2 is a reference for consistent small animation steps, proportions and rendering quality; it is not a recoloring target.
Identity: The normal PINK character at bottom middle of image 1. Keep her pink daisy bonnet, amber eyes, cream pear body, green leaf collar, tiny hands and root feet.
Action: Friendly greeting. Frames 1-3 neutral attentive pose, slight head turn towards viewer. Frames 4-6 raise only the screen-left little hand and leaf sleeve to cheek height. Frames 7-10 two small warm waves using the wrist, with a cheerful soft smile and one blink. Frames 11-13 lower hand gently. Frames 14-16 settle back to the exact neutral pose. Feet stay planted. No big body squash, no spinning, no props.
Exactly 4 columns by 4 rows = 16 successive animation frames in reading order, 2048x2048 transparent PNG. Repeat the SAME full-body character, same detailed painted illustration style, same fixed scale, same frontal three-quarter camera, same top-left light. The pose of frame 1 and 16 must closely match image 2 frame 1. No redesigns.
Every cell is 512x512; KEEP ALL ART IN x80..432,y65..450 with large genuinely transparent gutters. Root-foot ground baseline y450, center x256 in each cell. BOTH feet stay on that baseline except the specified tiny jump. Petal bonnet size MUST remain identical. Do not make character taller or shorter across cells. Full silhouette visible, no cropped petals/feet or cell bleed. No text, grid, numbers, props, background color, ground shadow, colored glow, outlines around transparent edges, or watermark. Preserve fine beautiful illustration detail.

### normal / celebrate

Use case: identity-preserve. Create one production animation sprite sheet for the WILDFLOWER companion.
Image 1 is the identity and palette reference. Image 2 is a reference for consistent small animation steps, proportions and rendering quality; it is not a recoloring target.
Identity: The normal PINK character at bottom middle of image 1. Keep her pink daisy bonnet, amber eyes, cream pear body, green leaf collar, tiny hands and root feet.
Action: Small heartfelt celebration of finishing a task. Frames 1-3 attentive neutral then tiny anticipation knee bend. Frames 4-6 both little hands raise happily. Frames 7-8 one TINY hop only 10px above baseline, delighted closed curved eyes, petals lag softly. Frames 9-11 gentle landing and knee bend, no deep squash. Frames 12-14 happy little nod, hands lower. Frames 15-16 return to exact open-eyed neutral starting pose. No confetti or particles; code will add those. No props, no spinning.
Exactly 4 columns by 4 rows = 16 successive animation frames in reading order, 2048x2048 transparent PNG. Repeat the SAME full-body character, same detailed painted illustration style, same fixed scale, same frontal three-quarter camera, same top-left light. The pose of frame 1 and 16 must closely match image 2 frame 1. No redesigns.
Every cell is 512x512; KEEP ALL ART IN x80..432,y65..450 with large genuinely transparent gutters. Root-foot ground baseline y450, center x256 in each cell. BOTH feet stay on that baseline except the specified tiny jump. Petal bonnet size MUST remain identical. Do not make character taller or shorter across cells. Full silhouette visible, no cropped petals/feet or cell bleed. No text, grid, numbers, props, background color, ground shadow, colored glow, outlines around transparent edges, or watermark. Preserve fine beautiful illustration detail.

### shiny / idle

Use case: identity-preserve. Create one production animation sprite sheet for the WILDFLOWER companion.
Image 1 is the identity and palette reference. Image 2 is a reference for consistent small animation steps, proportions and rendering quality; it is not a recoloring target.
Identity: The SHINY creature at BOTTOM RIGHT of image 1: pearl-lilac daisy bonnet with gold petal tips and golden stamens, small golden flower accents, amber eyes, cream-mint pear body, deep teal leaf collar and sleeves, little brown root feet. Keep these distinct colors painted into every frame. No floating sparkle decorations.
Action: Quiet idle and blink. Frames 1-4 breathe in very subtly, leaf tips lift while feet stay planted. Frames 5-6 eyelids half-close. Frames 7-8 both eyes CLOSED as curved happy lids. Frames 9-10 reopen amber eyes. Frames 11-14 breathe out and let leaf tips settle. Frames 15-16 exactly return to initial open-eyed neutral. No exaggerated body bob or stretch.
Exactly 4 columns by 4 rows = 16 successive animation frames in reading order, 2048x2048 transparent PNG. Repeat the SAME full-body character, same detailed painted illustration style, same fixed scale, same frontal three-quarter camera, same top-left light. The pose of frame 1 and 16 must closely match image 2 frame 1. No redesigns.
Every cell is 512x512; KEEP ALL ART IN x80..432,y65..450 with large genuinely transparent gutters. Root-foot ground baseline y450, center x256 in each cell. BOTH feet stay on that baseline except the specified tiny jump. Petal bonnet size MUST remain identical. Do not make character taller or shorter across cells. Full silhouette visible, no cropped petals/feet or cell bleed. No text, grid, numbers, props, background color, ground shadow, colored glow, outlines around transparent edges, or watermark. Preserve fine beautiful illustration detail.

### shiny / greet

Use case: identity-preserve. Create one production animation sprite sheet for the WILDFLOWER companion.
Image 1 is the identity and palette reference. Image 2 is a reference for consistent small animation steps, proportions and rendering quality; it is not a recoloring target.
Identity: The SHINY creature at BOTTOM RIGHT of image 1: pearl-lilac daisy bonnet with gold petal tips and golden stamens, small golden flower accents, amber eyes, cream-mint pear body, deep teal leaf collar and sleeves, little brown root feet. Keep these distinct colors painted into every frame. No floating sparkle decorations.
Action: Friendly greeting. Frames 1-3 neutral attentive pose, slight head turn towards viewer. Frames 4-6 raise only the screen-left little hand and leaf sleeve to cheek height. Frames 7-10 two small warm waves using the wrist, with a cheerful soft smile and one blink. Frames 11-13 lower hand gently. Frames 14-16 settle back to exact neutral pose. Feet stay planted. No big body squash, no spinning, no props.
Exactly 4 columns by 4 rows = 16 successive animation frames in reading order, 2048x2048 transparent PNG. Repeat the SAME full-body character, same detailed painted illustration style, same fixed scale, same frontal three-quarter camera, same top-left light. The pose of frame 1 and 16 must closely match image 2 frame 1. No redesigns.
Every cell is 512x512; KEEP ALL ART IN x80..432,y65..450 with large genuinely transparent gutters. Root-foot ground baseline y450, center x256 in each cell. BOTH feet stay on that baseline except the specified tiny jump. Petal bonnet size MUST remain identical. Do not make character taller or shorter across cells. Full silhouette visible, no cropped petals/feet or cell bleed. No text, grid, numbers, props, background color, ground shadow, colored glow, outlines around transparent edges, or watermark. Preserve fine beautiful illustration detail.

### shiny / celebrate

Use case: identity-preserve. Create one production animation sprite sheet for the WILDFLOWER companion.
Image 1 is the identity and palette reference. Image 2 is a reference for consistent small animation steps, proportions and rendering quality; it is not a recoloring target.
Identity: The SHINY creature at BOTTOM RIGHT of image 1: pearl-lilac daisy bonnet with gold petal tips and golden stamens, small golden flower accents, amber eyes, cream-mint pear body, deep teal leaf collar and sleeves, little brown root feet. Keep these distinct colors painted into every frame. No floating sparkle decorations.
Action: Small heartfelt celebration of finishing a task. Frames 1-3 attentive neutral then tiny anticipation knee bend. Frames 4-6 both little hands raise happily. Frames 7-8 one TINY hop only 10px above baseline, delighted closed curved eyes, petals lag softly. Frames 9-11 gentle landing and knee bend, no deep squash. Frames 12-14 happy little nod, hands lower. Frames 15-16 return to exact open-eyed neutral starting pose. No confetti or particles; code will add those. No props, no spinning.
Exactly 4 columns by 4 rows = 16 successive animation frames in reading order, 2048x2048 transparent PNG. Repeat the SAME full-body character, same detailed painted illustration style, same fixed scale, same frontal three-quarter camera, same top-left light. The pose of frame 1 and 16 must closely match image 2 frame 1. No redesigns.
Every cell is 512x512; KEEP ALL ART IN x80..432,y65..450 with large genuinely transparent gutters. Root-foot ground baseline y450, center x256 in each cell. BOTH feet stay on that baseline except the specified tiny jump. Petal bonnet size MUST remain identical. Do not make character taller or shorter across cells. Full silhouette visible, no cropped petals/feet or cell bleed. No text, grid, numbers, props, background color, ground shadow, colored glow, outlines around transparent edges, or watermark. Preserve fine beautiful illustration detail.

