/** Small, dependency-free formatting helpers (en-US, sentence case). */

const DAY = 86400000;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

export const plural = (n: number, one: string, many = `${one}s`) => `${n.toLocaleString("en-US")} ${n === 1 ? one : many}`;

function startOfDay(d: Date, tz: number) {
  const local = new Date(d.getTime() + tz * 60000);
  return Math.floor(local.getTime() / DAY);
}

/** "Today", "Yesterday", "Last Thursday", "24 Oct", "24 Oct 2025". `tz` is minutes east of UTC. */
export function relativeDay(d: Date, now = new Date(), tz = 0): string {
  const diff = startOfDay(now, tz) - startOfDay(d, tz);
  const local = new Date(d.getTime() + tz * 60000);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  if (diff > 1 && diff < 7) return WEEKDAYS[local.getUTCDay()]!;
  if (diff >= 7 && diff < 14) return `Last ${WEEKDAYS[local.getUTCDay()]}`;
  const sameYear = local.getUTCFullYear() === new Date(now.getTime() + tz * 60000).getUTCFullYear();
  return `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}${sameYear ? "" : ` ${local.getUTCFullYear()}`}`;
}

/** Short "when" for feed cards: time today, weekday this week, else date. */
export function feedWhen(d: Date, now = new Date(), tz = 0): string {
  const diff = startOfDay(now, tz) - startOfDay(d, tz);
  const local = new Date(d.getTime() + tz * 60000);
  if (diff === 0) {
    const h = local.getUTCHours();
    const m = String(local.getUTCMinutes()).padStart(2, "0");
    return `${h % 12 || 12}:${m} ${h < 12 ? "AM" : "PM"}`;
  }
  if (diff > 0 && diff < 7) return WEEKDAYS[local.getUTCDay()]!.slice(0, 3);
  return relativeDay(d, now, tz);
}

export function monthName(d: Date, long = true): string {
  return long ? MONTHS_LONG[d.getUTCMonth()]! : MONTHS[d.getUTCMonth()]!;
}

/** "in March", "in March 2024". */
export function inMonth(d: Date, now = new Date()): string {
  return `in ${monthName(d)}${d.getUTCFullYear() === now.getUTCFullYear() ? "" : ` ${d.getUTCFullYear()}`}`;
}

/** "48 min", "5 h 20 min", "2 h". */
export function duration(min: number | null | undefined): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  if (!h) return `${m} min`;
  return m ? `${h} h ${m} min` : `${h} h`;
}

/** "Thursday at yours", "Saturday at Ravi’s". */
export function nightTitle(startsAt: Date, location: string, now = new Date(), tz = 0): string {
  const diff = startOfDay(startsAt, tz) - startOfDay(now, tz);
  const local = new Date(startsAt.getTime() + tz * 60000);
  const day = diff === 0 ? "Tonight" : diff === 1 ? "Tomorrow" : diff < 7 ? WEEKDAYS[local.getUTCDay()]! : `${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;
  return `${day} at ${location}`;
}

export function clockTime(d: Date, tz = 0): string {
  const local = new Date(d.getTime() + tz * 60000);
  const h = local.getUTCHours();
  return `${h % 12 || 12}:${String(local.getUTCMinutes()).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export function fmtScore(n: number | null | undefined): string {
  if (n === null || n === undefined) return "–";
  return Number.isInteger(n) ? n.toLocaleString("en-US") : n.toFixed(1);
}

export const possessive = (name: string) => (name.endsWith("s") ? `${name}’` : `${name}’s`);

/** Timezone offset in minutes east of UTC for an IANA zone at a moment. */
export function tzOffsetMinutes(timeZone: string, at = new Date()): number {
  try {
    const parts = new Intl.DateTimeFormat("en-US", { timeZone, hourCycle: "h23", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).formatToParts(at);
    const get = (t: string) => Number(parts.find((p) => p.type === t)?.value);
    const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"));
    return Math.round((asUtc - at.getTime()) / 60000);
  } catch {
    return 0;
  }
}
