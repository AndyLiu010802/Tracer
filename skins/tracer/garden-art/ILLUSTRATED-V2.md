# Illustrated plant sprites v2

Generated with the built-in ImageGen tool. The six original RGBA PNG files are stored beside this document as `<kind>-v2.png`. Their original pixels and alpha are preserved without background removal or recoloring. ImageGen previews may show the RGB matte, while browser rendering correctly applies the alpha channel.

Each file has a 3 × 2 grid: seedling, budding plant, ordinary mature plant; ordinary mature plant, rare companion, shiny companion. Runtime uses cell 3 for mature plants and cells 4/5 for the two companions. Stages 2 and 3 use the budding illustration at different sizes. Stage 0 retains the small seed drawing.

`../garden-plant-atlas.js` contains measured crop bounds from `dev/inspect-garden-atlas.cjs`. SVG viewports crop the atlas at runtime; images themselves are untouched. Each drawing is scaled around the same ground anchor (80,151) in the 160 × 176 sprite space. A shared requestAnimationFrame player supplies continuous sway, bounce and squash poses; these are animated illustrations, not separately painted frame-by-frame motion sheets.

## Final prompt set

### wildflower

Use case: stylized-concept.
Asset type: production transparent 3-column by 2-row game sprite atlas for a cute pastoral desktop garden. This is ONE WILDFLOWER evolution asset sheet. Canvas 1536x1024, exactly six equal 512x512 cells, no visible grid.
Art direction: exquisite premium cozy farming RPG sprite illustrations, fine controlled pixel clusters at approximately 192px native detail per cell, gentle three-quarter isometric view, beautifully shaded layered foliage, soft sunlit highlights, rich tiny botanical details, expressive collectible-creature quality comparable to a lovingly rendered game character, NOT flat vector icons, NOT crude blocky symbols, NOT photoreal, not creepy. Distinct readable silhouettes and warm friendly temperament.
Top row left: young wildflower seedling, 4 tender intricately shaded green leaves, NO face.
Top row middle: leafy wildflower bush, rich rounded layered foliage and a few closed rosy buds, NO face.
Top row right: mature ordinary wildflower clump with 3 large pink-and-ivory daisy-like blossoms, golden detailed centers, leaves of varied size and elegantly curved short stems. Completely natural plant, NO eyes mouth or face.
Bottom row left: the same mature ordinary wildflower clump at full bloom, no face. Match top-right closely.
Bottom row middle: rare fantasy wildflower companion, tiny lovable rounded botanical creature: cream pear-shaped body, pink daisy bonnet made of many delicate shaded petals, amber eyes, tiny smile, leaf collar, little leaf hands and root feet. Full body, adorable rather than uncanny, botanical identity clear.
Bottom row right: unique SHINY version of that same companion: pearl-ivory and pale lilac petals with subtle gold tips, deep teal leaf collar, pale mint body, warm golden eyes, two small star-shaped petal accents. Same recognizable body and proportions; premium rare palette painted into the sprite. A few tiny contained gold sparkles.
Layout is strict for CSS clipping: one sprite centered inside EACH cell. Every sprite including tiny seedlings has its ground contact at local cell (256,440), no sprite extends beyond x=66..446 or y=50..452. Mature plants and companions around 360px tall; seedling shorter. All leaves and sparkles stay inside own cell with large transparent gutters. Consistent lighting from top left and viewing angle. NO text, NO labels, NO arrows, NO pots, NO soil tiles, NO background scene, NO backdrop color, NO checkerboard painted into image, NO cast ground shadow. Truly transparent PNG background with clean alpha. High craft and charm.

### sunflower

