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

export function MemberAvatar({
  member,
  size = 96,
}: {
  member: Member;
  size?: number;
}) {
  return (
    <Link
      href={`/members/${member.slug}`}
      className="group relative block rounded-full ring-2 ring-transparent hover:ring-pdx-green transition"
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
        <div className="w-full h-full rounded-full bg-pdx-blue/10 text-pdx-blue flex items-center justify-center font-semibold">
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
