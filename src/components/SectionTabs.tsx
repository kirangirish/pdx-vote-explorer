"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GOVERNING_BODIES, type GoverningBody } from "@/lib/governing-body";

// Second-level navigation within one governing body. The header's BodyTabs
// switches City/County; this switches views of the selected body.
export function SectionTabs({ governingBody }: { governingBody: GoverningBody }) {
  const pathname = usePathname();
  const config = GOVERNING_BODIES[governingBody];
  const tabs = [
    { label: "Overview", href: config.homeHref },
    { label: "Split votes", href: config.splitVotesHref },
    { label: "All decisions", href: config.decisionsHref },
  ];

  return (
    <nav aria-label={`${config.fullName} views`} className="flex gap-1 border-b border-gray-200 overflow-x-auto">
      {tabs.map((tab) => {
        const isActive = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={isActive ? "page" : undefined}
            className={
              isActive
                ? "px-3 py-2 -mb-px border-b-2 border-pdx-blue text-sm font-bold text-gray-900 whitespace-nowrap"
                : "px-3 py-2 -mb-px border-b-2 border-transparent text-sm font-bold text-gray-500 hover:text-gray-900 hover:border-gray-300 whitespace-nowrap transition-colors"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