Use case: stylized-concept. Production game sprite atlas, ONE SUNFLOWER species, 1536x1024 image, strict 3 columns by 2 rows of six isolated illustrations on a CLEAN FULLY TRANSPARENT BACKGROUND. No environment, gradients, colored backdrop, shadow, or glow haze. If transparency cannot be represented, use absolutely uniform pure white #ffffff only.
Premium cute pastoral farming RPG style: exquisitely detailed botanical fantasy illustration with fine pixel-like texture, soft warm highlights, carefully shaded materials, layered leaves and tiny veins, polished collectible character quality. Cheerful and lovable, no creepiness, no flat vector shapes or crude low-resolution blocks.
Top row left-to-right: tender sunflower seedling; leafy young sunflower with one closed bud; mature natural sunflower with one large golden head and two smaller blossoms, rich patterned brown seed center and broad textured leaves. These first THREE sprites are ordinary natural plants, strictly NO eyes, NO mouth, NO faces.
Bottom row left: the same mature natural plant as top-right, without any face.
Bottom row middle: RARE plant companion: a tiny happy sunflower spirit with a round cream face inside a lush golden-petal mane, honey eyes, soft moss-green body, leaf cloak, little root feet. Full body, cute rounded proportions, charming personality, botanical detail.
Bottom row right: SHINY variant of the same companion, same shape and pose, uniquely PAINTED ivory-gold petals, rich midnight-blue and teal foliage, pearl body, amber eyes and tiny golden star petals. A few tiny isolated sparkles only, no glow backdrop.
Precise grid: every cell is 512x512. Each sprite centered horizontally at local x256, feet/root contact at local y440. Entire silhouette must stay within local x66..446 and y60..448, with clear generous empty margins separating the six sprites. Mature sprites ~360px high; seedlings smaller. One subject per cell, consistent three-quarter isometric angle and top-left lighting. No pots or ground patch, no text or labels or grid lines, no watermark. Fine clean cutout edges.

### lavender

Use case: stylized-concept. Production game sprite atlas, ONE LAVENDER species, 1536x1024 image, strict 3 columns by 2 rows of six isolated illustrations on a CLEAN FULLY TRANSPARENT BACKGROUND. No environment, gradients, colored backdrop, shadow, or glow haze. If transparency cannot be represented, use absolutely uniform pure white #ffffff only.
Premium cute pastoral farming RPG style: exquisitely detailed botanical fantasy illustration with fine pixel-like texture, soft warm highlights, carefully shaded materials, layered leaves and tiny veins, polished collectible character quality. Cheerful and lovable, no creepiness, no flat vector shapes or crude low-resolution blocks.
Top row left-to-right: tiny lavender seedling; silvery leafy lavender bush with closed purple buds; lush compact flowering lavender bush with many layered violet flower spikes and fine silvery sage leaves. These first THREE sprites are ordinary natural plants, strictly NO eyes, NO mouth, NO faces.
Bottom row left: the same mature natural plant as top-right, without any face.
Bottom row middle: RARE plant companion: a tiny round lavender sprite with a soft cream face, lilac flower bonnet and rabbit-ear-like flower spikes, purple eyes, layered sage-leaf cape, little root feet. Full body, cute rounded proportions, charming personality, botanical detail.
Bottom row right: SHINY variant of the same companion, same shape and pose, uniquely PAINTED pearl-white and blush-pink flower spikes, pale turquoise foliage, soft ivory body, violet eyes and tiny silver star petals. A few tiny isolated sparkles only, no glow backdrop.
Precise grid: every cell is 512x512. Each sprite centered horizontally at local x256, feet/root contact at local y440. Entire silhouette must stay within local x66..446 and y60..448, with clear generous empty margins separating the six sprites. Mature sprites ~360px high; seedlings smaller. One subject per cell, consistent three-quarter isometric angle and top-left lighting. No pots or ground patch, no text or labels or grid lines, no watermark. Fine clean cutout edges.

### apple

Use case: stylized-concept. Production game sprite atlas, ONE APPLE TREE species, 1536x1024 image, strict 3 columns by 2 rows of six isolated illustrations on a CLEAN FULLY TRANSPARENT BACKGROUND. No environment, gradients, colored backdrop, shadow, or glow haze. If transparency cannot be represented, use absolutely uniform pure white #ffffff only.
Premium cute pastoral farming RPG style: exquisitely detailed botanical fantasy illustration with fine pixel-like texture, soft warm highlights, carefully shaded materials, layered leaves and tiny veins, polished collectible character quality. Cheerful and lovable, no creepiness, no flat vector shapes or crude low-resolution blocks.
Top row left-to-right: young apple seedling; leafy compact young apple tree with pale pink flower buds; charming miniature natural apple tree with textured branching trunk, dense rounded layered green canopy and glossy red apples. These first THREE sprites are ordinary natural plants, strictly NO eyes, NO mouth, NO faces.
Bottom row left: the same mature natural plant as top-right, without any face.
Bottom row middle: RARE plant companion: an adorable little apple-tree creature with a rounded warm cream and wood-toned body, glossy red apple cap, tiny leaf ears, lush miniature leaf cloak, small branch hands and stubby root feet, warm bright brown eyes. Full body, cute rounded proportions, charming personality, botanical detail.
Bottom row right: SHINY variant of the same companion, same shape and pose, uniquely PAINTED champagne-gold apple cap, powder-blue and teal leaves, pearl-cream body, golden eyes and tiny star blossom accents. A few tiny isolated sparkles only, no glow backdrop.
Precise grid: every cell is 512x512. Each sprite centered horizontally at local x256, feet/root contact at local y440. Entire silhouette must stay within local x66..446 and y60..448, with clear generous empty margins separating the six sprites. Mature sprites ~360px high; seedlings smaller. One subject per cell, consistent three-quarter isometric angle and top-left lighting. No pots or ground patch, no text or labels or grid lines, no watermark. Fine clean cutout edges.

