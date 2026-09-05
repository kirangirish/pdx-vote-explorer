import Image from "next/image";
import Link from "next/link";

export type Member = {
  id: string;
  slug: string;
  fullName: string;
  district: number;
  governingBody: string;
  photoUrl: string | null;
};

export function initials(fullName: string) {
  return fullName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

// Tailwind needs each class string to appear literally in source -- can't
// build "ring-district-N" from a template string at runtime. District 0 is
// the at-large seat (Mayor/Chair), given its own gold accent rather than
// reusing a district color.
const RING_CLASSES: Record<number, string> = {
  0: "ring-pdx-yellow/40 hover:ring-pdx-yellow",
  1: "ring-district-1/30 hover:ring-district-1",
  2: "ring-district-2/30 hover:ring-district-2",
  3: "ring-district-3/30 hover:ring-district-3",
  4: "ring-district-4/30 hover:ring-district-4",
};

const FALLBACK_CLASSES: Record<number, string> = {
  0: "bg-pdx-yellow/15 text-yellow-700",
  1: "bg-district-1/10 text-district-1",
  2: "bg-district-2/10 text-district-2",
  3: "bg-district-3/10 text-district-3",
  4: "bg-district-4/10 text-district-4",
};

export function MemberAvatar({
  member,
  size = 96,
}: {
  member: Member;
  size?: number;
}) {
  const ringClass = RING_CLASSES[member.district] ?? RING_CLASSES[0];
  const fallbackClass = FALLBACK_CLASSES[member.district] ?? FALLBACK_CLASSES[0];

  return (
    <Link
      href={`/members/${member.slug}`}
      className={`group relative block rounded-full ring-2 transition-all duration-200 hover:scale-110 hover:-translate-y-0.5 ${ringClass}`}
      style={{ width: size, height: size }}
    >
      {member.photoUrl ? (
        <Image
          src={member.photoUrl}
          alt={member.fullName}
          width={size}
          height={size}
          priority
          className="w-full h-full rounded-full object-cover"
        />
      ) : (
        <div className={`w-full h-full rounded-full flex items-center justify-center font-bold ${fallbackClass}`}>
          {initials(member.fullName)}
        </div>
      )}
      <div className="absolute inset-0 rounded-full bg-black/70 opacity-0 group-hover:opacity-100 transition flex items-center justify-center text-center px-2">
        <span className="text-white text-[11px] font-semibold leading-tight">
          {member.fullName}
        </span>
      </div>
    </Link>
  );
}
