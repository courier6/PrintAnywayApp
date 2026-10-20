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
} as const;
export type PalKey = keyof typeof PAL;

/**
 * String sprite maps, one character per pixel, '.' transparent, letters = PAL keys.
 * Verbatim from prntr/design/stage1/art/sprites.txt, except PAGE_PRINTED and the
 * broken things (CLOCK_BROKEN, POSTER_TORN, TANK_BROKEN, PLANT_BARE, POT_BROKEN,
 * EXIT_BROKEN), SPLAT, the ink on the glass (drawn in c, remapped to m or y), and TUBE_HEAD.
 * Scale by whole numbers only.
 */
export const SPRITES = {
  // 32 × 22
  MFC: `
..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..
..KddddddddddddddddddddddddddK..
..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..
.KbbbbbbbbbbbbbbbbbbbbbbbbbbbbK.
.KbbbbbbbbbbbbbbbbbbbbbbbbbbbbK.
.KbbbbbbbbbbbbbbbbbbbbbbbbbbbbK.
.KbbbbbbbbbbbbbbbbbbbbbKKKKKbbK.
.KbbbbbbbbbbbbbbbbbbbbbKnKKKbbK.
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
.KggggggggggggggggggggggggggggK.
.KgKKKKKKKKKKKKKKKKKKKKKKKKKgK..
.KgKwwwwwwwwwwwwwwwwwwwwwwwKgK..
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggKddddddddddddddddddddKggggK.
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggggggggggggggggggggggggggggK.
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggKddddddddddddddddddddKggggK.
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggggggggggggggggggggggggggggK.
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
..KKK......................KKK..
`,
  // 32 × 22
  MFC_MAD: `
..KKKKKKKKKKKKKKKKKKKKKKKKKKKK..
.KddddddddddddddddddddddddddddK.
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
.KWWWWWWWWWWWWWWWWWWWWWWWWWWWWK.
.KccccccccccccccccccccccccccccK.
.KbbbbbbbbbbbbbbbbbbbbbbbbbbbbK.
.KbbbbbbbbbbbbbbbbbbbbbKKKKKbbK.
.KbbbbbbbbbbbbbbbbbbbbbKRRRKbbK.
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
.KggggggggggggggggggggggggggggK.
.KgKKKKKKKKKKKKKKKKKKKKKKKKKgK..
.KgKzzzzzzzzzzzzzzzzzzzzzzzKgK..
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggKddddddddddddddddddddKggggK.
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggggggggggggggggggggggggggggK.
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggKddddddddddddddddddddKggggK.
.KggKKKKKKKKKKKKKKKKKKKKKKggggK.
.KggggggggggggggggggggggggggggK.
.KKKKKKKKKKKKKKKKKKKKKKKKKKKKKK.
..KKK......................KKK..
`,
  // 5 × 5 (the handoff's sticker; no longer drawn: the fight starts from the USB stick)
  INFO: `
.ccc.
cWWWc
ccWcc
ccWcc
.ccc.
`,
  // 10 × 5: a USB stick on the carpet, its cap to the right (not in sprites.txt)
  USB: `
.KKKKKKK..
KdddddddK.
KdcddddKgK
KdddddddK.
.KKKKKKK..
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
  // 11 × 13
  CROSSHAIR: `
....KWK....
....KWK....
....KWK....
..KKKKKKK..
.KWWK.KWWK.
KWK.....KWK
KWK..W..KWK
KWK.....KWK
.KWWK.KWWK.
..KKKKKKK..
....KWK....
....KWK....
....KWK....
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
  // 6 × 5
  STAPLE: `
gggggg
gWWWWg
gW..Wg
gW..Wg
gW..Wg
`,
  // 12 × 22
  COOLER: `
...KKKKKK...
..KllllllK..
..KlWlllLK..
..KLLLLLLK..
..KLLLLLLK..
..KLLLLLLK..
..KLLLLLLK..
...KKKKKK...
..KKbbbbKK..
.KddddddddK.
.KddddddddK.
.KddKKddddK.
.KddKcddddK.
.KddddddddK.
.KddddddddK.
.KddddddddK.
.KddddddddK.
.KddddddddK.
.KddddddddK.
.KddddddddK.
.KddddddddK.
.KKKKKKKKKK.
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
  // 13 × 10: a first aid kit on the wall by the window (not in sprites.txt):
  // a white box with a plum outline, its cross and its clasp green instead of red, so it reads as
  // good; KIT_OPEN is the same box shot open and empty, its lid hanging
  KIT: `
.KKKKKKKKKKK.
KwwwwwnwwwwwK
KwwwwnnnwwwwK
KwwnnnnnnnwwK
KwwnnnnnnnwwK
KwwwwnnnwwwwK
KwwwwwnwwwwwK
KwwwwwwwwwwwK
KwwwwnnnwwwwK
.KKKKKKKKKKK.
`,
  KIT_OPEN: `
KKKKKK.......
KwwwwwK......
KwwnwwwK.....
.KwwwwwK.....
..KKKKKKKKKK.
..KdddddddddK
..KdKKdddKKdK
..KdddddddddK
..KdddddddddK
..KKKKKKKKKKK
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
  // 12 × 8: the cooler's bottle shot: a jagged stump of it on the neck (COOLER rows 0–7).
  TANK_BROKEN: `
............
............
............
..K......K..
..KL....LK..
..KLl..lLK..
..KLLlLLLK..
...KKKKKK...
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
