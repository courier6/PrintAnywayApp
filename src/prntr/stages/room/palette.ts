/**
 * The room's palette, by the one-letter keys of
 * prntr/design/stage1/art/palette.json. Outlines are plum K on everything.
 */
export const PAL = {
  K: '#2B1B3D', b: '#E9E1CC', d: '#CFC7B0', w: '#F7F3E8', g: '#8C877C', G: '#5E5A52',
  c: '#19B8F0', m: '#F0288C', y: '#FFD91A', o: '#FF6A2B', n: '#46D36E', W: '#FFFFFF',
  i: '#2B2B2B', P: '#FBF8F0', z: '#000000', r: '#FFF4D6', T: '#EDE9DC', t: '#C9C4B4',
  F: '#FFFBE0', f: '#BDB8A6', A: '#D8D2B0', a: '#C4BE9C', B: '#6A6558', C: '#8A877A',
  x: '#7F7C70', X: '#6E6B60', D: '#8A7A62', E: '#5A4A3A', L: '#9ADCFF', l: '#DDE7E8',
  v: '#3E8E4E', V: '#2E6E3E', p: '#B86B3A', s: '#FFF6CC', e: '#A8A08A', R: '#B8140A',
  /** Not in palette.json: the bright red the open machine's button blinks. */
  Q: '#FF2A1A',
  /** The storm's own colours, from stage 0's storm (storm.ts): outside the room, outside palette.json. */
  N: '#0B0D16', // the night sky, the building's silhouette
  M: '#181C2C', // the building's windows, the cloud bank
  U: '#2A3350', // a lit cloud's underside (far lightning), the sky in the afterglow
  u: '#6A7A9C', // the lot's lines, a far light
  h: '#7FC8FF', // water (the rain)
  H: '#BFE7FF', // water, lit
  j: '#9FD8FF', // a bolt's edge; the sky under a near flash
  J: '#070910', // the trees
} as const;
export type PalKey = keyof typeof PAL;

/**
 * String sprite maps, one character per pixel, '.' transparent, letters = PAL keys.
 * Verbatim from prntr/design/stage1/art/sprites.txt, except PAGE_PRINTED and the
 * broken things (CLOCK_BROKEN, POSTER_TORN, TANK_BROKEN, PLANT_BARE, POT_BROKEN,
 * EXIT_BROKEN), SPLAT, the ink on the glass (drawn in c, remapped to m or y), and TUBE_HEAD.
 * The machine is drawn, not a sprite (scene.ts drawMachine). Scale by whole numbers only.
 */
