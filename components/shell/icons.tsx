/** Nav icons from the mockups (lucide-style, 2px stroke). */
export function IslandIcon({ active, size = 20 }: { active?: boolean; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={active ? "#F5C84B" : "currentColor"} strokeWidth="2" strokeLinejoin="round" aria-hidden>
      <path d="M12 2 20.5 7v10L12 22 3.5 17V7z" />
    </svg>
  );
}
export function QuestsIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1 0-5H20" />
    </svg>
  );
}
export function ShelfIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 6h18" />
      <path d="M3 18h18" />
      <path d="M6 6v12" />
      <path d="M10 9v9" />
      <path d="M14 6v12" />
      <path d="m17 8 3 10" />
    </svg>
  );
}
export function GuildIcon({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 22V4a1 1 0 0 1 1-1h13l-3 5 3 5H5" />
    </svg>
  );
}
export function LogHexIcon() {
  return (
    <svg width="18" height="20" viewBox="0 0 24 28" aria-hidden>
      <path d="M12 1 23 7.5v13L12 27 1 20.5v-13z" fill="#0F2E45" />
      <path d="M12 9v10M7 14h10" stroke="#F5C84B" strokeWidth="2.6" strokeLinecap="round" />
    </svg>
  );
}
