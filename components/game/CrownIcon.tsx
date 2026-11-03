import { CROWN_PATH } from "./glyphs";

export function CrownIcon({ size = 18, fill = "#F5C84B", stroke = "#0F2E45", className, style }: { size?: number; fill?: string; stroke?: string | null; className?: string; style?: React.CSSProperties }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden className={className} style={style}>
      <path d={CROWN_PATH} fill={fill} stroke={stroke ?? undefined} strokeWidth={stroke ? 1.5 : 0} strokeLinejoin="round" />
    </svg>
  );
}
