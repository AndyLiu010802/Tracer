# Garden art

`spring-garden-v1.png` was created with the built-in ImageGen tool for this project. Earlier dark/painterly drafts were rejected and are not shipped.

Plants and the 12 rare/shiny companions use the detailed transparent illustrations documented in [ILLUSTRATED-V2.md](ILLUSTRATED-V2.md), with continuous 32-sample motion in `../garden-plant-animation.js`. They are not baked into the environment. Normal plants have no faces; only recorded rare/shiny mutations gain a face. Shiny variants have individually painted palettes. No runtime image generation or external asset requests are required.

## Final environment prompt

The wildflower companion now has [independent idle, greeting and celebration frames](WILDFLOWER-MOTION-V1.md), including its shiny variant. Other species retain their existing illustrated motion.

Use case: stylized-concept.
Create a cute, cheerful, SUNLIT pastoral PIXEL ART garden game environment inspired by the cozy feeling of Stardew Valley. An original little farm garden, friendly and simple, warm comforting colors, cute small proportions. NOT realistic, NOT dark fantasy, NOT a haunted forest, NO dramatic cliffs, NO abyss, NO spooky fog, NO eyes or faces hidden in the environment.
Production background asset, wide landscape roughly 1800x1040, complete garden diorama visible. Detailed but clearly crisp square pixel art, consistent pixel clusters and about a 450x260 native-pixel aesthetic enlarged cleanly. Bright mint/leaf-green grass, butter-yellow sunlight, peach-brown wood, cream paths, sky-blue water, daisies and pink petals at borders. A small charming timber cottage at upper right with orange-red tiled roof, round cheerful window, a flower pot on the windowsill, tidy fence behind it. One rounded leafy fruit tree at upper left, a tiny blue duck pond on the right with one very small duck. A rounded diamond-shaped plot of garden lawn, shown in a gentle isometric 2.5D perspective, only a LOW two-step earthen edge with cute grass tufts, grounded against a soft pale mint background. No high cliff. Light sky atmosphere, morning sunshine.
Layout for interactive overlays in normalized 900x520 image coordinates: garden grass diamond corners near (70,283),(425,105),(830,282),(456,464). Cottage around (630,155). Tree around (190,165). Pond around (720,335). A little cream stepping-stone path at right connects the cottage to pond.
IMPORTANT: Keep the middle and front lawn EMPTY, six open spaces for live animated plants centered near (360,244),(468,296),(576,348),(252,307),(360,359),(468,411). No plants, characters, soil beds or objects inside those six spaces. The grass may have very subtle texture. No benches, no lampposts: they will unlock separately in code. The border may have a few tiny daisies. No text, labels, user interface or watermark.
Overall feeling: friendly miniature farming village on a happy spring morning. Soft warm shadows, clear cheerful palette, inviting not eerie.
