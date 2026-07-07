import Link from 'next/link';
import { LogoMark } from '@/components/brand/logo';

const INK = '#161616';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel — matches the neo-brutalist marketing style */}
      <div
        className="relative hidden flex-col justify-between overflow-hidden border-r-2 bg-[#C9B2F5] p-10 lg:flex"
        style={{ borderColor: INK, color: INK }}
      >
        {/* decorative shapes */}
        <span
          className="absolute right-14 top-24 h-16 w-16 rotate-12 rounded-2xl border-2 bg-[#FFD43B]"
          style={{ borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}` }}
        />
        <span
          className="absolute bottom-40 right-24 h-10 w-10 -rotate-6 rounded-full border-2 bg-[#FF5FA2]"
          style={{ borderColor: INK, boxShadow: `3px 3px 0 0 ${INK}` }}
        />
        <span
          className="absolute bottom-24 left-1/2 h-8 w-8 rotate-45 border-2 bg-[#B9F0CB]"
          style={{ borderColor: INK, boxShadow: `3px 3px 0 0 ${INK}` }}
        />

        <Link href="/" className="relative z-10 inline-flex w-fit items-center gap-2 font-display text-lg font-extrabold">
          <LogoMark size={36} shadow />
          TaskForge
        </Link>

        <div className="relative z-10 max-w-md">
          <h2 className="font-display text-4xl font-extrabold leading-tight">
            plan. track.{' '}
            <span className="relative inline-block px-2">
              <span className="absolute inset-0 -rotate-1 rounded-lg bg-[#FFD43B]" />
              <span className="relative">ship it!</span>
            </span>
          </h2>
          <figure
            className="mt-8 -rotate-1 rounded-2xl border-2 bg-[#FFFDF6] p-5"
            style={{ borderColor: INK, boxShadow: `5px 5px 0 0 ${INK}` }}
          >
            <blockquote className="text-sm font-semibold leading-relaxed">
              &ldquo;We replaced three tools with TaskForge. Planning happens in one place, and the
              burndown chart finally tells the truth.&rdquo;
            </blockquote>
            <figcaption className="mt-3 border-t-2 pt-2 text-xs font-bold opacity-70" style={{ borderColor: INK }}>
              — a very satisfied engineering lead
            </figcaption>
          </figure>
        </div>

        <p className="relative z-10 text-xs font-bold opacity-60">
          © {new Date().getFullYear()} TaskForge Inc.
        </p>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
