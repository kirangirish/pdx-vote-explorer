export const VOTE_LABELS: Record<string, string> = {
  YEA: "Yea",
  NAY: "Nay",
  ABSENT: "Absent",
  ABSTAIN: "Abstain",
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