### peach

Use case: stylized-concept. Production game sprite atlas, ONE PEACH TREE species, 1536x1024 image, strict 3 columns by 2 rows of six isolated illustrations on a CLEAN FULLY TRANSPARENT BACKGROUND. No environment, gradients, colored backdrop, shadow, or glow haze. If transparency cannot be represented, use absolutely uniform pure white #ffffff only.
Premium cute pastoral farming RPG style: exquisitely detailed botanical fantasy illustration with fine pixel-like texture, soft warm highlights, carefully shaded materials, layered leaves and tiny veins, polished collectible character quality. Cheerful and lovable, no creepiness, no flat vector shapes or crude low-resolution blocks.
Top row left-to-right: young peach seedling; leafy compact young peach tree with pink blossom buds; charming miniature natural peach tree with elegantly branched trunk, fine pointed leaves, pink blossoms and soft rosy ripe peaches. These first THREE sprites are ordinary natural plants, strictly NO eyes, NO mouth, NO faces.
Bottom row left: the same mature natural plant as top-right, without any face.
Bottom row middle: RARE plant companion: an adorable little peach fairy creature with a velvety pastel peach-shaped head, a tiny sweet face, a lush pink blossom and leaf cap, cream body, leaf sleeves and short root feet. Full body, cute rounded proportions, charming personality, botanical detail.
Bottom row right: SHINY variant of the same companion, same shape and pose, uniquely PAINTED lavender and pearly-white peach cap, silvery mint leaves, pale lilac blossom trim, amber eyes and tiny gold star blossoms. A few tiny isolated sparkles only, no glow backdrop.
Precise grid: every cell is 512x512. Each sprite centered horizontally at local x256, feet/root contact at local y440. Entire silhouette must stay within local x66..446 and y60..448, with clear generous empty margins separating the six sprites. Mature sprites ~360px high; seedlings smaller. One subject per cell, consistent three-quarter isometric angle and top-left lighting. No pots or ground patch, no text or labels or grid lines, no watermark. Fine clean cutout edges.

### cherry

Use case: stylized-concept. Production game sprite atlas, ONE CHERRY TREE species, 1536x1024 image, strict 3 columns by 2 rows of six isolated illustrations on a CLEAN FULLY TRANSPARENT BACKGROUND. No environment, gradients, colored backdrop, shadow, or glow haze. If transparency cannot be represented, use absolutely uniform pure white #ffffff only.
Premium cute pastoral farming RPG style: exquisitely detailed botanical fantasy illustration with fine pixel-like texture, soft warm highlights, carefully shaded materials, layered leaves and tiny veins, polished collectible character quality. Cheerful and lovable, no creepiness, no flat vector shapes or crude low-resolution blocks.
Top row left-to-right: young cherry seedling; leafy compact young cherry tree with creamy pink blossom buds; charming miniature natural cherry tree with branching bark texture, beautifully layered foliage, tiny pink blossoms and clusters of glossy paired red cherries. These first THREE sprites are ordinary natural plants, strictly NO eyes, NO mouth, NO faces.
Bottom row left: the same mature natural plant as top-right, without any face.
Bottom row middle: RARE plant companion: an adorable round cherry sprite with a cream face, a pair of glossy red cherries forming a twin-lobed bonnet, curved little leaf stem, petal collar, green leaf cape and tiny root feet, warm bright eyes. Full body, cute rounded proportions, charming personality, botanical detail.
Bottom row right: SHINY variant of the same companion, same shape and pose, uniquely PAINTED translucent-looking rose-gold and lilac cherries, pearl and deep teal leaves, warm cream body, violet eyes and tiny star-shaped blossoms. A few tiny isolated sparkles only, no glow backdrop.
Precise grid: every cell is 512x512. Each sprite centered horizontally at local x256, feet/root contact at local y440. Entire silhouette must stay within local x66..446 and y60..448, with clear generous empty margins separating the six sprites. Mature sprites ~360px high; seedlings smaller. One subject per cell, consistent three-quarter isometric angle and top-left lighting. No pots or ground patch, no text or labels or grid lines, no watermark. Fine clean cutout edges.

