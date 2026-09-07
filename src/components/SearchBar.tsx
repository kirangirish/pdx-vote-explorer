"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { Search, FileText } from "lucide-react";
import { GOVERNING_BODIES, type GoverningBody } from "@/lib/governing-body";
import { initials } from "@/components/MemberAvatar";

type MemberResult = {
  slug: string;
  fullName: string;
  photoUrl: string | null;
  district: number;
  governingBody: GoverningBody;
};

type DocumentResult = {
  docNumber: string;
  title: string;
  aiHeadline: string | null;
  governingBody: GoverningBody;
};

export function SearchBar() {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<MemberResult[]>([]);
  const [documents, setDocuments] = useState<DocumentResult[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (query.trim().length < 2) {
      setMembers([]);
      setDocuments([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const timeout = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}`);
        const data = await res.json();
        setMembers(data.members ?? []);
        setDocuments(data.documents ?? []);
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => clearTimeout(timeout);
  }, [query]);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function goTo(href: string) {
    setOpen(false);
    setQuery("");
    router.push(href);
  }

  const hasResults = members.length > 0 || documents.length > 0;
  const showDropdown = open && query.trim().length >= 2;

  return (
    <div ref={containerRef} className="relative w-full sm:w-auto order-3 sm:order-none">
      <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
      <input
        type="text"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onFocus={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Escape") setOpen(false);
          if (e.key === "Enter") {
            const first = members[0]
              ? { href: `/members/${members[0].slug}` }
              : documents[0]
                ? { href: `/documents/${documents[0].docNumber}` }
                : null;
            if (first) goTo(first.href);
          }
        }}
        placeholder="Search issues, votes, members..."
        className="border border-gray-300 rounded-full pl-9 pr-4 py-1.5 text-sm w-full sm:w-64 focus:outline-none focus:ring-2 focus:ring-pdx-blue/30 focus:border-pdx-blue transition"
      />

      {showDropdown && (
        <div className="absolute right-0 mt-2 w-full sm:w-96 max-h-[28rem] overflow-y-auto bg-white rounded-2xl shadow-lg border border-gray-100 z-50">
          {loading && (
            <p className="px-4 py-3 text-sm text-gray-400">Searching…</p>
          )}
          {!loading && !hasResults && (
            <p className="px-4 py-3 text-sm text-gray-400">No matches for &ldquo;{query}&rdquo;.</p>
          )}
          {!loading && members.length > 0 && (
            <div className="py-2">
              <p className="px-4 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Members</p>
              {members.map((m) => (
                <button
                  key={m.slug}
                  onClick={() => goTo(`/members/${m.slug}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition text-left"
                >
                  {m.photoUrl ? (
                    <Image src={m.photoUrl} alt="" width={32} height={32} className="rounded-full object-cover w-8 h-8 shrink-0" />
                  ) : (
                    <div className="w-8 h-8 rounded-full bg-pdx-blue/10 text-pdx-blue flex items-center justify-center text-xs font-bold shrink-0">
                      {initials(m.fullName)}
                    </div>
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{m.fullName}</p>
                    <p className="text-xs text-gray-500">
                      {GOVERNING_BODIES[m.governingBody].tabLabel} &middot; {m.district === 0 ? GOVERNING_BODIES[m.governingBody].atLargeTitle : `District ${m.district}`}
                    </p>
                  </div>
                </button>
              ))}
            </div>
          )}
          {!loading && documents.length > 0 && (
            <div className="py-2 border-t border-gray-100">
              <p className="px-4 py-1 text-[11px] font-bold text-gray-400 uppercase tracking-wider">Documents</p>
              {documents.map((d) => (
                <button
                  key={d.docNumber}
                  onClick={() => goTo(`/documents/${d.docNumber}`)}
                  className="w-full flex items-center gap-3 px-4 py-2 hover:bg-gray-50 transition text-left"
                >
                  <div className="w-8 h-8 rounded-full bg-pdx-green/10 text-pdx-green flex items-center justify-center shrink-0">
                    <FileText size={14} />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-gray-900 truncate">{d.aiHeadline || d.title}</p>
                    <p className="text-xs text-gray-500">{GOVERNING_BODIES[d.governingBody].tabLabel}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
