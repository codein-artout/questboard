/** Exact glyph paths from the mockups (24x24 viewBox). */
export const BUILDING_PATHS: Record<number, string> = {
  1: "M10 3h1.6v17H10z M11.6 3l7 3.2-7 3.2z",
  2: "M2 14l5-5 5 5v6H2z M11 12.5l5.5-5.5 5.5 5.5V20H11z",
  3: "M1 15l3.5-3.5L8 15v5H1z M7.5 12.5 12 8l4.5 4.5V20h-9z M17 7h5v13h-5z M17 7l2.5-3L22 7z",
  4: "M6 5h2.5v2.5H11V5h2v2.5h2.5V5H18v15H6z",
  5: "M1 9h2v2h2V9h2v11H1z M17 9h2v2h2V9h2v11h-6z M7 13h10v7H7z M9.5 4h1.5v1.5h2V4h1.5v9h-5z",
  6: "M12 1l2.6 7h-1.2v10h-2.8V8H9.4z M5 18h14v3H5z M3 21h18v2H3z",
};

export const CROWN_PATH = "M3 8l4.5 3L12 4l4.5 7L21 8l-2 10H5z";
export const HEX_PATH = "M12 2 20.5 7v10L12 22 3.5 17V7z";

export const TERRAIN_ICON_PATHS: Record<string, string> = {
  forest: "M12 2 18 11h-3.5l4.5 7H5l4.5-7H6z",
  peaks: "M2 19 9 7l4 6 2.5-3.5L22 19z",
  meadow: "M12 7a5 5 0 1 0 0 10 5 5 0 0 0 0-10z",
  marsh: "M2 12s4-6 10-6 10 6 10 6-4 6-10 6S2 12 2 12zm10-3a3 3 0 1 0 0 6 3 3 0 0 0 0-6z",
  reef: "M2 14c2.5 0 2.5-3 5-3s2.5 3 5 3 2.5-3 5-3 2.5 3 5 3v5H2z",
  tundra: "M12 2l5 10-5 10-5-10z",
};

/** Building size (px) at a 76px tile, by tier. */
export const BUILDING_SIZE_76: Record<number, number> = { 0: 18, 1: 20, 2: 24, 3: 28, 4: 30, 5: 34, 6: 36 };
