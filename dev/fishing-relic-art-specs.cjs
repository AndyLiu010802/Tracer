'use strict';
const rodCommon="Use case: stylized-concept. Asset: ONE individually designed premium fishing-game equipment sprite, lavishly resolved professional prop concept painting with confident contours and convincing constructed materials. WIDE 3:1 canvas, complete straight HORIZONTAL prop pointing RIGHT; butt at 5% width, tip at 95%, longitudinal axis around 48% height. Entire silhouette in frame with generous true-alpha transparent padding. Crisp bevels, coherent perspective, readable designed negative spaces, tightly resolved joints, exquisite small engraving, textile stitching and material transitions. No sheet of multiple rods. No labels, text, watermark, environment, ground shadow, character, fish, line, hook, detached ornaments or floating effects. Unless explicitly a complete staff, retain a usable left-hand grip and a compact functional reel in the lower 30%; structural ornaments stay attached and mass-balanced; upper 60% is a straight continuous tapered fishing blank with six fine line guides, not a broad blade replacing the blank. No toy proportions, clipart, simplistic geometry or generic glowing jewel. ";
const styles={
  "myriad": "Art direction: an exquisite cabinet of natural wonders and crafted mechanisms, painterly realism with carefully sculpted focal ornament, rich enamel, patinated metal, organic materials and restrained jewel light. Each design has an unmistakably different primary silhouette and physically readable construction. ",
  "journey": "Art direction: mature dark Chinese mythic realism informed by Black Myth Wukong. Ancient ritual implements, Tang/Song sculptural ornament, fire-gilded bronze worn to iron, vermilion lacquer rubbed at the edges, soot in carved recesses, silk knots, mineral pigments and quiet sacred menace. Controlled low-saturation palette and sharply lit edges. Magnificent yet weathered, not shiny generic high-fantasy jewelry, not cartoon. ",
  "threekingdoms": "Art direction: accomplished Chinese historical-fantasy card illustration inspired by polished Sangokushi / Sanguosha heroic original art. Dominant weapon silhouette, aggressive forged cutting bevels, layered Han armor construction, sculpted beast sockets, fine lacquer/enamel, convincing silk and leather, selective rich color and strong restrained rimlight. Faction and character identity should live in construction, not a portrait pasted onto the rod. Sharp, formidable, elegant proportions. "
};
const fxCommon="Use case: stylized-concept. Asset: ONE production animated VFX sprite atlas for a fishing game. EXACTLY SIX equal square cells in a 3 columns x 2 rows regular grid, reading order left to right then second row. 1536x1024 landscape, no borders or numbers. Each drawing centered with the SAME camera, scale and anchor; at least 14% empty alpha padding inside every cell. True transparent RGBA background BETWEEN AND WITHIN effects. Never cross cell boundaries. Six DIFFERENT sequential animation keyframes: 1 clear anticipation, 2 compressed gathering, 3 forceful release, 4 decisive impact silhouette, 5 coherent trailing breakup, 6 residual taper. This is moving artwork, not six unrelated emblems or the same image fading. Clean authored contours, disciplined painted planes, readable inner construction and selective luminous edges, sophisticated material detail. No character portrait, full human body, target fish, environment, ground plane, text, UI, watermark, uniform generic aura or large blurred glow. An isolated limb, weapon or spirit is allowed only when specified. Animate travel RIGHT where applicable. ";
const specs={
  "thunderdrum": {
    "pool": "myriad",
    "rod": "Thunder Drum, a finely engineered bronze ceremonial drum seated as the reel cheek with taut oxhide, individually driven nailheads, thunder-scroll relief and twin short drumstick crank arms. Soot-black iron handle spine, braided russet leather, jade-green bronze patina in deep grooves, tiny silver wire inlaid lightning paths continue into a dark bamboo blank. Rich warm bronze against cold steel, exquisite taut membrane and functional exposed axle, strong compact drum silhouette.",
    "fx": "ONE forked thunderbolt only, no drum or beaters in the effect sheet. Six tightly controlled keyframes: a compact pale-blue charge fork appears high inside the cell, thin branches tense downward, one brilliant white-blue jagged lightning stroke lashes vertically into the cell center, a crisp electric splash crown kicks outward, residual forks curl inward, two small sparks fade. Deliberate varied-width channels, solid white core with cobalt edges and just a narrow translucent falloff. Entire bolt including upper tip stays inside each cell with 20% transparent margin. No backdrop, cloudy haze, drum, smoky sphere or enormous bloom.",
    "motion": "lightning"
  },
  "ruyi": {
    "pool": "journey",
    "rig": "weapon",
    "rod": "Ruyi Jingu Bang, a COMPLETE straight staff with an uninterrupted dark crimson iron cylindrical center and TWO equally proportioned engraved old-gold sleeves, each about 17% of total length. Closely study the authority of the Black Myth Wukong iconic staff: deep sculptural auspicious-cloud relief, restrained coiled dragon heads at sleeve collars, worn gilding revealing dark bronze, engraved spiral borders, tiny nicks and longitudinal iron grain. Slender powerful working staff proportions, the two ends lie on precisely ONE straight centerline. NO fishing-rod extension, NO reel, NO blades, NO bulging giant gem, NO character. One complete horizontal staff left to right with both end caps fully visible.",
    "fx": "Ruyi Jingu Bang staff flourish, faithful solid red-iron staff and embossed gilt cloud sleeves remain straight and constant length. Six sequential positions: compact diagonal ready stance, accelerating wrist-spin, horizontal sweep, decisive upward water-lifting strike, controlled return arc, upright settled staff. Tight amber-white crescent trails mark the actual end-cap paths, two small refined pale auspicious cloud wisps separate at the strike then disperse. No character, no generic laser, no smeared bent stick; every frame depicts the same recognizable complete staff.",
    "motion": "staff"
  },
  "guanyuyunchang": {
    "pool": "threekingdoms",
    "rod": "Guan Yu Green Dragon Crescent Blade interpreted as a formidable fishing implement. A powerful forward-pointing crescent cutting head is fused into the lower 30% bronze-green dragon socket and reel guard, huge clean polished silver cutting bevel contrasted with blackened etched blade plane; tightly coiled jade-scaled dragon neck and brass teeth carry the load, dark emerald brocade grip, wine-red silk knot and small linked lamellar plates. A slim black-steel fishing blank continues seamlessly along the weapon spine toward the right with understated green-silver guides. The crescent is confidently sharp and proportionate, not a knife pasted sideways or an oversized toy head. Sanguosha heroic martial painting quality, precise chased dragon scales and controlled gold accents.",
    "fx": "Guan Yu crescent-blade martial slash. A forged silver-edged guandao blade with dark jade dragon socket gathers into a compressed windup, sweeps one large green-white crescent rightward, the arc stretches into a long dragon-neck-shaped wake with a sharply readable brow, horns and jaw, impact splits into two clean blade ribbons, remaining emerald wisps retract. The sword edge drives the dragon wake, no floating portrait, no random magic ring. Forceful calligraphic energy with chiseled white leading edge and dark green body.",
    "motion": "slash"
  },
  "walnut": {
    "pool": "myriad",
    "rod": "Split chestnut timber with long straight endgrain, dovetail-inlaid ebony reel seat, fitted brushed brass ferrules, saddle-stitched cocoa leather grip and a tiny compass pin. A slim honey-brown bamboo blank and six perfectly lashed bronze guides. Quiet exquisite traveler craftsmanship.",
    "fx": "A few narrow chestnut leaves turn edge-on, follow a single amber wind arc rightward and land as three delicate contact ripples; physically drawn veins and clean taper.",
    "motion": "leaf"
  },
  "porcelain": {
    "pool": "myriad",
    "rod": "White translucent porcelain insets with a single cobalt mountain glaze passage, silver rolled rims, fine controlled glaze crazing, teal silk grip braid, ivory ceramic reel cheek in a practical silver cage. A slender blue-grey blank with delicate silver guides; no giant vase.",
    "fx": "Three thin porcelain-blue brushstroke ribbons gather like mist over mountains, slip rightward, separate into five clear dew drops and fine ripples.",
    "motion": "surface"
  },
  "citrus": {
    "pool": "myriad",
    "rod": "Honey-orange lacquer with a finely woven pale rattan grip, citrus-leaf brass guide brackets, ivory linen bindings and a compact orange-peel textured enamel reel shell. Tiny carved leaf on crank, warm sunlit edge, delicate long cream-dark blank.",
    "fx": "Two translucent orange citrus slices rotate briefly through a warm leaf-shaped breeze, spring apart into tiny zest droplets at contact, then leave one gold ripple.",
    "motion": "leaf"
  },
  "amber": {
    "pool": "myriad",
    "rod": "Honey amber reel sideplate visibly encloses two fine pine needles, polished bronze encircling cage, resin-filled fissures in dark pine handle, oxblood leather rings. Fine golden inclusions with convincing optical depth, brown-black blank and small amber-capped fittings.",
    "fx": "A teardrop of amber resin elongates, catches a sharp warm highlight, then breaks into tiny honey facets along a controlled arc; glowing pine-needle trails settle.",
    "motion": "orb"
  },
  "vinyl": {
    "pool": "myriad",
    "rod": "Midnight blue brushed aluminum reel with truly fine concentric vinyl grooves, a tiny tonearm-shaped crank, oxidized nickel trim, dark indigo stitched grip and charcoal blank. Elegant record-player mechanism, mechanically attached compact spool, no floating musical notes.",
    "fx": "A precise black vinyl disk turns, a silver stylus touches the groove, three offset cobalt sound ribbons pulse outward in cadence and dissipate.",
    "motion": "radial"
  },
  "nautilus": {
    "pool": "myriad",
    "rod": "Cutaway chambered nautilus shell forms an elegant compact reel housing, pearl nacre inner partitions, patinated coral-bronze ribs, fine navy rope grip and pearlescent ivory guide collars. Correct logarithmic shell geometry and shell-wall thickness, deep teal tapered blank.",
    "fx": "A nacre spiral opens chamber by chamber, a turquoise water ribbon rolls through it and launches a tight spiral wake that uncoils into clear pearl droplets.",
    "motion": "vortex"
  },
  "alpine": {
    "pool": "myriad",
    "rod": "Ice-grey titanium frame, dark red climbing cord crosswrapped grip, small carabiner-shaped spool guard, subtle crampon-tooth guide sockets, frost-blue anodized reel axle. Sharp useful mountain-tool construction, no giant ice crystals, black graphite blank.",
    "fx": "A climbing-pick shaped silver glint cuts diagonally through a pale icy gust; six small angular ice chips peel off behind it and dissolve.",
    "motion": "slash"
  },
  "candlewyrm": {
    "pool": "myriad",
    "rod": "An ancient elongated horned candle-dragon head carved in blackened bronze cradles a deep vermilion translucent wick window at the reel; layered scale plates follow lower shaft, scorched black lacquer handle with red cord and dark gilt fittings. Fine nostrils, antler horns and beard, compact sculptural dragon rather than a pasted cartoon face.",
    "fx": "A slender ancient horned dragon emerges from a pin-sized red candle flame, coils once with articulated head neck and tapered body, exhales a narrow vermilion flame and fades into ember scales.",
    "motion": "dragon"
  },
  "abysswhale": {
    "pool": "myriad",
    "rod": "Deep blue carved whalebone reel arch with believable porous bone grain, small ribbed fin-shaped bronze braces, inlaid teal bioluminescent dots along a dark whale-back lower guard, storm-grey braided handle and compact dark steel spool. Graceful immense-creature feeling in restrained proportions.",
    "fx": "A deep-indigo whale spirit ascends, flexes its tail peduncle and paired pectoral fins correctly, breaches with a curved turquoise water sheet, then sinks into a tapering spray.",
    "motion": "creature"
  },
  "foxfire": {
    "pool": "myriad",
    "rod": "Burgundy lacquer fox-mask reel guard with anatomically refined narrow muzzle, pierced golden maple leaves, two ivory swept ear buttresses and three close-fitting copper tail ribs. Charred maple handle wrapped in red silk, dark bronze spool and black-red blank. Mature cunning spirit rather than cute toy fox.",
    "fx": "A lean red-gold fox spirit lowers shoulders then bounds rightward, forelegs extend and hind legs follow; three flame tails unfurl with staggered timing and collapse into maple-shaped embers.",
    "motion": "creature"
  },
  "lilybell": {
    "pool": "myriad",
    "rod": "Pearl porcelain lily-of-the-valley bell housings hang firmly from a compact silver leaf reel cradle; each small bell has a thin rolled lip, visible clapper and flower-green enamel calyx. Ivory silk grip, dew-glass axle and forest-green slim blank; refined botanical anatomy.",
    "fx": "Three white lily bells nod in delayed sequence from flexible green stems, release clear dew droplets and a pale soft silver pulse, petals fold back as the droplets settle.",
    "motion": "bloom"
  },
  "sandscript": {
    "pool": "myriad",
    "rod": "An old desert brass hourwheel reel with concentric finely incised scales, a small sealed glass sand chamber, skeletal triangular supports, sand-colored leather grip and oxidized blue recesses. Precise gear teeth and a single faceted smoky quartz hub, long bronze-black blank.",
    "fx": "A brass hourwheel turns counterclockwise while a thin sand stream rises against gravity, golden grit follows a narrow spiral, two engraved rings align and the stream falls away.",
    "motion": "vortex"
  },
  "frostwolf": {
    "pool": "myriad",
    "rod": "Silver-black wolf muzzle integrated into a long low reel guard, finely chased layered fur and ice-blue enamel eye, separate slender ear tips, translucent short ice ridges attached to collar. White-grey leather grip and blued steel blank. Fierce natural canine skull planes.",
    "fx": "A silver-blue spectral wolf crouches then leaps upward with correctly jointed paws and spine, its head howls into a pale crescent rim; falling fur-shaped frost splinters dissipate.",
    "motion": "creature"
  },
  "rosevow": {
    "pool": "myriad",
    "rod": "Dark oxidized silver thorn branches make a load-bearing reel cage around a cut garnet rose heart; translucent ruby enamel petals with individually curled rims, tiny stained-glass inserts, burgundy suede grip and black-steel blank. Restrained sacred gothic craftsmanship.",
    "fx": "A garnet rose bud opens petal by petal, black-silver thorns sweep into one enclosing arc, ruby petals spin away and the thorn curve dissolves at its narrow ends.",
    "motion": "bloom"
  },
  "inkjudge": {
    "pool": "myriad",
    "rod": "Ink-black jade brush-shaped handle, gilt etched feather-shaft reel supports, ivory rolled-scroll spool, short vermilion cord and small square cinnabar seal inset. Glossy black lacquer versus dry carved feather barbs, sober silver bands, slender dark ink blank.",
    "fx": "A black feather makes one decisive calligraphic slash, wet ink gathers into a compact downward seal impression, a red rectangular stamp flashes without readable lettering, then dries into feather flecks.",
    "motion": "seal"
  },
  "butterfly": {
    "pool": "myriad",
    "rod": "Precisely layered iridescent butterfly forewings and smaller hindwings form two close-fitting translucent blue-violet reel sideplates around an amethyst cocoon hub. Fine silver wing venation, accurate paired antenna relief, dark plum silk grip and pearly violet blank. Not fairy-wand wings dangling off.",
    "fx": "A chrysalis splits, one iridescent butterfly opens anatomically paired fore- and hindwings, beats twice with flex from the thorax and sheds a fine violet-blue scale trail.",
    "motion": "bird"
  },
  "sunforge": {
    "pool": "myriad",
    "rod": "An imposing bronze solar forge wheel with eight chiseled inner rays, a tiny articulated hammer crank suspended beside a white-gold crucible core, heat-dark iron frame, crimson leather grip and old-gold collars. Deliberate hot metal gradients only in small core, commanding black-gold blank.",
    "fx": "A compact iron-gold forge hammer lifts, strikes an eight-rayed sun disk once, white-gold impact sparks arc outward, a molten amber corona expands and quenches into fine particles.",
    "motion": "hammer"
  },
  "leviathan": {
    "pool": "myriad",
    "rod": "A deep-sea sovereign trident-shaped compact lower guard, three sharply forged silver fins surround a blue-black reel, ancient sea-crown ridges and dark teal scale relief, rare pearl studs and black wet-leather grip. Long narrow silver-blue fishing blank; regal abyssal mass and convincing forged edges.",
    "fx": "A long abyssal leviathan raises its crowned narrow head through a spiraling water mantle, paired enormous fins push down, three tidal crests surge rightward then fold back into the dark.",
    "motion": "dragon"
  },
  "eclipse": {
    "pool": "myriad",
    "rod": "Hidden Myriad Eclipse relic. A matte black armillary cage holds a smoked-glass crescent reel, pale platinum eclipse rim and subtly star-pitted obsidian planes, fine astrolabe ticks without text, tightly bound charcoal silk grip. Radially nested rings remain compact and attached; long midnight blank with tiny silver guides. Solely one warm thin gold rim for the ominous void core.",
    "fx": "A thin platinum-gold eclipse ring opens around a deep black center, fine opposing star streams bend inward, the rim compresses and snaps shut with one silver-white cut; no explosion clutter.",
    "motion": "vortex"
  },
  "teaearthen": {
    "pool": "myriad",
    "rod": "Authentic purple-brown Yixing clay reel cover with burnished unglazed stipple, subtly carved tea twig, tiny bamboo handle arch as metal-protected reel brace, bamboo knots and oatmeal twine grip. Small brass working crank, restrained earthen palette and warm dark bamboo blank.",
    "fx": "A small curl of tea steam rises, two olive tea leaves fold along their midribs and float rightward, a single clear droplet makes a delicate warm ripple.",
    "motion": "leaf"
  },
  "maplecraft": {
    "pool": "myriad",
    "rod": "Honey maple and dark walnut joinery with accurate dovetail corners around a compact wooden spool housing, flush brass pin joints, a three-lobed maple-leaf silver clasp, dense brown leather grip and straight tapering maple blank. Refined craftsman tool, visible wood pore and grain direction.",
    "fx": "Three maple leaves rotate at different phases along one tight wind path; a short honey-white sweep lands and the leaves break into tiny warm motes.",
    "motion": "leaf"
  },
  "lanternkite": {
    "pool": "myriad",
    "rod": "Small swallow-shaped silk kite panel inset into a bamboo-rib reel guard, translucent cream paper backed by delicate ribs, indigo waxed cord, one folded short red tail knot attached at collar. Weathered honey bamboo grip, tidy brass spool and charcoal-red blank.",
    "fx": "A small swallow kite tilts as its bamboo ribs flex, silk tail traces a graceful S-curve rightward, paper folds edge-on and the wind trail thins to nothing.",
    "motion": "bird"
  },
  "astrolabe": {
    "pool": "myriad",
    "rod": "A precise pierced brass nautical astrolabe as compact reel cheek, two nested azimuth rings and a rotating sighting rule, thin engraved coastal contour motifs, midnight navy leather grip and tarnished silver rivets. Deep bronze-brown shaft with minimal tiny star collars.",
    "fx": "A brass navigation rule aligns two nested fine star orbits, a single white-gold guide streak shoots rightward, remaining star points turn slowly and disappear.",
    "motion": "radial"
  },
  "obsidian": {
    "pool": "myriad",
    "rod": "Sharp conchoidal obsidian facets form a low angular reel shield, tightly fitted silver edge caps protect real fracture planes, a small purple quartz axle and crosswrapped charcoal grip. Black glass reflections are narrow and controlled, no large jewel castle, smoky dark blank.",
    "fx": "A black-glass prism gathers one sharp violet-white reflection, splits it into three tightly spaced angular slashes, then tiny obsidian reflections turn edge-on and vanish.",
    "motion": "slash"
  },
  "scarabsun": {
    "pool": "myriad",
    "rod": "A sacred scarab reel housing with segmented hammered gold elytra, fine engraved lapis and turquoise wing bands, a small amber solar disk held at the axle by paired beetle legs. Dark blue linen grip and bronze-black blank; true six-legged insect detailing and elegant Egyptian craftsmanship.",
    "fx": "A golden scarab opens paired lapis wing covers, membranous wings unfurl under them, lifts a warm amber sun disk, then light feathers into six tapered rays before folding.",
    "motion": "bird"
  },
  "peacock": {
    "pool": "myriad",
    "rod": "Emerald and sapphire peacock eye-feathers layer into a compact fan reel guard, fine carved feather barbs edged in old gold, pearl-green eye insets and slender jade quill braces. Dark teal silk grip, polished bronze spool, green-black blank. Countable orderly feather layers.",
    "fx": "An emerald peacock turns its slim neck, tail coverts fan open in a staggered seven-layer wave, clear blue-gold eye spots travel across the arc, and the fan closes into a tapered feather wake.",
    "motion": "bird"
  },
  "worldtree": {
    "pool": "myriad",
    "rod": "Gnarled ancient root grip with carved hardwood pores, oxidized green-bronze branches forming a compact open reel cage, translucent tiny amber-green leaves attached at knuckles, a dark wooden spool nested between roots. Sturdy center spine and narrow forest-brown blank, refined living bonsai engineering.",
    "fx": "Old roots extend one branch at a time, a small ancient tree silhouette lifts from their center, amber-green leaves unfurl in sequence and the roots withdraw into one seed-sized light.",
    "motion": "roots"
  },
  "chronoclock": {
    "pool": "myriad",
    "rod": "Antique open-face brass pocket-watch reel with two visibly meshing gear trains, beveled glass sand window and blued-steel hands without numerals, small crown-shaped crank and black crocodile leather grip. Fine guilloche case edge, crisp gear teeth, long gunmetal blank.",
    "fx": "Two brass clock gears counterrotate, a fine silver hand sweeps backward while a glass sand stream reverses, mechanisms align at one bright tick and collapse into fine gold filings.",
    "motion": "vortex"
  },
  "ninephoenix": {
    "pool": "myriad",
    "rod": "An imperious dark-violet phoenix reel guardian with EXACTLY nine separate narrow tail plates overlapping along the grip, gold chased barbs and amber breast inlay, blackened bronze beak and swept crest. Plum silk handle, carved obsidian collars, dark purple upper blank. Nine countable tail plumes, elegant rather than massive wings.",
    "fx": "A dark violet-gold phoenix lifts its wings from shoulders and fans exactly nine long tail plumes in three delayed layers, dives through one amber flame arc and leaves nine clear narrowing trails.",
    "motion": "bird"
  },
  "pilgrim": {
    "pool": "journey",
    "rod": "Weathered ochre bamboo pilgrimage rod with genuine nodes and peeled fibers, two iron ferrules, dense hemp grip binding and a compact carved sandalwood reel with a bone crank. A tiny worn brass temple bell fixed below the grip; humble practical proportions, rich close surface detail.",
    "fx": "A short ochre dust ribbon and three bamboo leaves rise together, travel rightward and settle into a small pale water splash.",
    "motion": "leaf"
  },
  "sandalwood": {
    "pool": "journey",
    "rod": "Deep red-brown sandalwood grip with polished endgrain, twelve tightly strung prayer beads in a short secured loop, dark copper lotus axle and worn cream thread tassel. Small blackened bronze reel, warm wood to slender soot-brown bamboo blank.",
    "fx": "Twelve dark sandalwood beads describe one orderly circular orbit, a thin amber chant pulse passes through each in sequence and collapses into a soft gold speck.",
    "motion": "radial"
  },
  "reedraft": {
    "pool": "journey",
    "rod": "Pale reed wraps over blackened ferry bamboo, accurate double-strand hemp lashings, a compact split-bamboo spool held by aged brass transverse pins and dark moss-green leather. Small folded reed leaves attached close to collar, slim straight bamboo blank.",
    "fx": "Two braided reed leaves bend in a pale narrow water current, slide through a curved wake, then release clear droplets from their tips.",
    "motion": "surface"
  },
  "monkeytwig": {
    "pool": "journey",
    "rod": "Twisted peach wood in lower grip with fine bark fissures, one small carved ripe peach integrated at the axle, old-gold leaf-vein brace and sage silk tie. Compact monkey-paw-like bronze spool support, dark green-brown straight taper above living-branch collar.",
    "fx": "A small peach blossom bud opens, a thin gold-tipped living branch flicks forward with flexible joints, pink petals follow one clean return arc.",
    "motion": "roots"
  },
  "goldenhoop": {
    "pool": "journey",
    "rod": "Three close-fitting bronze-gold circlets interlock as the reel cage, their symmetrical cloud curls deeply carved and worn, black sutra-silk handle binding and old vermilion knots. Subtle dark brass working spool, clean umber blank with gold hoop guide sockets.",
    "fx": "Three narrow engraved golden circlets separate, tilt into a clear nested perspective, send one tight concentric pressure wave and lock together again.",
    "motion": "radial"
  },
  "moonspade": {
    "pool": "journey",
    "rod": "A sharp monk crescent spade silhouette integrated into a dark iron lower reel guard, broad moon-silver outer bevel, twin inward hooks, nine dark prayer beads tied against the neck, dusty purple hemp grip. Compact bronze spool and long iron-grey tapered blank.",
    "fx": "A cold silver crescent shovel blade traces a low sweeping cut, pale purple sand follows its belly, crescent turns edge-on and the sand divides into two narrowing wakes.",
    "motion": "slash"
  },
  "ninerake": {
    "pool": "journey",
    "rod": "Tianpeng nine-tooth rake, EXACTLY nine distinct small forged steel teeth comb across a compact blue-black reel-guard bar, each tooth with visible square socket and silver bevel. Stout ash grip in faded indigo cloth, old bronze axle, slim blue-black upper blank. Fierce functional farm-weapon metalwork.",
    "fx": "Exactly nine silver tine glints gather into a comb, rake rightward in one heavy stroke leaving nine parallel white-blue water furrows, then tips release nine droplets and fade.",
    "motion": "volley"
  },
  "whitedragon": {
    "pool": "journey",
    "rod": "Long white dragon head with fine nacre scales, deer-like gilt horns, narrow whiskers fixed close to frame, ivory bone reel cage and blue-grey silk grip. Pearl-gold dragon spine wraps only the low collar, slender frosty silver-blue blank. Weathered sacred carving with natural dragon anatomy.",
    "fx": "An ivory Chinese dragon coils with a continuous flexible spine, long whiskers trail behind its horned head, foreclaws draw a turquoise wave into one upward sweep, silver droplets trail off its tail.",
    "motion": "dragon"
  },
  "kasaya": {
    "pool": "journey",
    "rod": "Crimson-gold woven kasaya brocade wraps a dark sandalwood grip, tiny raised repeating lotus threads, old-gold square clasp rings physically fastened around a compact blackened bronze reel. A folded cloth hem and muted wine silk ties, soot-red tapered blank.",
    "fx": "A crimson brocade ribbon unfolds from tight pleats, its old-gold woven edge pulls taut in a broad S-curve, turns once over a pale contact flash and folds into a thin red-gold seam.",
    "motion": "ribbon"
  },
  "windfan": {
    "pool": "journey",
    "rod": "A thirteen-rib miniature banana-leaf fan makes an asymmetrical reel shield, pale jade-green leaf veins, carved dark bronze ribs, ring-pinned ivory pivot and brown silk grip. Each rib is attached, fan elegantly folded half-open at lower collar; moss-green fishing blank.",
    "fx": "A jade banana-leaf fan opens through thirteen fine ribs, makes one decisive forward beat, three blade-like pale wind sheets surge rightward and unwind in a diminishing spiral.",
    "motion": "wind"
  },
  "redboy": {
    "pool": "journey",
    "rod": "Three-pronged old-bronze lotus brazier reel cradle around a small opaque red glass samadhi-fire core, soot in bronze petal recesses, charred vermilion lacquer grip and two thin red cords. Sharpened spear-like collar transitions to blackened red-brown blank.",
    "fx": "Three coherent vermilion flame tongues gather into one narrow spear of samadhi fire, whip forward, flare into a compact white-orange lotus impact and retract to three embers.",
    "motion": "flame"
  },
  "jadebottle": {
    "pool": "journey",
    "rod": "Thin-necked pale celadon purification vase integrated as an oval reel cheek, actual ceramic lip and ring foot, fine crazed glaze, silver willow branch brace and a short attached green leaf sprig. Ivory silk grip over dark bamboo, polished pale jade small collars.",
    "fx": "A celadon vase tilts from a held upright position, one heavy clear dew drop forms beneath its lip, falls and spreads concentric translucent willow-green ripples; two willow leaves dip then rise.",
    "motion": "water"
  },
  "demonmirror": {
    "pool": "journey",
    "rod": "Octagonal dark bronze demon-revealing mirror with eight precisely inset smoky jade stones, aged silver polished face, old cloud scroll relief in each corner and woven black-red silk grip. Mirror forms compact reel sideplate with a real dark axle, slender blackened steel blank.",
    "fx": "An octagonal bronze mirror rotates into frontal alignment, eight dim jade inlays light sequentially, a tight pale-gold beam strikes forward and breaks into a crisp eight-sided seal before fading.",
    "motion": "beam"
  },
  "goldenbell": {
    "pool": "journey",
    "rod": "Three distinct purple-patinated bronze bells with visible small clappers mounted securely around a compact gilt reel frame, fine age-dark floral relief, dark violet silk handle wrapping and narrow golden collars. No dangling oversized chain, black-violet blank.",
    "fx": "Three violet-gold ritual bells swing with delayed angular motion, each clapper contacts once, three clean expanding amber pressure arcs interlock then dissolve at their tips.",
    "motion": "radial"
  },
  "sevenstars": {
    "pool": "journey",
    "rod": "A straight narrow dark steel sword-spine guard integrated behind the reel, seven small round silver star studs connected by fine inlaid wire, brass demon-mask socket and indigo leather grip. Selective bright forged bevel and clean silver guide train along the slender black upper blank.",
    "fx": "A precise straight seven-star sword silhouette makes one upward silver cut, seven small star points light along its spine, a clean indigo-white slash releases them along a diminishing arc.",
    "motion": "slash"
  },
  "gourd": {
    "pool": "journey",
    "rod": "A compact double-bellied red-purple lacquer gourd forms a reel side vessel with a visible narrowed neck, aged gold braided cage, sealed lid and short red tassel. Deeply polished wine wood grip, dull brass mechanical spool integrated behind, dark crimson blank.",
    "fx": "A purple-gold gourd tips forward, its stopper lifts slightly, a thin wine-red vortex draws inward toward the neck, a clear white-gold stream returns outward and the stopper closes.",
    "motion": "vortex"
  },
  "lotuswheel": {
    "pool": "journey",
    "rod": "Two compact eight-petal bronze fire wheels frame the reel axle, dark amber enameled flames attached along rims, a tightly folded red silk Huntian ribbon around black iron handle, lotus-leaf gilt socket. Fine exposed hub spokes and black-red flexible blank, ancient battle-worn construction.",
    "fx": "Twin bronze lotus fire wheels spin in opposite phases, a red silk ribbon follows their actual circular paths, they cross in a single figure eight and release two short amber fire wakes before slowing.",
    "motion": "double"
  },
  "erlang": {
    "pool": "journey",
    "rod": "Erlang Sacred Divinity, visually read as a three-pointed double-edged spear: long dominant central silver cutting spearpoint and two clean shorter symmetric hooked side points integrated into the low forged weapon guard, dark old-gold demon relief and narrow celestial-eye inlay on the socket. White silk over black-steel grip, silver chain binding, pierced bronze cloud details. A functional compact black-silver reel fits behind the spear socket; slim black taper continues from the central spine. Sharply defined three points, NOT a fishing fork, not a giant flat paddle. Mature Black Myth-style aged metal with restrained gold.",
    "fx": "A three-pointed double-edged silver spear thrusts rightward with a precise long central streak and two shorter side streaks; a tiny vertical celestial-eye flash opens at the socket, then the twin blade edges sweep back into the main line.",
    "motion": "thrust"
  },
  "wukong": {
    "pool": "journey",
    "rod": "Hidden Wukong Myriad Selves battle relic. Compact monkey-face gold armor relief at reel collar with fierce natural simian brow and muzzle, a dark old-gold phoenix crown with two thin attached swept plume ribs, red iron and carved gilt sleeve grip. Dense dark vermilion silk binding and compact sculpted bronze spool, black-red blank. Crown feathers are slim load-bearing decoration confined to lower section; extraordinary intricate worn gilding.",
    "fx": "One red-iron gold-sleeved staff rotates into a forward strike, splits into EXACTLY three identical staff echoes with gold hair-thread links, the three strike in staggered rhythm, rejoin the center staff and leave fine golden hairs. No monkey faces or crowd of people.",
    "motion": "triple"
  },
  "sutrabundle": {
    "pool": "journey",
    "rod": "A tightly tied travel bundle of ivory sutra rolls and narrow bamboo slips shapes a compact reel housing, dark wooden rollers, frayed brown leather double straps, small iron rivets and oatmeal cord grip. A few incised unreadable marks, no text, long dark bamboo blank.",
    "fx": "A rolled parchment strip opens, one small old-bronze seal rises over it then presses down, pale gold topographic contours spread once and the paper rolls closed.",
    "motion": "seal"
  },
  "cloudshoe": {
    "pool": "journey",
    "rod": "Tightly woven straw-sandal texture makes the grippable handle, carved milky-jade cloud toe cap, compact knot-tied bamboo reel frame with aged bronze axle. Ivory hemp laces lie flat, tiny jade cloud guide bases and slim charcoal bamboo blank.",
    "fx": "A pale small auspicious cloud curls open from one hooked wisp, two strands of warm straw-colored wind pass underneath and disperse into a short airy S-curve.",
    "motion": "wind"
  },
  "tigercloak": {
    "pool": "journey",
    "rod": "Ochre tiger-pelt pattern on aged leather grip with individually painted dark stripes, subtle short fur edge against blunt bronze tooth-shaped reel braces, black-iron spool and ochre silk binding. Strong low armored silhouette, small carved tiger brow on collar, smoke-brown upper blank.",
    "fx": "A compact ochre tiger spirit compresses shoulders, extends forepaws in one fierce leap, exactly four crisp amber claw lines flash and follow through into fading dust.",
    "motion": "creature"
  },
  "skullbeads": {
    "pool": "journey",
    "rod": "EXACTLY nine small ivory skull prayer beads in a tightly secured lower loop, anatomically refined carved eye sockets and jaws, blackened iron reel housing, dusty plum cord wrap and beaten bronze clasps. Sober ancient ritual object, no gore, dark flexible iron-grey blank.",
    "fx": "Nine small ivory skull beads orbit in a precise low oval, blue-grey sand spins through their center, one cold pulse freezes the orbit momentarily before beads dissolve into sand.",
    "motion": "vortex"
  },
  "lotusseat": {
    "pool": "journey",
    "rod": "An ancient eight-petal lotus pedestal forms the lower reel cradle, old fire-gilt copper petal rims with faded pink mineral pigment, grey-white jade seedpod axle, worn cream silk grip and dark green bamboo. Layered realistic petal thickness, graceful small lotus guide collars.",
    "fx": "Eight pale mineral-pink lotus petals open successively around a clear jade drop, one quiet golden pulse travels from root to rim, petals close into a compact bud.",
    "motion": "bloom"
  },
  "scorpion": {
    "pool": "journey",
    "rod": "A threatening dark bronze scorpion tail curls tightly around the reel cage, countable chitin segments, sharp ivory stinger fitted into a protective socket, purple lacquer pipa-like soundbox cheek and black silk grip. Two small gold claw buttresses, gunmetal blank.",
    "fx": "An articulated bronze-purple scorpion tail coils from the base, segments accelerate in sequence, a sharp ivory stinger snaps forward with one narrow violet streak, then recoils precisely.",
    "motion": "thrust"
  },
  "spiderweb": {
    "pool": "journey",
    "rod": "A silver-black spider reel cage with eight delicately jointed legs evenly anchored, a small moonstone abdomen, fine silk-wire lattice filling protected spaces, violet cloth grip. Pierced web sockets rather than random lace, long night-purple blank.",
    "fx": "Eight silvery silk spokes shoot from one point, connect into a taut lunar web in an orderly spiral, one dew-white impact travels around the web and threads detach in sequence.",
    "motion": "threads"
  },
  "whitebone": {
    "pool": "journey",
    "rod": "Three narrow aged ivory mask-profile plates along a blackened iron reel guard, fine natural bone pores and worn edges, tarnished silver wire stitching, faded plum silk grip and tiny white seed bead crank. Sinister restrained pale-bone construction, no gore or cartoon skull castle, dark grey blank.",
    "fx": "Three successive pale bone-mask silhouettes turn edge-on through one silver-grey vapor ribbon, a cold clean cutting streak parts them, the masks flake away into chalk motes.",
    "motion": "triple"
  },
  "dragonpalace": {
    "pool": "journey",
    "rod": "Ancient turquoise dragon-palace command token as a compact jade reel cheek, gold-green dragon horns as firm side braces, coral-red seal bead and pearl inlays, deep sea-blue silk grip. Intricate old bronze wave relief, algae-dark recesses, narrow jade-black blank.",
    "fx": "A small jade sea-command tablet rises, three structured turquoise water curtains unfold like dragon fins, a clear pressure crest travels outward and folds into falling pearls.",
    "motion": "water"
  },
  "bullking": {
    "pool": "journey",
    "rod": "Bull Demon King heavy black iron reel housing with a powerful bovine skull socket, two swept bronze horns framing a compact spool, studded dark oxhide grip, blunt gold-banded war-pole collars and scorched oxblood lacquer. Thick lower mass transitions convincingly into a slim flexible steel blank.",
    "fx": "A heavy dark iron war-pole strike descends, a fierce bronze-black bull head emerges only in the following dust shock, two horn-shaped amber pressure curves drive forward and collapse.",
    "motion": "hammer"
  },
  "peachbough": {
    "pool": "threekingdoms",
    "rod": "A weathered peachwood training spear handle shaped from naturally straight grain, two small carved peach flowers at its bronze heel, hemp thumb wrap and modest leaf-shaped steel reel cheek, petal-pink lacquer under rubbed edges. A humble carefully handcrafted piece, not jewel-encrusted.",
    "fx": "Two crisp peach petals coil around a narrow wooden thrust trail, accelerate right, strike into a tiny pale-pink slash and separate into three tumbling petals. Carefully painted fibrous petal faces, no flower explosion.",
    "motion": "leaf"
  },
  "strawsandals": {
    "pool": "threekingdoms",
    "rod": "Liu Bei early-life woven straw sandal craftsmanship: braided rush grip with meticulous over-under weaving, compact iron sole-shaped reel guard, olive thread stitching and worn bamboo blank, humble warm linen and soot gray.",
    "fx": "A tight braided straw loop uncoils along a short grounded forward stroke; three tiny woven fiber streaks cross at impact and relax, warm pale-gold dry-brush motion, no giant shoe.",
    "motion": "ribbon"
  },
  "armoryiron": {
    "pool": "threekingdoms",
    "rod": "Eastern Han infantry armory fishing spear. Straight blued iron spine, short diamond-section steel spear reinforcement on the lower grip, peened copper rivets, fitted black leather collar, small open three-spoke iron reel. Practical sharp industrial construction.",
    "fx": "One cold-steel spearhead thrust ghost compresses, drives horizontally right with a narrow white edge, produces a four-point impact spark and retracts. Visible diamond bevel and disciplined straight travel.",
    "motion": "thrust"
  },
  "bambooslip": {
    "pool": "threekingdoms",
    "rod": "Scholar military dispatch rod: twelve slender aged bamboo slips bound into a compact reel guard by dark-red silk cords, tiny indistinct carved grooves not legible writing, black lacquer handle, restrained bronze hinges.",
    "fx": "A short tied bamboo-slip roll opens into a curved fan of individual slats, sends one controlled ochre brushstroke forward, then neatly rebinds; layered paper-dust strokes only.",
    "motion": "seal"
  },
  "riverreed": {
    "pool": "threekingdoms",
    "rod": "Jiangxia reed ferry construction: deep green reed segments straight and securely lashed, miniature dark-wood boat-rib reel cage, rough hemp, tarred seams, patinated bronze oar crank. Convincing small craft joinery.",
    "fx": "A narrow boat-bow-shaped pressure ripple sweeps right, its white lip lifts into two separated reed-green water ribbons, falls and leaves three tiny droplets. No boat or full environment.",
    "motion": "water"
  },
  "granaryspear": {
    "pool": "threekingdoms",
    "rod": "Han granary guard spear rod with a compact leaf-shaped spear socket, bronze grain pattern chased into the reel rim, ochre linen grip and precise dark wood ferrules; paired carved wheat ears stay flush to handle, no dangling grain bunch.",
    "fx": "One amber spear streak passes through a close arc of five finely painted grain-husk fragments, forms a dry sharp contact spark, fragments settle in a clean narrow trajectory.",
    "motion": "thrust"
  },
  "shuembroider": {
    "pool": "threekingdoms",
    "rod": "Shu brocade fitted onto a straight blackwood rod: emerald silk sleeve with minute gold cloud warp, layered lacquered bronze cuffs, compact reel resembling a weaving shuttle, precise stitch seams. Graceful slim martial restraint.",
    "fx": "A single emerald brocade ribbon unfurls, its gold embroidered edge snaps into a sharp S-curve toward impact, then folds and dissolves into tiny silk threads. No broad opaque cloth covering the scene.",
    "motion": "ribbon"
  },
  "wuanchor": {
    "pool": "threekingdoms",
    "rod": "Eastern Wu navy copper anchor rod, compact double-fluke anchor-shaped structural reel guard integrated close to the handgrip, sea-worn teak, verdigris bronze bolts, dark blue rope with neat splices, fine straight black tip.",
    "fx": "Two curved blue-white water wakes converge like anchor flukes, strike into one low fan of spray and fall apart; heavy pulling force rather than an expanding magic ring.",
    "motion": "water"
  },
  "weislate": {
    "pool": "threekingdoms",
    "rod": "Wei scholar black slate inkstone rod: polished ink-black stone oval reel cheek seated in squared bronze cradle, white mineral veins, tightly corded navy grip and restrained geometric Han border engraving.",
    "fx": "A dense black ink stroke with cool silver leading edge slides right, splits in two disciplined calligraphic cuts, leaving a few exquisitely shaped suspended ink drops before vanishing.",
    "motion": "slash"
  },
  "postbanner": {
    "pool": "threekingdoms",
    "rod": "Han courier standard rod with short burgundy swallow-tail silk pennant bound FLUSH along the lower ferrule, angular bronze messenger seal reel, saddle-brown leather, tiny stitched reinforced corners. No oversized waving flag.",
    "fx": "A small burgundy swallowtail pennant snaps forward in six coherent cloth poses; its edge becomes a clean red-gold cut then folds into two tapering silk streaks.",
    "motion": "ribbon"
  },
  "bronzehalberd": {
    "pool": "threekingdoms",
    "rod": "Eastern Han bronze ge-halberd as an assertive compact lower guard, authentic perpendicular spear-and-hook geometry with sharp beveled bronze edge and green recess patina, dark leather-bound ashwood grip, black iron reel integrated behind socket.",
    "fx": "One bronze halberd phantom winds back then hooks across rightward, crisp warm-metal cutting crescent turns to three angular bronze-white shards at contact and vanishes.",
    "motion": "slash"
  },
  "wineladle": {
    "pool": "threekingdoms",
    "rod": "Green-plum wine vessel craft: dark aged bamboo grip, miniature hammered bronze wine-ladle reel cage with delicate pouring lip, three pale jade plum reliefs inset flush, wine-red braided knot kept tight.",
    "fx": "Three translucent green-plum-shaped droplets gather into a compact stream, sweep in a single pouring arc, splash into a low crescent and disappear. Rich liquid refraction with restrained warm-gold rim.",
    "motion": "water"
  },
  "liubei": {
    "pool": "threekingdoms",
    "rod": "Liu Bei twin sword identity: two matched narrow silver cutting blades form a V-shaped lower structural guard around a compact gilded reel, clean blade faces, paired dragon-pommel fittings, deep emerald silk with white silk diamond binding. Two blades stay in lower third, powerful balanced benevolent royal design.",
    "fx": "Two matched silver sword ghosts execute crossing diagonal slashes: separated ready blades, inward acceleration, precise X contact, two emerald-white trailing arcs opening apart, narrow residual edges. Not three swords.",
    "motion": "double"
  },
  "caocao": {
    "pool": "threekingdoms",
    "rod": "Cao Cao paired Yitian and Qinggang sword authority: one dark blued steel and one pale polished steel guard blade, sharp long bevels nested tightly over lower grip, austere gold beast pommel, burgundy lacquer and small square Han seal reel. Heavy statesman-warrior control.",
    "fx": "One cold silver sword cut slices right, a second ink-black red-edged cut crosses it a beat later, compact decisive burst then dark vermilion wisps; sword faces readable, no demonic random flames.",
    "motion": "double"
  },
  "sunquan": {
    "pool": "threekingdoms",
    "rod": "Sun Quan imperial tiger navy design: green-eyed sculpted bronze tiger head forms reel socket, violet silk under layered gilt Han armor plates, angular saber-edge guard, dark purple lacquer grip, small sea-wave details cut into reel. Strong animal anatomy, no pasted portrait.",
    "fx": "A compact bronze-gold tiger-claw rake makes three parallel sharp cuts across a low blue water pressure wake, impact breaks into gold flecks and controlled spray, disciplined ruler force.",
    "motion": "slash"
  },
  "huangzhong": {
    "pool": "threekingdoms",
    "rod": "Huang Zhong aged master archer: laminated dark horn-bow limbs make a compact tensioned reel guard, gold eagle nocks, ox-sinew bindings and russet leather thumb rest, silver arrowhead inset at ferrule. Archer engineering remains functional and sharply resolved.",
    "fx": "A single feathered arrow ghost draws back under a taut gold bowstring curve, releases right as a narrow silver-gold streak, punctures a tiny bright impact point, feathers dissolve. Clear straight bow-powered trajectory.",
    "motion": "projectile"
  },
  "weiyan": {
    "pool": "threekingdoms",
    "rod": "Wei Yan fierce hooked war-saber reel guard, crisp black iron cutting plane and brushed silver bevel, deep red tiger-striped lacquer wrapping, exposed copper rivets, asymmetric angled armor plates securely attached. Aggressive angular silhouette.",
    "fx": "One low red-black saber cut feints shallow then snaps upward, acute silver leading edge and thin crimson trailing ribbon, impact makes one jagged V-shaped break.",
    "motion": "slash"
  },
  "jiangwei": {
    "pool": "threekingdoms",
    "rod": "Jiang Wei qilin spear identity: slim silver spearhead structure along lower handle, azure qilin scale relief on a bronze socket, pale blue silk cords tightly tied, precise triangular facets and clean scholarly martial elegance.",
    "fx": "A slender sapphire spear thrust extends right, a small horned qilin-head pressure silhouette forms behind its point, contact splits into two blue-white spear filaments then retracts.",
    "motion": "thrust"
  },
  "xuhuang": {
    "pool": "threekingdoms",
    "rod": "Xu Huang heavy long-handled battleaxe identity: broad compact blackened axe blade guarding the reel with large clean polished cutting bevel, blunt thick bronze back, dark blue leather cross-wrap and practical massive rivets. Sharp heavy credible load path.",
    "fx": "A weighty steel axe silhouette lifts then chops down-right, its pale cutting arc thickens at impact into a short angular white-blue split, fragments fall, edge returns. Heavy acceleration and quick stop.",
    "motion": "hammer"
  },
  "xuchu": {
    "pool": "threekingdoms",
    "rod": "Xu Chu tiger warrior hammer rod: compact faceted iron hammer head becomes reel housing, roaring bronze tiger pommel, oxblood leather straps, battered hammered steel corners, tiny gold mane inlays. Dense brutal form without enormous top weight.",
    "fx": "A dark iron warhammer ghost compresses low, rises fractionally then drives down, contact forms a blunt white-gold radial crack with five chunky shards; force spreads low and settles fast.",
    "motion": "hammer"
  },
  "dianwei": {
    "pool": "threekingdoms",
    "rod": "Dian Wei twin halberds: paired short hooked iron ji blades frame reel like protective jaws, sharply sharpened steel tips, black leather, aged red cord, simple stout bronze collar. Muscular but coherent mirrored construction.",
    "fx": "Two black iron halberd ghosts slash inward from opposing diagonals, hooked tips stop in a double bright impact, short ochre-white ripples break apart into four metal-like flecks.",
    "motion": "double"
  },
  "zhoutai": {
    "pool": "threekingdoms",
    "rod": "Zhou Tai scarred naval protector: layered scarred dark iron shield plates around a compact copper reel, broad small saber-guard bevel, frayed navy cloth repaired with visible pale stitches, wave-scored fittings. Protective rugged readable armor.",
    "fx": "A small dark steel shield phantom plants at an angle, a forceful blue-white rebound sweeps forward, tight fan of bright rivetlike sparks bursts then retracts behind the shield.",
    "motion": "surface"
  },
  "ganning": {
    "pool": "threekingdoms",
    "rod": "Gan Ning raider: silver ring bells and burgundy silk tied tightly to a black curved saber guard, compact ship-wheel bronze reel, indigo brocade with gold fishscale stitches, six tiny bells with distinct clappers. Fast predatory naval grace.",
    "fx": "One curved silver saber slash darts across two staggered midnight-blue wake ribbons, six tiny gold bell spark marks trail along its path and fade separately. No giant bell or musical glyph.",
    "motion": "slash"
  },
  "luxun": {
    "pool": "threekingdoms",
    "rod": "Lu Xun white-robed fire commander: ivory lacquer grip, fine vermilion silk seam and gilded feather-fan reel cheek, razor-thin silver straight-sword guard, etched ember patterns small and deliberate. Intelligent elegant silhouette.",
    "fx": "A narrow white feather-fan stroke drives a sharply directional scarlet-orange flame front, six tongues bend consistently right, crest hits then breaks into thin hot paperlike embers; no spherical fireball.",
    "motion": "flame"
  },
  "lusu": {
    "pool": "threekingdoms",
    "rod": "Lu Su alliance scholar: matched river-boat keel shapes nest around a round bronze reel, warm ivory silk grip, jade treaty-knot clasp, fine wave engravings and balanced blue-brown hardwood. Courtly engineering.",
    "fx": "Two restrained blue and gold current ribbons approach from opposite sides, braid once and push forward as one clear white-edged water stroke, then gently divide and fade.",
    "motion": "double"
  },
  "zhangliao": {
    "pool": "threekingdoms",
    "rod": "Zhang Liao formidable crescent poleblade in blackened steel, silver sharp inner cutting edge fitted below the grip front, fierce eaglelike angular bronze reel collar, deep violet military cord and overlapping gunmetal plates. Controlled killing intent.",
    "fx": "A single long violet-white crescent cleaves right, thin turbulent water pressure follows low behind it, leading edge remains razor sharp, impact becomes a small hooked return cut and fades.",
    "motion": "slash"
  },
  "wenji": {
    "pool": "threekingdoms",
    "rod": "Cai Wenji hujia reed-pipe identity: seven precision drilled ivory-and-darkwood finger holes along lower handle, slender gilt reed-pipe sidecar integrated as guard, sage silk tassel kept short, goose-feather embossed reel face. Dignified refined craftsmanship.",
    "fx": "One finely feathered pale goose spirit unfolds two elegant wings from a compact jade-gold breath ribbon, glides right once, wingtips turn into four narrow musical breath strands and disperse. No notes or portraits.",
    "motion": "bird"
  },
  "zhangfei": {
    "pool": "threekingdoms",
    "rod": "Zhang Fei serpent spear construction: black iron serpent-shaped spear socket with muscular S-curve and cutting steel teeth, thick short wine-red horsehair knot, rough leather, bronze glaring beast reel, formidable broad-to-thin hierarchy and exact clean edges.",
    "fx": "A black serpent spear ghost thrusts forward with a coiled windup, force becomes a bold charcoal-white roar-shaped pressure fan with two narrow red-edged spear streaks, impact bites sharply then withdraws.",
    "motion": "thrust"
  },
  "zhaoyun": {
    "pool": "threekingdoms",
    "rod": "Zhao Yun bright silver dragon spear: finely chased silver dragon socket, crisp diamond spear bevel guarding lower reel, pearl-white and ice-blue silk diamond wrap, polished small silver reel with dark inset teeth. Graceful narrow long silver martial silhouette, no huge jewels.",
    "fx": "A cold white-silver spear ghost launches right along a single straight axis, tightly coiled pale-blue dragon wake unfurls behind point, impact flowers briefly into five acute silver points then collapses.",
    "motion": "thrust"
  },
  "machao": {
    "pool": "threekingdoms",
    "rod": "Ma Chao western cavalry silver-lion spear: lion-maned silver reel housing, strong narrow spear point with precise hollow-ground bevel, white horsehair short plume, royal blue leather and lamellar gold rivets. Proud bright cavalry sharpness.",
    "fx": "A silver spear thrust is preceded by a leaping blue-white lion head pressure shape, its mane pulled into pointed wind strokes; one concentrated forward impact, trailing strands dissolve, no full rider.",
    "motion": "thrust"
  },
  "zhouyu": {
    "pool": "threekingdoms",
    "rod": "Zhou Yu Red Cliffs commander: slim silver sword reinforcement, exquisite openwork phoenix feather-fan reel, white silk with crimson-gold brocade under layered silver armor fittings, tiny burnt-lacquer edges and sea-blue enamel. Flowing heroic elegance inspired by finished Sanguosha original paintings.",
    "fx": "A refined pale feather fan sweeps once and releases two long scarlet-gold fire wings, their feathers read as sharp separate flame planes; wings converge at impact and break into six directional embers. No unrelated phoenix emblem.",
    "motion": "flame"
  },
  "simayi": {
    "pool": "threekingdoms",
    "rod": "Sima Yi dark strategist: raven-feather steel fins neatly folded around a dark armillary reel, silver-edged obsidian blade guard, deep purple silk and tiny cold starlike rivets, all fine severe angles. Dark elegance with carefully etched Han cloud geometry.",
    "fx": "Three ink-black feather blades spiral tightly around a silver needle of light, accelerate in a narrow rightward curve, cut one sharp crescent and dissolve to sparse violet-black feathers.",
    "motion": "vortex"
  },
  "pangtong": {
    "pool": "threekingdoms",
    "rod": "Pang Tong phoenix fledgling: layered worn bronze phoenix-feather plates and dark-red cord frame a fine wooden chain-link reel, asymmetric folded wing guard, lacquered auburn bamboo grain and subtle ember enamel. Clever restless construction.",
    "fx": "Three delicate bronze-gold chain links uncoil forward in a linked whip path, a small ember phoenix wing flares at the last link, chain pulls taut at contact then flakes into glowing feather slivers.",
    "motion": "ribbon"
  },
  "huangyueying": {
    "pool": "threekingdoms",
    "rod": "Huang Yueying master engineer: intricate boxwood ox cart mechanism reel with interlocking brass pinions, tiny tension springs, bronze ox head bearing cap, latticework folded wooden linkage guard, pale yellow silk handle. Plausible precise assembly, no giant robot or disconnected gears.",
    "fx": "A compact articulated wooden crossbow mechanism opens in coherent hinged stages, fires three slim amber bolts in a tight staggered volley, braces recoil and neatly fold. Anatomically consistent axles and links.",
    "motion": "volley"
  },
  "daqiao": {
    "pool": "threekingdoms",
    "rod": "Da Qiao river grace: slender white-silver paired leaf guard with flowing teal enamel river engravings, pearl-inset compact reel, ivory silk and delicate jade knot, refined clean steel edge. Mature courtly beauty through materials not face.",
    "fx": "Two long translucent turquoise water sleeves sweep together, twist into one clean tall crescent, strike with tiny pearl-white droplets, then gracefully unwind into a low flowing ribbon.",
    "motion": "water"
  },
  "xiaoqiao": {
    "pool": "threekingdoms",
    "rod": "Xiao Qiao autumn strings: five taut fine silver zither strings across a compact rosewood reel guard, small golden swallow corner fittings, coral silk wrap with exact embroidered leaf stitches, pale copper and porcelain accents.",
    "fx": "Five clear warm silver string lines draw into tension, pluck successively rightward and create a precise overlapping fan of narrow coral-gold crescents, then settle to a few tiny sparks. No music symbols.",
    "motion": "threads"
  },
  "diaochan": {
    "pool": "threekingdoms",
    "rod": "Diao Chan moonlit chain blades: slender hooked silver crescent blades frame a compact black-jade reel with fine silver chain linkage, plum silk and small red-garnet inlay, delicate polished planes and exact sharp points. Beautiful dangerous weapon, no large heart ornament.",
    "fx": "Two fine silver chain-linked crescent blades sweep in opposite arcs, cross into a single bright plum-white slash, tighten toward the center and dissolve with three dark rose petals.",
    "motion": "double"
  },
  "dongzhuo": {
    "pool": "threekingdoms",
    "rod": "Dong Zhuo heavy Xiliang bronze cauldron construction: taotie relief compact cauldron-shaped reel housing, thick black iron guard with sharp tusklike upper bevels, oxblood leather and dark patinated gold. Cruel weight with intricate cast surface and real bronze seams.",
    "fx": "A heavy bronze cauldron phantom drops a short distance, collision pushes out a low dark-red shock front with bright bronze-white cracks, five tiny metal splinters tumble then die. No giant magma sphere.",
    "motion": "hammer"
  },
  "zhugeliang": {
    "pool": "threekingdoms",
    "rod": "Zhuge Liang seven-star east wind: extremely fine white feather fan crafted as an open protective reel cage, seven blue-silver star studs on a dark lacquered spine, jade cloud collars, flowing but close-bound pale blue silk. Complex layered vane shafts, elegant scholarly authority.",
    "fx": "Seven small blue-white star points light sequentially along a sweeping invisible wind path, a refined feather fan opens then drives a long clean azure wind-dragon ribbon rightward; dragon is wind-shaped with a lucid crest and jaw, dissolves into seven tapering wisps.",
    "motion": "wind"
  },
  "lubu": {
    "pool": "threekingdoms",
    "rod": "Lu Bu Fangtian halberd: dominant sharply forged symmetric crescent blades and central spear fitted as lower guard, black steel faces and large silver cutting bevels, gold dragon socket, wine-red leather, two short pheasant-feather inlays laid flat along grip. Violent refined hero proportions, meticulous steel and layered gilded armor.",
    "fx": "A mighty silver Fangtian halberd ghost winds back, sweeps down-right leaving an intensely sharp crimson-white blade crescent; two small crossing countercuts follow contact, low shock plume fragments into acute red shards.",
    "motion": "slash"
  },
  "jiangdongtiger": {
    "pool": "threekingdoms",
    "rod": "Sun Jian Jiangdong tiger: dynamic sculpted bronze tiger jaw reel seat biting a short silver saber guard, rich orange-brown lacquer and navy war cord, small layered gold scale plates, exact feline teeth and forehead anatomy. Bright fearsome tiger king construction.",
    "fx": "A fierce gold-white tiger forepaw phantom compresses with four clearly articulated claws, rakes forward once; three dominant jagged amber slashes hit then split into short black-gold wind tails.",
    "motion": "creature"
  },
  "yuanshao": {
    "pool": "threekingdoms",
    "rod": "Yuan Shao noble gold standard: crisp silver spear guard framed by four compact layered gilded banner-plate fins, deep imperial crimson silk, engraved dark bronze reel, pearl-white horsehair detail. Ceremonial wealth grounded in Han military engineering.",
    "fx": "Four small gold standard-cloth echoes unfurl in succession behind a decisive silver-gold spear thrust, meet in one crownlike acute impact, then fold into clean golden silk fragments.",
    "motion": "volley"
  },
  "zuoci": {
    "pool": "threekingdoms",
    "rod": "Zuo Ci occult Han sage: old jade-and-bronze octagonal book-clasp reel, blackwood grip wrapped in aged yellow silk, tiny bronze divination rods and sharp cloud-shaped silver guard, fine cracked cinnabar inlay. Ancient studied ritual precision, no luminous gem stick.",
    "fx": "A compact aged talisman roll unfurls into six floating ochre paper strips with abstract dark brush marks, sheets fold into a precise octagonal spatial turn, one clear white-gold flash strikes then paper slips disperse. No readable text.",
    "motion": "seal"
  },
  "emperorjade": {
    "pool": "threekingdoms",
    "rod": "Hidden Imperial Jade Seal: magnificent compact pale green nephrite seal integrated as the reel chamber, FIVE finely sculpted coiling dragon heads sharing a squared gold repair corner, black lacquer grip, vermilion silk braid, restrained dark-gold imperial armor ferrules. Translucent jade subsurface depth, clear dragon anatomy and fine squared seal edges, museum-level craft.",
    "fx": "A heavy five-dragon jade seal descends in six motion stages, dark-gold dragons curl tightly above the translucent squared jade block, it stamps a sharp vermilion-gold square impact with abstract unreadable seal grooves, then five slender golden dragon wakes rise and vanish. No giant landscape or red full-screen flash.",
    "motion": "seal"
  }
};
const jobs=Object.entries(specs).flatMap(([key,s])=>['rod','fx'].map(kind=>({key,kind,destination:'skins/tracer/fishing-art/'+kind+'-relic-'+key+'-v3.png',prompt:(kind==='rod'?rodCommon:fxCommon)+styles[s.pool]+s[kind]})));
module.exports={rodCommon,styles,fxCommon,specs,jobs};
