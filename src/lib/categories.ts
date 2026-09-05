// Matches the fixed taxonomy in scraper/enrich.py exactly. Tailwind needs
// each class string to appear literally in source -- can't build these
// from a template string at runtime.
//
// Deliberately not the literal cliché mapping (brown for housing, gray for
// contracts, dull green for parks) -- picked for maximum variety and pop
// across the color wheel instead, at a 600 depth that stays vivid while
// still holding contrast as text on its own pale tint.
export const CATEGORY_STYLES: Record<string, string> = {
  "Housing & Development": "bg-pink-600/10 text-pink-600",
  "Transportation & Infrastructure": "bg-sky-600/10 text-sky-600",
  "Budget & Finance": "bg-amber-600/10 text-amber-600",
  "Public Safety": "bg-red-600/10 text-red-600",
  "Parks & Environment": "bg-lime-600/10 text-lime-600",
  "Contracts & Procurement": "bg-violet-600/10 text-violet-600",
  "Government Operations": "bg-fuchsia-600/10 text-fuchsia-600",
  Other: "bg-cyan-600/10 text-cyan-600",
};

export const DEFAULT_CATEGORY_STYLE = "bg-pdx-green/10 text-pdx-green";

export function categoryStyle(tag: string): string {
  return CATEGORY_STYLES[tag] ?? DEFAULT_CATEGORY_STYLE;
}
