// AmaliCode wordmark.
//
// `left` renders muted and `right` renders bold (see tui.tsx), so the
// split is "Amali" + "Code" — the same two-tone treatment upstream gave
// "open" + "code", which is also why the capital C reads as intentional.
//
// Two things drive the shapes here:
//
// 1. Cap height vs x-height. `A` and `C` start in row 0 and run to row 3; the
//    lowercase `m a i` sit on rows 1-3 only, and `l` and `d` reach into row 0 for
//    their ascenders. Without that the capitals were the same height as the
//    lowercase and the word read as one undifferentiated block.
//
// 2. Width. Glyphs are 5-7 columns rather than upstream's 4. At 4 columns the
//    arches of `m` collapse into each other, and `a` needs a full-height right
//    stem to fit, which makes it read as `d`. Hence `a` is drawn with a uniformly
//    low top (▄▄▄▄▄) and no tall stem.
//
// Note that every lowercase letter opens its row 1 with ▄ rather than █ or ▀.
// A half-block sets the top edge at the middle of the row, so `m`, `a` and the
// stem of `i` all start at exactly the same height. Using █ or ▀ there — as the
// first draft did for `m` — raises that letter by half a row, which is small on
// paper and very obvious on screen.
//
// Glyph vocabulary, interpreted by glyphs() in tui.tsx:
//   █ ▀ ▄  literal blocks
//   _      space on a shadow ground — a letter's inner counter
//   ^      ▀ in the foreground on a shadow ground — a crossbar
//   ~      ▀ in shadow — an open bottom, e.g. under the shoulders of m
//   ,      ▄ in shadow
export const logo = {
  left: [
    "▄▄▄▄▄▄               ▄ ▀",
    "█____█ ▄▄▄▄▄▄▄ ▄▄▄▄▄ █ ▄",
    "█^^^^█ █__█__█ █___█ █ █",
    "▀    ▀ ▀~~▀~~▀ ▀▀▀▀▀ ▀ ▀",
  ],
  right: [
    "▄▄▄▄▄           ▄      ",
    "█____ █▀▀▀█ █▀▀▀█ █▀▀▀█",
    "█____ █___█ █___█ █^^^^",
    "▀▀▀▀▀ ▀▀▀▀▀ ▀▀▀▀▀ ▀▀▀▀▀",
  ],
}

// The AmaliAI app mark: three stacked bars, as they appear in the product's own
// icon. Each ▀ fills the top half of its row, so the gap between bars comes free
// from the half-block itself rather than needing blank rows. It sits on rows 1-3,
// aligned with the letter bodies rather than the cap height.
export const mark = ["     ", "▀▀▀▀▀", "▀▀▀▀▀", "▀▀▀▀▀"]

// AmaliAI brand orange, as used throughout the web product.
export const brand = "#f97316"
