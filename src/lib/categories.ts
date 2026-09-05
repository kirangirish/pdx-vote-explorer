// Matches the fixed taxonomy in scraper/enrich.py exactly. Tailwind needs
// each class string to appear literally in source -- can't build these
// from a template string at runtime.
export const CATEGORY_STYLES: Record<string, string> = {
  "Housing & Development": "bg-amber-700/10 text-amber-700",
  "Transportation & Infrastructure": "bg-blue-700/10 text-blue-700",
  "Budget & Finance": "bg-green-700/10 text-green-700",
  "Public Safety": "bg-red-700/10 text-red-700",
  "Parks & Environment": "bg-lime-700/10 text-lime-700",
  "Contracts & Procurement": "bg-slate-700/10 text-slate-700",
  "Government Operations": "bg-violet-700/10 text-violet-700",
  Other: "bg-stone-600/10 text-stone-600",
};

export const DEFAULT_CATEGORY_STYLE = "bg-pdx-green/10 text-pdx-green";

export function categoryStyle(tag: string): string {
  return CATEGORY_STYLES[tag] ?? DEFAULT_CATEGORY_STYLE;
}
