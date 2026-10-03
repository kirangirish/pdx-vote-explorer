import { SplitVotes, type SplitSort } from "@/components/SplitVotes";

export const metadata = {
  title: "Split Votes — PDX Vote Explorer",
  description: "Multnomah County Board decisions where at least one member voted no.",
};

export default async function CountySplitVotesPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string; sort?: string }>;
}) {
  const { category, sort } = await searchParams;
  const order: SplitSort = sort === "recent" ? "recent" : "closest";
  return <SplitVotes governingBody="multnomah_county" category={category} sort={order} />;
}
