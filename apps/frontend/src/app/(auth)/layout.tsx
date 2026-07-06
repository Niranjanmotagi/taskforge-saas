import Link from 'next/link';
import { Sparkles } from 'lucide-react';

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-10 text-white lg:flex">
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(800px circle at 20% 20%, hsl(243 75% 59% / 0.25), transparent 50%), radial-gradient(600px circle at 80% 80%, hsl(280 70% 50% / 0.15), transparent 50%)',
          }}
        />
        <Link href="/" className="relative z-10 flex items-center gap-2 font-semibold">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
            <Sparkles className="h-4 w-4" />
          </div>
          TaskForge
        </Link>
        <blockquote className="relative z-10 space-y-2">
          <p className="text-lg leading-relaxed">
            &ldquo;We replaced three tools with TaskForge. Planning happens in one place, and the
            burndown chart finally tells the truth.&rdquo;
          </p>
          <footer className="text-sm text-white/60">— A very satisfied engineering lead</footer>
        </blockquote>
      </div>

      {/* Form panel */}
      <div className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">{children}</div>
      </div>
    </div>
  );
}
