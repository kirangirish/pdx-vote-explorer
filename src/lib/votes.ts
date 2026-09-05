import { Check, X, Clock, MinusCircle, type LucideIcon } from "lucide-react";

export const VOTE_LABELS: Record<string, string> = {
  YEA: "Yea",
  NAY: "Nay",
  ABSENT: "Absent",
  ABSTAIN: "Abstain",
};

export const VOTE_ICONS: Record<string, LucideIcon> = {
  YEA: Check,
  NAY: X,
  ABSENT: Clock,
  ABSTAIN: MinusCircle,
};

export const VOTE_ORDER = ["YEA", "NAY", "ABSENT", "ABSTAIN"];

// Tailwind needs each class string to appear literally in source to generate
// it -- can't build these from a template string at runtime.
export const VOTE_BADGE_STYLES: Record<string, string> = {
  YEA: "bg-yea/10 text-yea",
  NAY: "bg-nay/10 text-nay",
  ABSENT: "bg-absent/10 text-absent",
  ABSTAIN: "bg-abstain/10 text-abstain",
};

// Solid/high-contrast variant for an active filter selection.
export const VOTE_BADGE_STYLES_ACTIVE: Record<string, string> = {
  YEA: "bg-yea text-white",
  NAY: "bg-nay text-white",
  ABSENT: "bg-absent text-white",
  ABSTAIN: "bg-abstain text-white",
};

export function parseCategoryTags(categoryTags: string | null): string[] {
  return categoryTags
    ? categoryTags.split(",").map((tag) => tag.trim()).filter(Boolean)
    : [];
}

export function formatVoteDate(date: Date | string): string {
  return new Date(date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
    timeZone: "UTC",
  });
}

// A real AI headline (aiHeadline) is always preferred -- this only runs on
// the raw scraped title while a document is waiting on AI enrichment (see
// scraper/PLAN.md Phase 4). Strips procedural/bureaucratic boilerplate that
// means nothing to a resident -- document-type labels, internal budget
// codes, "First/Second Reading" framing -- so the fallback at least states
// the actual subject instead of e.g. "BUDGET MODIFICATION #DCJ-002-27 - ".
// Not a substitute for a real headline: no attempt at plain-language
// rewriting or a character limit, just noise removal.
const FALLBACK_TITLE_PREFIXES = [
  /^\*\s*/, // Portland's emergency-ordinance marker
  /^BUDGET MODIFICATION\s*#?\s*[\w-]+\s*[:\-]\s*/i,
  /^RESOLUTION\s*:?\s*-?\s*/i,
  /^(?:Public Hearing and (?:First|Second) Reading of|(?:First|Second) Reading and Public Hearing of)\s+/i,
];

export function humanizeFallbackTitle(title: string): string {
  let result = title;
  let changed = true;
  while (changed) {
    changed = false;
    for (const prefix of FALLBACK_TITLE_PREFIXES) {
      const stripped = result.replace(prefix, "");
      if (stripped !== result) {
        result = stripped;
        changed = true;
      }
    }
  }
  return result.trim() || title;
}
