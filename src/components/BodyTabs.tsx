"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { GOVERNING_BODIES, type GoverningBody } from "@/lib/governing-body";

const TAB_ORDER: GoverningBody[] = ["portland_council", "multnomah_county"];

export function BodyTabs() {
  const pathname = usePathname();

  return (
    <div className="flex gap-1 bg-gray-100 rounded-full p-1">
      {TAB_ORDER.map((body) => {
        const config = GOVERNING_BODIES[body];
        const isActive = pathname === config.homeHref;
        return (
          <Link
            key={body}
            href={config.homeHref}
            className={
              isActive
                ? "px-4 py-1.5 rounded-full text-sm font-bold bg-pdx-blue text-white shadow-sm transition-all"
                : "px-4 py-1.5 rounded-full text-sm font-bold text-gray-500 hover:text-gray-900 hover:bg-gray-200/60 transition-all"
            }
          >
            {config.tabLabel}
          </Link>
        );
      })}
    </div>
  );
}
