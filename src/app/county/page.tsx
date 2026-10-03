import { Dashboard } from "@/components/Dashboard";

// Re-query the database at most hourly so newly scraped votes show up
// without a redeploy.
export const revalidate = 3600;

export default function CountyHome() {
  return <Dashboard governingBody="multnomah_county" />;
}
