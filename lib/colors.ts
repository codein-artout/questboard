export const PLAYER_COLORS = {
  red: { bg: "#C8323B", fg: "#FFFFFF", name: "red" },
  blue: { bg: "#2459B8", fg: "#FFFFFF", name: "blue" },
  yellow: { bg: "#E8A80C", fg: "#1B1F3B", name: "yellow" },
  green: { bg: "#2E7D4F", fg: "#FFFFFF", name: "green" },
  purple: { bg: "#6A3FA5", fg: "#FFFFFF", name: "purple" },
  orange: { bg: "#E0662A", fg: "#1B1F3B", name: "orange" },
  black: { bg: "#23252B", fg: "#FFFFFF", name: "black" },
  white: { bg: "#FFFFFF", fg: "#1B1F3B", name: "white" },
} as const;
export type PlayerColorKey = keyof typeof PLAYER_COLORS;
export const PLAYER_COLOR_KEYS = Object.keys(PLAYER_COLORS) as PlayerColorKey[];
/** Guests get a neutral disc. */
export const GUEST_COLOR = { bg: "#2D5878", fg: "#EAF2F7", name: "guest" };
