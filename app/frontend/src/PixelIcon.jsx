import React from 'react';

const PALETTE = {
  '.': null,
  'W': '#FFFFFF',
  'K': '#111827', // Deep black/charcoal
  'G': '#6B7280', // Medium gray
  'L': '#D1D5DB', // Light gray
  'B': '#1D4ED8', // Strong blue
  'C': '#38BDF8', // Sky cyan
  'Y': '#FACC15', // Warm yellow
  'O': '#EA580C', // Vivid orange
  'R': '#DC2626', // Clear red
  'E': '#059669', // Clear emerald green
  'M': '#10B981', // Bright green
  'P': '#FDBA74', // Peach/skin
};

const GRIDS = {
  // Smartphone & QR scanner
  camera: [
    "....KKKKKKKK....",
    "...KGGGGGGGGK...",
    "...KWWWWWWWWK...",
    "...KWKKWWKKWK...",
    "...KWKKWWKKWK...",
    "...KWWWWWWWWK...",
    "...KWWBBBBWWK...",
    "..RKWBBBBBBWKR..",
    ".RRKRRRRRRRRKRR.",
    "..RKWBBBBBBWKR..",
    "...KWWBBBBWWK...",
    "...KWKKWWKKWK...",
    "...KWKKWWKKWK...",
    "...KWWWWWWWWK...",
    "...KGGGKKGGGK...",
    "....KKKKKKKK....",
  ],
  // Trophy / Score / Results
  trophy: [
    "..KKKKKKKKKKKK..",
    ".KKYYYYYYYYYYKK.",
    "K.KYYYYYYYYYYK.K",
    "K.KYYWWWWWWYYK.K",
    "K.KYYYYYYYYYYK.K",
    ".KKYYYYYYYYYYKK.",
    "..KYYYYYYYYYYK..",
    "...KKYYYYYYKK...",
    ".....KKYYKK.....",
    "......KYYK......",
    "......KYYK......",
    "....KKYYYYKK....",
    "...KYYYYYYYYK...",
    "..KKKKKKKKKKKK..",
    "..KGGGGGGGGGGK..",
    "..KKKKKKKKKKKK..",
  ],
  // Clock / Timer
  clock: [
    "....KKKKKKKK....",
    "..KKWWWWWWWWKK..",
    ".KWWWWKKKKWWWWK.",
    ".KWWWKWWWWKWWWK.",
    "KWWWWKWWWWWWWWWk".replace('k','K'),
    "KWWWWKWWWWWWWWWK",
    "KWWWWKWWWWWWWWWK",
    "KWWWWKKKKKWWWWWK",
    "KWWWWWWWWKWWWWWK",
    "KWWWWWWWWKWWWWWK",
    "KWWWWWWWWWWWWWWK",
    ".KWWWWWWWWWWWWK.",
    ".KWWWWWWWWWWWWK.",
    "..KKWWWWWWWWKK..",
    "....KKKKKKKK....",
    "................",
  ],
  // Globe / Overall Event Timer
  globe: [
    "....KKKKKKKK....",
    "..KKCCCCCCCCKK..",
    ".KCCCEEEEECCCCK.",
    ".KCCEEEEEECCCCK.",
    "KCCCCEEEECCCCCCK",
    "KCCCCCCCCEECCCCK",
    "KCCEEECCCEEECCCK",
    "KCCEEEECCEEECCCK",
    "KCCEEEECCCCCCCCK",
    "KCCCEEECCCCEECCK",
    "KCCCCCCCCCEEEECK",
    ".KCCCCCCCCEEECK.",
    ".KCCCCCCCCCCCCK.",
    "..KKCCCCCCCCKK..",
    "....KKKKKKKK....",
    "................",
  ],
  // Correct (Big Double Circle / Maru)
  correct: [
    "....KKKKKKKK....",
    "..KKRRRRRRRRKK..",
    ".KRRRRKKKKRRRRK.",
    ".KRRKKWWWWKKRRK.",
    "KRRKWWWWWWWWKRRK",
    "KRRKWWKKKKWWKRRK",
    "KRRKWKWWWWKWKRRK",
    "KRRKWKWWWWKWKRRK",
    "KRRKWKWWWWKWKRRK",
    "KRRKWKWWWWKWKRRK",
    "KRRKWWKKKKWWKRRK",
    "KRRKWWWWWWWWKRRK",
    ".KRRKKWWWWKKRRK.",
    ".KRRRRKKKKRRRRK.",
    "..KKRRRRRRRRKK..",
    "....KKKKKKKK....",
  ],
  // Wrong (Big Cross / Batsu)
  wrong: [
    ".KKKK......KKKK.",
    "KBBBBK....KBBBBK",
    "KBBBBBK..KBBBBBK",
    ".KBBBBBK.KBBBBK.",
    "..KBBBBKKBBBBK..",
    "...KBBBBBBBBK...",
    "....KBBBBBBK....",
    ".....KBBBBK.....",
    ".....KBBBBK.....",
    "....KBBBBBBK....",
    "...KBBBBBBBBK...",
    "..KBBBBKKBBBBK..",
    ".KBBBBBK.KBBBBK.",
    "KBBBBBK..KBBBBBK",
    "KBBBBK....KBBBBK",
    ".KKKK......KKKK.",
  ],
  // Lightbulb / Hint
  bulb: [
    ".....KKKKKK.....",
    "...KKYYYYYYKK...",
    "..KYYYYYYYYYYK..",
    ".KYYYYWWWWYYYYK.",
    ".KYYYWYYYYYYYYK.",
    ".KYYYWYYYYYYYYK.",
    ".KYYYYYYYYYYYYK.",
    "..KYYYYYYYYYYK..",
    "...KYYYYYYYYK...",
    "....KYYYYYYK....",
    "....KGGGGGGK....",
    ".....KLLLLK.....",
    ".....KGGGGK.....",
    "......KKKK......",
    "................",
    "................",
  ],
  // Padlock / Locked
  lock: [
    ".....KKKKKK.....",
    "...KKGGGGGGKK...",
    "..KGGKKKKKKGGK..",
    "..KGK......KGK..",
    "..KGK......KGK..",
    "..KGK......KGK..",
    ".KKKKKKKKKKKKKK.",
    ".KYYYYYYYYYYYYK.",
    ".KYYYYKKKKYYYYK.",
    ".KYYYKYYYYKYYYK.",
    ".KYYYYKYYKYYYYK.",
    ".KYYYYYKKYYYYYK.",
    ".KYYYYYKKYYYYYK.",
    ".KYYYYYYYYYYYYK.",
    ".KKKKKKKKKKKKKK.",
    "................",
  ],
  // Map Pin / GPS
  pin: [
    ".....KKKKKK.....",
    "...KKRRRRRRKK...",
    "..KRRRRWWWRRRK..",
    ".KRRRRWWWWWRRRK.",
    ".KRRRRWWWWWRRRK.",
    ".KRRRRRWWWRRRRK.",
    "..KRRRRRRRRRRK..",
    "...KKRRRRRRKK...",
    "....KKRRRRKK....",
    ".....KKRRKK.....",
    "......KKKK......",
    "...GGGGKKGGGG...",
    "..GGGGGGGGGGGG..",
    ".GGGGGGGGGGGGGG.",
    "..GGGGGGGGGGGG..",
    "....GGGGGGGG....",
  ],
  // Flag / Finish
  flag: [
    "..KK............",
    "..KKKKKKKKKKKK..",
    "..KRRRRRRRRRRK..",
    "..KRRRRWWWRRRK..",
    "..KRRRRRRRRRRK..",
    "..KOOOOOOOOOOK..",
    "..KOOOOOOOOOOK..",
    "..KKKKKKKKKKKK..",
    "..KK............",
    "..KK............",
    "..KK............",
    "..KK............",
    "..KK............",
    ".KKKK...........",
    "KKKKKK..........",
    "................",
  ],
  // Book / Explanation / Terms
  book: [
    "..KKKKKKKKKKKK..",
    ".KBBBBBBBBBBBBK.",
    ".KBWWWWWWWWWWBK.",
    ".KBWKKKKKKKKWBK.",
    ".KBWWWWWWWWWWBK.",
    ".KBWKKKKKKKKWBK.",
    ".KBWWWWWWWWWWBK.",
    ".KBWKKKKWWWWWBK.",
    ".KBWWWWWWWWWWBK.",
    ".KBBBBBBBBBBBBK.",
    ".KGGGGGGGGGGGGK.",
    ".KWWWWWWWWWWWWK.",
    "..KKKKKKKKKKKK..",
    "................",
    "................",
    "................",
  ],
  // User / Person
  user: [
    ".....KKKKKK.....",
    "...KKBBBBBBKK...",
    "..KBBBBBBBBBBK..",
    "..KBBBBBBBBBBK..",
    "..KBBBBBBBBBBK..",
    "...KKBBBBBBKK...",
    ".....KKKKKK.....",
    "...KKKKKKKKKK...",
    ".KKBBBBBBBBBBKK.",
    "KBBBBBBBBBBBBBBK",
    "KBBBBBBBBBBBBBBK",
    "KBBBBBBBBBBBBBBK",
    "KBBBBBBBBBBBBBBK",
    "KBBBBBBBBBBBBBBK",
    ".KKKKKKKKKKKKKK.",
    "................",
  ],
  // Lightning / Fast push
  bolt: [
    ".......KKKKKK...",
    "......KYYYYYYK..",
    ".....KYYYYYYK...",
    "....KYYYYYYK....",
    "...KYYYYYYK.....",
    "..KYYYYYYYYKKKK.",
    ".KYYYYYYYYYYYYK.",
    ".KKKKKKYYYYYYK..",
    "......KYYYYYK...",
    ".....KYYYYYK....",
    "....KYYYYYK.....",
    "...KYYYYYK......",
    "..KYYYYYK.......",
    "..KYYYYK........",
    "..KKKKK.........",
    "................",
  ],
  // Checkmark Badge
  check: [
    "....KKKKKKKK....",
    "..KKEEEEEEEEKK..",
    ".KEEEEEEEEEEEEK.",
    "KEEEEEEEEEWWEECK",
    "KEEEEEEEEWWEEEK.",
    "KEEEEEEEWWEEEEK.",
    "KEEWEEEWWEEEEEE.",
    "KEEWWWWWEEEEEEE.",
    ".KEEWWWEEEEEEEK.",
    ".KEEEEEEEEEEEEK.",
    "..KKEEEEEEEEKK..",
    "....KKKKKKKK....",
    "................",
    "................",
    "................",
    "................",
  ],
  // Settings / Admin / Gear
  gear: [
    "......KKKK......",
    ".....KGGGGK.....",
    "..KK.KGGGGK.KK..",
    ".KGGKKGGGGKKGGK.",
    ".KGGGGGGGGGGGGK.",
    "..KGGGKKKKGGGK..",
    "KKKKGKWWWWKGKKKK",
    "KGGGGKWWWWKGGGGK",
    "KKKKGKWWWWKGKKKK",
    "..KGGGKKKKGGGK..",
    ".KGGGGGGGGGGGGK.",
    ".KGGKKGGGGKKGGK.",
    "..KK.KGGGGK.KK..",
    ".....KGGGGK.....",
    "......KKKK......",
    "................",
  ],
  // Printer / Sheet
  print: [
    "....KKKKKKKK....",
    "...KWWWWWWWWK...",
    "...KWWWWWWWWK...",
    ".KKKKKKKKKKKKKK.",
    "KGGGGGGGGGGGGGGK",
    "KGGGGGGGGGGYYGGK",
    "KGGGGGGGGGGGGGGK",
    "KKKKKKKKKKKKKKKK",
    "...KWKKKKKKWK...",
    "...KWWWWWWWWK...",
    "...KWKKKKKKWK...",
    "...KWWWWWWWWK...",
    "...KWKKKKWWWK...",
    "...KWWWWWWWWK...",
    "....KKKKKKKK....",
    "................",
  ],
  // Stop / Alert
  stop: [
    "....KKKKKKKK....",
    "..KKRRRRRRRRKK..",
    ".KRRRRRRRRRRRRK.",
    "KRRRRRKKKKRRRRRK",
    "KRRRRRKKKKRRRRRK",
    "KRRRRRKKKKRRRRRK",
    "KRRRRRKKKKRRRRRK",
    "KRRRRRKKKKRRRRRK",
    "KRRRRRRRRRRRRRRK",
    "KRRRRRKKKKRRRRRK",
    "KRRRRRKKKKRRRRRK",
    ".KRRRRRRRRRRRRK.",
    "..KKRRRRRRRRKK..",
    "....KKKKKKKK....",
    "................",
    "................",
  ],
};

export default function PixelIcon({ name = 'camera', size = 36, className = '' }) {
  const grid = GRIDS[name] || GRIDS.camera;
  const rects = [];

  for (let r = 0; r < grid.length; r++) {
    const row = grid[r];
    for (let c = 0; c < row.length; c++) {
      const ch = row[c];
      const fill = PALETTE[ch];
      if (fill) {
        rects.push(
          <rect key={`${r}-${c}`} x={c} y={r} width={1} height={1} fill={fill} />
        );
      }
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 16 16"
      shapeRendering="crispEdges"
      className={`inline-block flex-shrink-0 select-none ${className}`}
      aria-hidden="true"
    >
      {rects}
    </svg>
  );
}
