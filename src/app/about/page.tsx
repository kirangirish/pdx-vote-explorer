import Link from "next/link";
import { ArrowLeft, Sparkles, Megaphone, Landmark, Unlock } from "lucide-react";

export const metadata = {
  title: "Our Ethos — PDX Vote Explorer",
  description: "Why this project exists and the principles it runs on.",
};

const PRINCIPLES = [
  {
    icon: Sparkles,
    accent: "text-pdx-blue bg-pdx-blue/10",
    title: "AI, used honestly",
    body: "We use AI to translate dense legal language into plain English — not to spin it. Every AI-generated summary is clearly labeled as such and links straight back to the actual government record, so you never have to just take our word for it. The model is instructed to describe what changed and who voted how, and nothing more: no characterizing a vote as good, bad, or controversial. That line matters most right before a contested election, which is exactly when a tool like this gets used the most.",
  },
  {
    icon: Megaphone,
    accent: "text-district-2 bg-district-2/10",
    title: "Transparency is how we support good government",
    body: "This isn't about \"gotcha\" journalism. When residents can actually see how their representatives vote — not buried in a scraped table or a 140-page meeting transcript — everyone benefits. Elected officials do their best work when they know their constituents are paying attention and can see their record accurately represented. Residents can only hold up their end of that relationship if the information is actually available to them. We built this to be part of that support system, not to score points against anyone.",
  },
  {
    icon: Landmark,
    accent: "text-district-3 bg-district-3/10",
    title: "Governments should be building this themselves",
    body: "Frankly, this project shouldn't need to exist. Every vote here started life as a scraped HTML table or a giant PDF meeting transcript, because that is genuinely the best public access currently on offer. City and county governments should be publishing real, structured, queryable open data as part of the public record — not something a volunteer has to reverse-engineer from a legacy meeting portal. Until that happens, we'll keep maintaining this ourselves.",
  },
  {
    icon: Unlock,
    accent: "text-district-4 bg-district-4/10",
    title: "Free, always — no paywall, ever",
    body: "Civic data is a public good. Knowing how your own representatives voted should never cost money or require an account. Nothing on this site will ever go behind a paywall or a login wall. If maintaining this costs us something, that's a cost we bear — not one we pass on to the people this is supposed to serve.",
  },
];

export default function AboutPage() {
  return (
    <div className="space-y-8 max-w-3xl mx-auto">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm font-semibold text-pdx-blue hover:gap-2.5 transition-all">
        <ArrowLeft size={15} />
        Back to dashboard
      </Link>

      <div>
        <h1 className="text-3xl font-black tracking-tight text-gray-900 mb-3">Our Ethos</h1>
        <p className="text-lg text-gray-700 leading-relaxed">
          PDX Vote Explorer exists to make it easy for residents to see how their elected officials
          actually vote — in plain language, for free, sourced back to the real record every time.
          Here's what that actually means in practice.
        </p>
      </div>

      <div className="space-y-5">
        {PRINCIPLES.map(({ icon: Icon, accent, title, body }) => (
          <section key={title} className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
            <div className="flex items-center gap-3 mb-3">
              <div className={`shrink-0 w-10 h-10 rounded-full flex items-center justify-center ${accent}`}>
                <Icon size={18} />
              </div>
              <h2 className="text-lg font-black tracking-tight text-gray-900">{title}</h2>
            </div>
            <p className="text-gray-700 leading-relaxed">{body}</p>
          </section>
        ))}
      </div>
    </div>
  );
}
