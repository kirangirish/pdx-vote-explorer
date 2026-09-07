import Link from "next/link";
import { ArrowLeft, Landmark, ExternalLink } from "lucide-react";
import { GOVERNING_BODIES } from "@/lib/governing-body";

export const metadata = {
  title: "How It Works — PDX Vote Explorer",
  description: "A quick explainer on how Portland and Multnomah County elections and government are structured.",
};

const SECTIONS = [
  {
    body: "portland_council" as const,
    accent: "text-pdx-blue bg-pdx-blue/10",
    points: [
      "Portland's government was overhauled by a 2022 charter reform that took effect with the November 2024 election.",
      "12 councilors are elected from 4 geographic districts — 3 seats per district — using ranked-choice voting (single transferable vote), so each district sends a small team rather than one representative.",
      "The Mayor is elected citywide, also by ranked-choice voting, and runs the city's day-to-day administration. The Mayor is not a voting member of Council except to break a tie on non-emergency ordinances.",
      "Councilors and the Mayor serve 4-year terms.",
    ],
  },
  {
    body: "multnomah_county" as const,
    accent: "text-district-2 bg-district-2/10",
    points: [
      "Multnomah County is governed under a Home Rule Charter, first adopted in 1967 and revisited by a citizen review committee every six years.",
      "The Board of County Commissioners has 5 members: a Chair elected countywide and 4 Commissioners, each elected from one of 4 single-member districts.",
      "County elections are nonpartisan. The Chair acts as the county's chief executive and presides over Board meetings.",
      "The Chair and Commissioners serve 4-year terms.",
    ],
  },
];

export default function HowItWorksPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pdx-blue hover:gap-2.5 transition-all">
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-black tracking-tight text-gray-900 mb-3">How It Works</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          A quick rundown of how each government is elected and structured — with a link to the real charter if you
          want the full legal text.
        </p>
      </div>

      <div className="space-y-5">
        {SECTIONS.map(({ body, accent, points }) => {
          const config = GOVERNING_BODIES[body];
          return (
            <section key={body} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
              <div className="flex items-center gap-3 mb-4">
                <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>
                  <Landmark size={18} />
                </div>
                <h2 className="text-lg font-black tracking-tight text-gray-900">{config.fullName}</h2>
              </div>
              <ul className="space-y-2.5 text-gray-700 leading-relaxed list-disc list-outside pl-5">
                {points.map((point) => (
                  <li key={point}>{point}</li>
                ))}
              </ul>
              <a
                href={config.charterUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 mt-4 text-sm font-semibold text-pdx-blue hover:underline"
              >
                Read the {config.charterLabel}
                <ExternalLink size={13} />
              </a>
            </section>
          );
        })}
      </div>
    </div>
  );
}
