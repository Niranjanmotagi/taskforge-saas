import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  Check,
  Clock,
  KanbanSquare,
  MessageSquare,
  Star,
  Zap,
} from 'lucide-react';
import { LogoMark } from '@/components/brand/logo';

/**
 * Marketing landing page — playful neo-brutalist style:
 * cream canvas, chunky display type, 2px ink borders with hard offset
 * shadows, pastel section blocks, wavy dividers, sticker doodles.
 */

const INK = '#161616';

// ---------------------------------------------------------------------------
// Doodles & tiny building blocks
// ---------------------------------------------------------------------------

function StarDoodle({ className, fill = '#FFD43B' }: { className?: string; fill?: string }) {
  return (
    <svg viewBox="0 0 40 40" className={className} aria-hidden>
      <path
        d="M20 2l4.5 12.4L37 19l-12.5 4.6L20 36l-4.5-12.4L3 19l12.5-4.6L20 2z"
        fill={fill}
        stroke={INK}
        strokeWidth="2"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function SparkleDoodle({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden>
      <path
        d="M12 0l2 8 8 2-8 2-2 8-2-8-8-2 8-2 2-8z"
        fill={INK}
      />
    </svg>
  );
}

function SquiggleArrow({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 90 40" className={className} fill="none" aria-hidden>
      <path
        d="M4 30c18-22 34 14 52-8 8-10 16-12 28-8m0 0l-8-8m8 8l-10 4"
        stroke={INK}
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/** Wavy section divider; flip to point the wave down. */
function Wave({ fill, flip }: { fill: string; flip?: boolean }) {
  return (
    <svg
      viewBox="0 0 1440 56"
      preserveAspectRatio="none"
      className={`block h-10 w-full md:h-14 ${flip ? 'rotate-180' : ''}`}
      aria-hidden
    >
      <path
        d="M0 56V28C60 8 140 0 240 12s180 30 300 26 200-34 320-34 220 30 320 30 200-16 260-24v18z"
        fill={fill}
      />
    </svg>
  );
}

function BrutalButton({
  href,
  children,
  color = '#FFD43B',
  textColor = INK,
  className = '',
}: {
  href: string;
  children: React.ReactNode;
  color?: string;
  textColor?: string;
  className?: string;
}) {
  return (
    <Link
      href={href}
      className={`inline-flex items-center gap-2 rounded-full border-2 px-6 py-3 font-display text-sm font-bold transition-transform duration-150 hover:translate-x-[3px] hover:translate-y-[3px] hover:[box-shadow:none] ${className}`}
      style={{
        backgroundColor: color,
        color: textColor,
        borderColor: INK,
        boxShadow: `4px 4px 0 0 ${INK}`,
      }}
    >
      {children}
    </Link>
  );
}

function SectionTitle({ eyebrow, title }: { eyebrow?: string; title: React.ReactNode }) {
  return (
    <div className="mx-auto mb-12 max-w-2xl text-center">
      {eyebrow ? (
        <span
          className="mb-4 inline-block -rotate-2 rounded-full border-2 px-4 py-1 font-display text-xs font-bold uppercase tracking-wide"
          style={{ borderColor: INK, backgroundColor: '#fff', boxShadow: `3px 3px 0 0 ${INK}` }}
        >
          {eyebrow}
        </span>
      ) : null}
      <h2 className="font-display text-3xl font-extrabold leading-tight md:text-5xl" style={{ color: INK }}>
        {title}
      </h2>
    </div>
  );
}

/** Word with a pastel highlight pill behind it (Ruang Edit style). */
function Highlight({ children, color = '#FFD43B' }: { children: React.ReactNode; color?: string }) {
  return (
    <span className="relative inline-block whitespace-nowrap px-2">
      <span className="absolute inset-0 -rotate-1 rounded-lg" style={{ backgroundColor: color }} />
      <span className="relative">{children}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// Hero board mock (pure CSS "screenshot")
// ---------------------------------------------------------------------------

function MiniCard({ title, chip, chipColor, done }: { title: string; chip: string; chipColor: string; done?: boolean }) {
  return (
    <div className="rounded-lg border-2 bg-white p-2" style={{ borderColor: INK }}>
      <span
        className="mb-1 inline-block rounded-full border px-1.5 py-px text-[8px] font-bold"
        style={{ backgroundColor: chipColor, borderColor: INK }}
      >
        {chip}
      </span>
      <p className={`text-[10px] font-semibold leading-tight ${done ? 'line-through opacity-50' : ''}`} style={{ color: INK }}>
        {title}
      </p>
      <div className="mt-1.5 flex items-center justify-between">
        <div className="flex -space-x-1">
          <span className="h-3 w-3 rounded-full border bg-[#C9B2F5]" style={{ borderColor: INK }} />
          <span className="h-3 w-3 rounded-full border bg-[#FF9F68]" style={{ borderColor: INK }} />
        </div>
        {done ? <Check className="h-3 w-3 text-green-600" strokeWidth={4} /> : null}
      </div>
    </div>
  );
}

function BoardMock() {
  return (
    <div className="relative mx-auto w-full max-w-md">
      {/* main board card */}
      <div
        className="rotate-2 rounded-2xl border-2 bg-[#FFFDF6] p-4"
        style={{ borderColor: INK, boxShadow: `8px 8px 0 0 ${INK}` }}
      >
        <div className="mb-3 flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full border bg-[#FF5FA2]" style={{ borderColor: INK }} />
          <span className="h-2.5 w-2.5 rounded-full border bg-[#FFD43B]" style={{ borderColor: INK }} />
          <span className="h-2.5 w-2.5 rounded-full border bg-[#7ED9A2]" style={{ borderColor: INK }} />
          <span className="ml-2 font-display text-[10px] font-bold uppercase tracking-widest opacity-60" style={{ color: INK }}>
            website-redesign / board
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div className="space-y-2">
            <p className="font-display text-[9px] font-bold uppercase" style={{ color: INK }}>● Todo</p>
            <MiniCard title="Fix pricing table" chip="BUG" chipColor="#FFB3C7" />
            <MiniCard title="Analytics events" chip="LOW" chipColor="#D6E5FF" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-[9px] font-bold uppercase" style={{ color: INK }}>● Doing</p>
            <MiniCard title="New nav menu" chip="HIGH" chipColor="#FFD43B" />
            <MiniCard title="Blog to MDX" chip="FEAT" chipColor="#DCCBFF" />
          </div>
          <div className="space-y-2">
            <p className="font-display text-[9px] font-bold uppercase" style={{ color: INK }}>● Done</p>
            <MiniCard title="Content audit" chip="OK" chipColor="#B9F0CB" done />
          </div>
        </div>
      </div>

      {/* floating sprint sticker */}
      <div
        className="absolute -left-6 -top-5 -rotate-6 rounded-xl border-2 bg-[#C9B2F5] px-3 py-2 font-display text-xs font-bold"
        style={{ borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}`, color: INK }}
      >
        ⚡ Sprint 4 — 82% done
      </div>

      {/* floating timer sticker */}
      <div
        className="absolute -bottom-6 -right-3 rotate-3 rounded-xl border-2 bg-white px-3 py-2 font-mono text-xs font-bold"
        style={{ borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}`, color: INK }}
      >
        ⏱ 02:41:05 tracked
      </div>

      <StarDoodle className="absolute -right-8 -top-8 h-12 w-12 rotate-12" />
      <SparkleDoodle className="absolute -left-9 bottom-10 h-5 w-5" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Data
// ---------------------------------------------------------------------------

const STEPS = [
  {
    icon: KanbanSquare,
    panel: '#FFB3C7',
    rotate: '-rotate-1',
    title: 'Plan',
    body: 'Spin up a workspace, invite the crew, and break the work into boards, sprints, and tasks. Or let the AI generate the plan from a one-line brief.',
  },
  {
    icon: Zap,
    panel: '#FFD43B',
    rotate: 'rotate-1',
    title: 'Track',
    body: 'Drag cards, watch burndown update live, clock time with one tap. Everyone sees every move in real time — no refresh, no standup theatre.',
  },
  {
    icon: BarChart3,
    panel: '#C9B2F5',
    rotate: '-rotate-1',
    title: 'Ship',
    body: 'Velocity, workload, and billable-hours reports that are always current. Close the sprint, invoice the client, take the win.',
  },
];

const FEATURES = [
  { icon: KanbanSquare, color: '#FFB3C7', title: 'Kanban that keeps up', body: 'Custom columns, WIP limits, buttery drag-and-drop synced live to the whole team.' },
  { icon: Zap, color: '#FFD43B', title: 'Sprints & velocity', body: 'Plan sprints, watch the burndown breathe, commit with data instead of vibes.' },
  { icon: Clock, color: '#B9F0CB', title: 'Built-in time tracking', body: 'One-click timers, billable rates, and reports that turn hours into invoices.' },
  { icon: MessageSquare, color: '#D6E5FF', title: 'Chat where work lives', body: 'Workspace, project, and task threads with reactions, mentions, and receipts.' },
  { icon: Bot, color: '#DCCBFF', title: 'AI co-planner', body: 'Generate tasks from a brief, plan sprints, predict deadlines, flag delivery risks.' },
  { icon: BarChart3, color: '#FFD9B3', title: 'Reports leaders trust', body: 'Burndown, velocity, workload, and time analytics — always live, never exported.' },
];

const TESTIMONIALS = [
  {
    name: 'Winnie Okafor',
    role: 'Head of Product, Nimbus',
    color: '#FFD43B',
    rotate: '-rotate-1',
    quote: 'We replaced three tools with TaskForge. Planning happens in one place and the burndown chart finally tells the truth.',
  },
  {
    name: 'Marco Reyes',
    role: 'Agency owner, Studio MR',
    color: '#FFFDF6',
    rotate: 'rotate-1',
    quote: 'The billable-hours report pays for the subscription by itself. My invoices went out 2 weeks faster last month.',
  },
  {
    name: 'Priya Natarajan',
    role: 'Engineering lead, Loopway',
    color: '#DCCBFF',
    rotate: '-rotate-1',
    quote: 'The AI sprint planner is scary good. It reads our backlog and proposes a sprint I only have to nudge, not rebuild.',
  },
];

const PLANS = [
  { name: 'Free', price: '$0', tagline: 'For small teams getting started', color: '#FFFDF6', features: ['5 members', '3 projects', 'Kanban board', '1 GB storage'] },
  { name: 'Starter', price: '$9', tagline: 'For growing teams', color: '#D6E5FF', features: ['15 members', '15 projects', 'Sprints & Gantt', 'Time tracking', '10 GB storage'] },
  { name: 'Professional', price: '$24', tagline: 'For serious product teams', color: '#FFD43B', featured: true, features: ['50 members', 'Unlimited projects', 'AI features', 'Advanced reports', '100 GB storage'] },
  { name: 'Enterprise', price: '$99', tagline: 'For large organizations', color: '#DCCBFF', features: ['Unlimited members', 'Audit logs', 'Dedicated support', '1 TB storage'] },
];

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function LandingPage() {
  return (
    <div className="min-h-screen overflow-x-hidden bg-[#FBF6EC]" style={{ color: INK }}>
      {/* ── Nav (floating pill) ─────────────────────────────────────────── */}
      <header className="sticky top-4 z-50 px-4">
        <div
          className="mx-auto flex h-14 max-w-5xl items-center justify-between rounded-full border-2 bg-[#FFFDF6] pl-5 pr-2"
          style={{ borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}` }}
        >
          <Link href="/" className="flex items-center gap-2 font-display text-lg font-extrabold">
            <LogoMark size={34} />
            TaskForge
          </Link>
          <nav className="hidden items-center gap-6 font-display text-sm font-bold md:flex">
            <a href="#how" className="hover:underline hover:underline-offset-4">How it works</a>
            <a href="#features" className="hover:underline hover:underline-offset-4">Features</a>
            <a href="#pricing" className="hover:underline hover:underline-offset-4">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full border-2 bg-white px-4 py-2 font-display text-sm font-bold transition-colors hover:bg-[#FBF6EC] sm:inline-block"
              style={{ borderColor: INK }}
            >
              Log in
            </Link>
            <BrutalButton href="/register" className="!px-4 !py-2">
              Sign up
            </BrutalButton>
          </div>
        </div>
      </header>

      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className="relative overflow-hidden px-4 pb-20 pt-16 md:pt-24">
        <SparkleDoodle className="absolute left-[8%] top-16 h-6 w-6 opacity-80" />
        <StarDoodle className="absolute right-[6%] top-24 hidden h-10 w-10 -rotate-12 md:block" fill="#FF9F68" />
        <SparkleDoodle className="absolute bottom-10 left-[12%] hidden h-4 w-4 md:block" />

        <div className="mx-auto grid max-w-6xl items-center gap-14 lg:grid-cols-2">
          <div className="text-center lg:text-left">
            <span
              className="mb-6 inline-block -rotate-2 rounded-full border-2 bg-[#DCCBFF] px-4 py-1.5 font-display text-xs font-bold uppercase tracking-wide"
              style={{ borderColor: INK, boxShadow: `3px 3px 0 0 ${INK}` }}
            >
              ✦ project management… but fun
            </span>
            <h1 className="font-display text-5xl font-extrabold leading-[1.05] md:text-7xl">
              plan.
              <br />
              track.
              <br />
              <Highlight color="#FFD43B">ship it!</Highlight>
            </h1>
            <p className="mx-auto mt-6 max-w-md text-lg font-medium opacity-80 lg:mx-0">
              Boards, sprints, time tracking, chat, and an AI co-planner — one workspace your team
              will actually enjoy. No tab-switching tax.
            </p>
            <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row lg:justify-start sm:justify-center">
              <BrutalButton href="/register" color="#FF5FA2" textColor="#fff" className="!px-8 !py-4 !text-base">
                Start free <ArrowRight className="h-4 w-4" strokeWidth={3} />
              </BrutalButton>
              <div className="flex items-center gap-3">
                <SquiggleArrow className="hidden h-8 w-16 sm:block" />
                <span className="font-display text-sm font-bold opacity-70">no credit card</span>
              </div>
            </div>

            {/* rating chip */}
            <div
              className="mt-10 inline-flex rotate-1 items-center gap-3 rounded-2xl border-2 bg-white px-4 py-3"
              style={{ borderColor: INK, boxShadow: `4px 4px 0 0 ${INK}` }}
            >
              <div className="flex -space-x-2">
                {['#C9B2F5', '#FF9F68', '#7ED9A2', '#FFB3C7'].map((c) => (
                  <span key={c} className="h-7 w-7 rounded-full border-2" style={{ backgroundColor: c, borderColor: INK }} />
                ))}
              </div>
              <div className="text-left">
                <span className="flex items-center gap-1 font-display text-sm font-extrabold">
                  4.9 <Star className="h-3.5 w-3.5 fill-[#FFD43B]" style={{ color: INK }} />
                  <Star className="h-3.5 w-3.5 fill-[#FFD43B]" style={{ color: INK }} />
                  <Star className="h-3.5 w-3.5 fill-[#FFD43B]" style={{ color: INK }} />
                  <Star className="h-3.5 w-3.5 fill-[#FFD43B]" style={{ color: INK }} />
                  <Star className="h-3.5 w-3.5 fill-[#FFD43B]" style={{ color: INK }} />
                </span>
                <span className="text-xs font-semibold opacity-70">from teams that ship</span>
              </div>
            </div>
          </div>

          <BoardMock />
        </div>
      </section>

      {/* ── Stats bar ────────────────────────────────────────────────────── */}
      <section className="px-4 pb-6">
        <div
          className="mx-auto grid max-w-5xl grid-cols-2 divide-y-2 rounded-3xl border-2 bg-white text-center md:grid-cols-4 md:divide-x-2 md:divide-y-0"
          style={{ borderColor: INK, boxShadow: `6px 6px 0 0 ${INK}` }}
        >
          {[
            ['12k+', 'tasks shipped weekly'],
            ['4.9★', 'average team rating'],
            ['38%', 'faster sprint cycles'],
            ['1', 'tool instead of four'],
          ].map(([big, small]) => (
            <div key={small} className="px-4 py-6" style={{ borderColor: INK }}>
              <p className="font-display text-3xl font-extrabold">{big}</p>
              <p className="text-xs font-semibold uppercase tracking-wide opacity-60">{small}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── How it works (lavender block) ────────────────────────────────── */}
      <Wave fill="#C9B2F5" />
      <section id="how" className="bg-[#C9B2F5] px-4 py-20">
        <SectionTitle eyebrow="How it works" title={<>three steps. that&apos;s the whole trick.</>} />
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className={`${step.rotate} rounded-3xl border-2 bg-[#FFFDF6] p-5 transition-transform duration-200 hover:rotate-0 hover:scale-[1.02]`}
              style={{ borderColor: INK, boxShadow: `6px 6px 0 0 ${INK}` }}
            >
              <div
                className="mb-5 flex h-32 items-center justify-center rounded-2xl border-2"
                style={{ backgroundColor: step.panel, borderColor: INK }}
              >
                <step.icon className="h-12 w-12" strokeWidth={2.2} />
              </div>
              <p className="mb-1 font-display text-xs font-bold opacity-50">step {i + 1}</p>
              <h3 className="font-display text-2xl font-extrabold">{step.title}</h3>
              <p className="mt-2 text-sm font-medium leading-relaxed opacity-80">{step.body}</p>
            </div>
          ))}
        </div>
      </section>
      <Wave fill="#C9B2F5" flip />

      {/* ── Features bento ───────────────────────────────────────────────── */}
      <section id="features" className="px-4 py-20">
        <SectionTitle
          eyebrow="The toolbox"
          title={<>we&apos;ve got you… <Highlight color="#FFB3C7">everything</Highlight> included</>}
        />
        <div className="mx-auto grid max-w-5xl gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((feature) => (
            <div
              key={feature.title}
              className="group rounded-2xl border-2 bg-white p-5 transition-transform duration-150 hover:-translate-y-1"
              style={{ borderColor: INK, boxShadow: `5px 5px 0 0 ${INK}` }}
            >
              <div
                className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border-2 transition-transform group-hover:-rotate-12"
                style={{ backgroundColor: feature.color, borderColor: INK }}
              >
                <feature.icon className="h-5 w-5" strokeWidth={2.2} />
              </div>
              <h3 className="font-display text-lg font-extrabold">{feature.title}</h3>
              <p className="mt-1.5 text-sm font-medium leading-relaxed opacity-75">{feature.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ── Testimonials (yellow block) ──────────────────────────────────── */}
      <Wave fill="#FFD43B" />
      <section className="bg-[#FFD43B] px-4 py-20">
        <SectionTitle eyebrow="Word on the street" title="teams kinda love it" />
        <div className="mx-auto grid max-w-5xl gap-8 md:grid-cols-3">
          {TESTIMONIALS.map((t) => (
            <figure
              key={t.name}
              className={`${t.rotate} rounded-3xl border-2 p-6 transition-transform duration-200 hover:rotate-0`}
              style={{ backgroundColor: t.color, borderColor: INK, boxShadow: `6px 6px 0 0 ${INK}` }}
            >
              <div className="mb-3 flex gap-0.5">
                {Array.from({ length: 5 }).map((_, i) => (
                  <Star key={i} className="h-4 w-4 fill-current" />
                ))}
              </div>
              <blockquote className="text-sm font-semibold leading-relaxed">&ldquo;{t.quote}&rdquo;</blockquote>
              <figcaption className="mt-4 border-t-2 pt-3" style={{ borderColor: INK }}>
                <p className="font-display text-sm font-extrabold">{t.name}</p>
                <p className="text-xs font-semibold opacity-70">{t.role}</p>
              </figcaption>
            </figure>
          ))}
        </div>
      </section>
      <Wave fill="#FFD43B" flip />

      {/* ── Pricing ──────────────────────────────────────────────────────── */}
      <section id="pricing" className="px-4 py-20">
        <SectionTitle
          eyebrow="Pricing"
          title={<>simple, honest, <Highlight color="#B9F0CB">flat</Highlight> pricing</>}
        />
        <div className="mx-auto grid max-w-6xl gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-3xl border-2 p-6 ${plan.featured ? '-rotate-1 lg:scale-105' : ''}`}
              style={{
                backgroundColor: plan.color,
                borderColor: INK,
                boxShadow: plan.featured ? `8px 8px 0 0 ${INK}` : `5px 5px 0 0 ${INK}`,
              }}
            >
              {plan.featured && (
                <span
                  className="absolute -top-4 right-4 rotate-6 rounded-full border-2 bg-[#FF5FA2] px-3 py-1 font-display text-[10px] font-extrabold uppercase text-white"
                  style={{ borderColor: INK, boxShadow: `2px 2px 0 0 ${INK}` }}
                >
                  most popular
                </span>
              )}
              <h3 className="font-display text-lg font-extrabold">{plan.name}</h3>
              <p className="mt-0.5 text-xs font-semibold opacity-70">{plan.tagline}</p>
              <p className="mt-4">
                <span className="font-display text-4xl font-extrabold">{plan.price}</span>
                <span className="text-sm font-bold opacity-60">/mo</span>
              </p>
              <ul className="mt-5 space-y-2">
                {plan.features.map((f) => (
                  <li key={f} className="flex items-center gap-2 text-sm font-semibold">
                    <span
                      className="flex h-4 w-4 items-center justify-center rounded-full border-2 bg-white"
                      style={{ borderColor: INK }}
                    >
                      <Check className="h-2.5 w-2.5" strokeWidth={4} />
                    </span>
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href="/register"
                className="mt-6 block rounded-full border-2 py-2.5 text-center font-display text-sm font-extrabold transition-transform duration-150 hover:translate-x-[2px] hover:translate-y-[2px] hover:[box-shadow:none]"
                style={{
                  backgroundColor: plan.featured ? INK : '#fff',
                  color: plan.featured ? '#fff' : INK,
                  borderColor: INK,
                  boxShadow: `3px 3px 0 0 ${INK}`,
                }}
              >
                Get started
              </Link>
            </div>
          ))}
        </div>
      </section>

      {/* ── Big CTA ──────────────────────────────────────────────────────── */}
      <section className="px-4 pb-24">
        <div
          className="relative mx-auto max-w-5xl overflow-hidden rounded-[2.5rem] border-2 bg-[#161616] px-6 py-16 text-center"
          style={{ borderColor: INK, boxShadow: `8px 8px 0 0 #C9B2F5` }}
        >
          <StarDoodle className="absolute left-8 top-8 h-10 w-10 -rotate-12" fill="#FF5FA2" />
          <StarDoodle className="absolute bottom-8 right-10 h-8 w-8 rotate-12" />
          <SparkleDoodle className="absolute right-1/4 top-10 h-5 w-5 [&_path]:fill-[#FFD43B]" />
          <h2 className="font-display text-4xl font-extrabold leading-tight text-[#FBF6EC] md:text-6xl">
            ready to <Highlight color="#FF5FA2">ship</Highlight> faster?
          </h2>
          <p className="mx-auto mt-4 max-w-md font-medium text-[#FBF6EC]/70">
            Free for small teams. Set up your workspace in under a minute — your backlog will never
            know what hit it.
          </p>
          <div className="mt-8">
            <BrutalButton href="/register" className="!px-10 !py-4 !text-base" color="#FFD43B">
              Create your workspace <ArrowRight className="h-4 w-4" strokeWidth={3} />
            </BrutalButton>
          </div>
        </div>
      </section>

      {/* ── Footer ───────────────────────────────────────────────────────── */}
      <footer className="border-t-2 bg-[#161616] px-4 py-10 text-[#FBF6EC]" style={{ borderColor: INK }}>
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-4 md:flex-row">
          <span className="flex items-center gap-2 font-display font-extrabold">
            <LogoMark size={28} />
            TaskForge
          </span>
          <nav className="flex items-center gap-5 text-sm font-semibold text-[#FBF6EC]/70">
            <a href="#how" className="hover:text-[#FFD43B]">How it works</a>
            <a href="#features" className="hover:text-[#FFD43B]">Features</a>
            <a href="#pricing" className="hover:text-[#FFD43B]">Pricing</a>
            <Link href="/login" className="hover:text-[#FFD43B]">Log in</Link>
          </nav>
          <span className="text-xs text-[#FBF6EC]/50">© {new Date().getFullYear()} TaskForge Inc. Built for teams that ship.</span>
        </div>
      </footer>
    </div>
  );
}
