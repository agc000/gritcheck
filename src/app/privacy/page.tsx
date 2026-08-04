import type { Metadata } from "next";
import Link from "next/link";
import { BrandLockup } from "@/components/BrandMark";

// Privacy note (§Phase 6). Every claim here was checked against the code
// before it was written — the update payload schema is `.strict()` and carries
// no location fields, and the Edge Function hashes the IP and discards it
// (supabase/functions/submit-update/index.ts). A privacy page that overclaims
// is worse than none, so if the data model changes, this changes with it.
//
// Plain language on purpose: a privacy note nobody can read protects nobody.
export const metadata: Metadata = {
  title: "Privacy — GritCheck",
  description:
    "What GritCheck stores: no accounts, no names, a random device ID, and updates you choose to send.",
};

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-6">
      <h2 className="text-sm font-extrabold">{title}</h2>
      <div className="mt-1.5 space-y-2 text-sm leading-relaxed text-muted">
        {children}
      </div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <main className="mx-auto w-full max-w-lg bg-sheet px-5 py-8 text-ink">
      <BrandLockup />

      <h1 className="mt-6 text-lg font-extrabold">What this app knows about you</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        Short version: there are no accounts, so GritCheck never learns your
        name, your email, or your student ID. It cannot, because it never asks.
      </p>

      <Section title="There is no account">
        <p>
          You do not sign up and you do not log in. Nothing you do here is tied
          to a real identity.
        </p>
      </Section>

      <Section title="A random ID on your device">
        <p>
          Your browser stores a random ID. It is a string of numbers and
          letters, made on your device, and it is not linked to you.
        </p>
        <p>
          It does two things: it stops one person from flooding a spot with
          fake reports, and it lets us count roughly how many people use the
          app. Clearing your browser storage erases it and makes a new one.
        </p>
      </Section>

      <Section title="What gets saved when you post an update">
        <p>
          The ratings you tap — how long the line is, how full it is, how loud
          it is, whether it was worth it — plus the spot and the time.
        </p>
        <p>
          If you write a comment, it is public and other students can see it.
          Do not put anything private in it.
        </p>
      </Section>

      <Section title="Your location never leaves your phone">
        <p>
          The app asks for your location in two places: when you sort by
          closest, and when you open the update screen so it can guess which
          spot you are at.
        </p>
        <p>
          That check happens on your device. Your coordinates are never sent to
          our server and never stored.
        </p>
      </Section>

      <Section title="Your IP address, and what happens to it">
        <p>
          When you send an update, our server sees your IP address, which is
          normal for any website. We scramble it into a code that cannot be
          turned back into the original, and we save only the code.
        </p>
        <p>
          It is used for one thing: stopping spam from someone who keeps
          clearing their browser storage to get a fresh ID. The real IP is
          thrown away.
        </p>
      </Section>

      <Section title="Basic usage counts">
        <p>
          We record simple events: the app was opened, a spot page was viewed,
          an update was sent, and whether you installed the app to your home
          screen. If you arrive from a QR code or a link, we record which one,
          so we know where people are finding us.
        </p>
        <p>Page views are counted by Vercel, who host the site.</p>
      </Section>

      <Section title="What we do not do">
        <p>
          No ads. We do not sell or share your data. There is no advertising
          tracker on this site.
        </p>
      </Section>

      <Section title="Who else holds this data">
        <p>
          The database runs on Supabase and the site runs on Vercel. Those two
          companies store the data described above on our behalf. Nobody else
          gets it.
        </p>
      </Section>

      <Section title="Getting something removed">
        <p>
          Because there are no accounts, we cannot look up “your” data — that
          is the point of the design, and it is also the limit of it. If you
          posted a comment you want gone, flag it in the app, or email{" "}
          <a href="mailto:hello@gritcheck.live" className="underline underline-offset-2">
            hello@gritcheck.live
          </a>{" "}
          with roughly when and where you posted it.
        </p>
      </Section>

      <footer className="mt-8 border-t border-line pt-4">
        <p className="text-[11px] leading-relaxed text-faint">
          GritCheck is an unofficial student project and is not affiliated
          with, endorsed by, or sponsored by UMBC.
        </p>
        {/* §4.8 tap target: standalone nav link, so it gets its 44px. */}
        <Link
          href="/"
          className="inline-flex min-h-11 items-center text-[11px] text-muted underline underline-offset-2"
        >
          Back to the map
        </Link>
      </footer>
    </main>
  );
}
