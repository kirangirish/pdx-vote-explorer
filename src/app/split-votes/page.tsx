import { SplitVotes, type SplitSort } from "@/components/SplitVotes";

export const metadata = {
  title: "Split Votes — PDX Vote Explorer",
  description: "Portland City Council decisions where at least one member voted no.",
};

export default async function SplitVotesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort } = await searchParams;
  const order: SplitSort = sort === "recent" ? "recent" : "closest";
  return <SplitVotes governingBody="portland_council" category={category} sort={order} />;
}