export const SPRITES = {
  // 5 × 5 (the handoff's sticker; no longer drawn: the fight starts from the USB stick)
  INFO: `
.ccc.
cWWWc
ccWcc
ccWcc
.ccc.
`,
  // 39 × 8 at 157,138: the USB stick on the carpet at the room's own resolution (round 2 of the objects sheet, #9): a white
  // promo stick with the SNARC printed on it, its six bars and its arc, a steel connector, its shadow, a
  // cyan lanyard trailing off to the left
  USB: `
................KKKKKKKKKKKKKKKK.......
...............KwWWWWWKKKWWWWWWwKKKKKKK
...............KwwKKKKKwwwwwwwwwKWWWWWK
..............KKwwKwKwKwwwKwwKKwKgKgKgK
...............KwwKwKwKwKwKwKKKwKgggggK
.ccccc.........KddKKKKKKKKKKKKKdKKKKKKK
c.....cc.....c..KKKKKKKKKKKKKKKK.......
........ccccc...XXXXXXXXXXXXXXXXXXXXXX.
`,
  // 8 × 11
  POINTER: `
..KK....
..KWK...
..KWK...
..KWKKK.
..KWKWKK
KKKWWWWK
KWKWWWWK
KWWWWWWK
.KWWWWWK
..KWWWWK
..KKKKKK
`,
  // The cross: a dot and four lines, drawn from these two parts so the gap can open
  // (PRNTR-FIGHT-DESIGN.md §3). 3 × 5 upright, 5 × 3 flat; the caps are plum.
  CROSS_V: `
KKK
KWK
KWK
KWK
KKK
`,
  CROSS_H: `
KKKKK
KWWWK
KKKKK
`,
  // 7 × 7: a nut, and 9 × 5: a bolt, thrown from the slot once the machine is at half health
  // (not in sprites.txt)
  NUT: `
..KKK..
.KgggK.
KggKggK
KgK.KgK
KggKggK
.KgggK.
..KKK..
`,
  BOLT: `
KKKK.....
KggGKKKKK
KgggGgGgK
KggGKKKKK
KKKK.....
`,
  // 8 × 5: a staple with a staple's proportions: a wide crown with a bright edge over dark steel,
  // three rows of thin leg, open underneath (the attacks sheet's STAPLE2; not in sprites.txt)
  STAPLE: `
GGGGGGGG
GWWWWWWG
G......G
G......G
G......G
`,
  // 22 × 46 at 51,90: the water cooler at the room's own resolution (round 2 of the objects sheet, #6):
  // a ribbed bottle, its air at the top and a glint down its side, on a collar; a cream body with a recessed bay,
  // a red hot tap and a blue cold one side by side over a grilled drip tray, a vent at its foot
  COOLER: `
.....KKKKKKKKKKKK.....
.....KllllllllllK.....
...KKllllllllllllKK...
...KlWllllllllllllK...
...KlWllllllllllllK...
...KhWhhhhhhhhhhhhK...
...KLWLLLLLLLLLLLLK...
...KLWLLLLLLLLLLLLK...
...KhWhhhhhhhhhhhhK...
...KLWLLLLLLLLLLLLK...
...KLWLLLLLLLLLLLLK...
...KhWhhhhhhhhhhhhK...
...KLWLLLLLLLLLLLLK...
...KKWKKLLLLLLKKKKK...
........KhhhhK........
........KLLLLK........
........KKKKKK........
.....KKKKKKKKKKKK.....
.....KggggggggggK.....
.....KggggggggggK.....
KKKKKKKKKKKKKKKKKKKKKK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbKKKKKKKKKKKKKKdddK
KwwbKXKKKKKXKKKKKKdddK
KwwbKGKRRRKGKcccKKdddK
KwwbKGKRRRKGKcccKKdddK
KwwbKGKKKKKGKKKKKKdddK
KwwbKGGGKGGGGGKGGKdddK
KwwbKGGGKGGGGGKGGKdddK
KwwbKGGGGGGGGGGGGKdddK
KwwbKGGGGGGGGGGGGKdddK
KwwbKgKgKgKgKgKgKKdddK
KwwbKggggggggggggKdddK
KwwbKKKKKKKKKKKKKKdddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbeeeeeeeeeeeeeedddK
KwwbbbbbbbbbbbbbbddddK
KwwbeeeeeeeeeeeeeedddK
KwwbbbbbbbbbbbbbbddddK
KKKKKKKKKKKKKKKKKKKKKK
`,
  // 14 × 16
  PLANT: `
......vv......
....vvVVvv....
...vVVvvVVv...
..vVvvvvvvVv..
.vVvvvVVvvvVv.
.vvvvVVVVvvvv.
..vvvVVVVvvv..
....vvVVvv....
......vv......
......vv......
....KKKKKK....
...KppppppK...
...KppppppK...
...KppppppK...
....KppppK....
....KKKKKK....
`,
  // 20 × 18
  POSTER: `
KKKKKKKKKKKKKKKKKKKK
KrrrrrrrrrrrrrrrrrrK
KrrrrrrrrrrrrrrrrrrK
KrrcccrmmmryyyrrrrrK
KrrcccrmmmryyyrrrrrK
KrrcccrmmmryyyrrrrrK
KrrooornnnrrrrrrrrrK
KrrooornnnrrrrrrrrrK
KrrooornnnrrrrrrrrrK
KrrrrrrrrrrrrrrrrrrK
KrriiiiiiiiiiiirrrrK
KrrrrrrrrrrrrrrrrrrK
KrriiiiiiiiiirrrrrrK
KrrrrrrrrrrrrrrrrrrK
KrriiiiiiiirrrrrrrrK
KrrrrrrrrrrrrrrrrrrK
KrrrrrrrrrrrrrrrrrrK
KKKKKKKKKKKKKKKKKKKK
`,
  // 16 × 15
  CLOCK: `
.....KKKKKK.....
...KKrrrrrrKK...
..KrrrrrrrrrrK..
.KrrrrrrrrrrrrK.
.KrrrrrrirrrrrK.
KrrrrrrriirrrrrK
KrrrrrrriirrrrrK
KrrrrrrriirrrrrK
KrrrrrrriirrrrrK
KrrrrrriirrrrrrK
.KrrrriirrrrrrK.
.KrrrrirrrrrrrK.
..KrrrrrrrrrrK..
...KKrrrrrrKK...
.....KKKKKK.....
`,
  // 17 × 7
  EXIT: `
KKKKKKKKKKKKKKKKK
KnnnKnKnKnnnKnnnK
KnKKKnKnKKnKKKnKK
KnnKKKnKKKnKKKnKK
KnKKKnKnKKnKKKnKK
KnnnKnKnKnnnKKnKK
KKKKKKKKKKKKKKKKK
`,
  // 17 × 7: the sign on the floor, its letters out, cracked across (not in sprites.txt)
  EXIT_BROKEN: `
KKKKKKKKKKK.KKKKK
KGGGKGKGKGG.KGGGK
KGKKKGKGKK.KKKGKK
KGGKKKGKK.GKKKGKK
KGKKKGKG.KGKKKGKK
KGGGKGK.KGGGKKGKK
KKKKKKK.KKKKKKKKK
`,
  // 16 × 14: a splat of ink on the glass
  SPLAT: `
.....KK....K....
...KKccK..KcK...
..KccccKKKcccK..
.KccccccccccccK.
.KcccccccccccccK
KcccccccccccccK.
KccccccccccccccK
.KcccccccccccccK
.KccccccccccccK.
..KcccccccccccK.
...KccccKKcccK..
..KcccK..KccK...
...KKK....KK....
..........K.....
`,
  // 13 × 10: a first aid kit on the wall by the window (not in sprites.txt): a soft green pouch
  // hanging from a loop, a white cross on it (green, not red: the red cross is a protected emblem), a
  // grey zip along its top; KIT_OPEN is the same pouch shot open, the zip gaping, hanging empty and limp
  KIT: `
.....KKK.....
....K...K....
.KKKKKKKKKKK.
KngngngngngnK
KnnnnnWnnnnnK
KnnnnWWWnnnnK
KnnnnnWnnnnnK
KnnnnnnnnnnnK
.KnnnnnnnnnK.
..KKKKKKKKK..
`,
  KIT_OPEN: `
.....KKK.....
....K...K....
.KKKKKKKKKKK.
KiiiiiiiiiiiK
KngnnnnnnngnK
.KnnnnWnnnnK.
.KnnnWWWnnnK.
..KnnnWnnnK..
...KnnnnnK...
....KKKKK....
`,
  // 6 × 4: the head of an ink tube up from behind the machine; its mouth (c) takes the ink's
  // colour (not in sprites.txt)
  TUBE_HEAD: `
.KKKK.
KggggK
KgccgK
.KKKK.
`,
  // 10 × 13
  PAGE_SMALL: `
KKKKKKKKKK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KwwwwwwwwK
KKKKKKKKKK
`,
  // 10 × 13: PAGE_SMALL with five lines of print, for the pages the machine throws
  // (not in sprites.txt). The page in the tray stays blank.
  PAGE_PRINTED: `
KKKKKKKKKK
KwwwwwwwwK
KwiiiiwwwK
KwwwwwwwwK
KwiiwiiiwK
KwwwwwwwwK
KwiiiiiwwK
KwwwwwwwwK
KwiwiiiiwK
KwwwwwwwwK
KwiiiwwwwK
KwwwwwwwwK
KKKKKKKKKK
`,
  // 16 × 15: the clock shot: a crack from the top down the right, both hands hanging. No longer
  // drawn: the clock falls off the wall instead.
  CLOCK_BROKEN: `
.....KKKKKK.....
...KKrrrrrrKK...
..KrrrrrrKrrrK..
.KrrrrrrKrrrrrK.
.KrrrrrKrrrrrrK.
KrrrrrrKKrrrrrrK
KrrrrrrrKKrrrrrK
KrrrrrrriKrrrrrK
KrrrrrrriirKrrrK
KrrrrrrriirrKrrK
.KrrrrrriirrrKK.
.KrrrrrrirrrrrK.
..KrrrrrrrrrrK..
...KKrrrrrrKK...
.....KKKKKK.....
`,
  // 20 × 18: the poster shot: the lower right torn away (the wall shows through).
  POSTER_TORN: `
KKKKKKKKKKKKKKKKKKKK
KrrrrrrrrrrrrrrrrrrK
KrrrrrrrrrrrrrrrrrrK
KrrcccrmmmryyyrrrrrK
KrrcccrmmmryyyrrrrrK
KrrcccrmmmryyyrrrrrK
KrrooornnnrrrrrrrrKK
KrrooornnnrrrrrrrK..
KrrooornnnrrrrrKK...
KrrrrrrrrrrrrrK.....
KrriiiiiiiiiiK......
KrrrrrrrrrrKK.......
KrriiiiiiiK.........
KrrrrrrrKK..........
KrriiiiK............
KrrrrrK.............
KrrrKK..............
KKKK................
`,
  // 22 × 33 at 51,103: the cooler with its bottle shot: the jagged neck left in the collar, the body
  COOLER_SHOT: `
............L.........
.........L....L.......
..........l..W........
.......LLLLLLLLL......
.....KKKKKKKKKKKK.....
.....KggggggggggK.....
.....KggggggggggK.....
KKKKKKKKKKKKKKKKKKKKKK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbKKKKKKKKKKKKKKdddK
KwwbKXKKKKKXKKKKKKdddK
KwwbKGKRRRKGKcccKKdddK
KwwbKGKRRRKGKcccKKdddK
KwwbKGKKKKKGKKKKKKdddK
KwwbKGGGKGGGGGKGGKdddK
KwwbKGGGKGGGGGKGGKdddK
KwwbKGGGGGGGGGGGGKdddK
KwwbKGGGGGGGGGGGGKdddK
KwwbKgKgKgKgKgKgKKdddK
KwwbKggggggggggggKdddK
KwwbKKKKKKKKKKKKKKdddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbbbbbbbbbbbbbbddddK
KwwbeeeeeeeeeeeeeedddK
KwwbbbbbbbbbbbbbbddddK
KwwbeeeeeeeeeeeeeedddK
KwwbbbbbbbbbbbbbbddddK
KKKKKKKKKKKKKKKKKKKKKK
`,
  // 14 × 10: the plant shot: bare stems (PLANT rows 0–9); its leaves lie on the carpet.
  PLANT_BARE: `
..............
..............
..............
..............
......v.......
.....vv.......
......vv......
.....vvv......
......vv......
......vv......
`,
  // 14 × 6: the pot shot: shards and the soil spilled (PLANT rows 10–15).
  POT_BROKEN: `
..............
......K.K.....
...KpK.KpK....
..KppKKKppK...
.EEEEEEEEEEEE.
..EEEEEEEEEE..
`,
} as const;
