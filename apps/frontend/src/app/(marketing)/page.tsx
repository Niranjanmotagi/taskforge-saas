import Link from 'next/link';
import {
  ArrowRight,
  BarChart3,
  Bot,
  CalendarDays,
  CheckCircle2,
  Clock,
  KanbanSquare,
  MessageSquare,
  ShieldCheck,
  Sparkles,
  Zap,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

const FEATURES = [
  {
    icon: KanbanSquare,
    title: 'Kanban that keeps up',
    description: 'Drag-and-drop boards with custom columns, WIP limits, and instant sync across your whole team.',
  },
  {
    icon: Zap,
    title: 'Sprints & velocity',
    description: 'Plan sprints, watch burndown update live, and let velocity data drive your next commitment.',
  },
  {
    icon: Clock,
    title: 'Time tracking built in',
    description: 'One-click timers, billable rates, and reports that turn tracked hours into invoices.',
  },
  {
    icon: MessageSquare,
    title: 'Chat where work happens',
    description: 'Workspace, project, and task-level conversations with reactions, mentions, and read receipts.',
  },
  {
    icon: Bot,
    title: 'AI-assisted planning',
    description: 'Generate tasks from a feature brief, plan sprints, predict deadlines, and surface delivery risks.',
  },
  {
    icon: BarChart3,
    title: 'Reports leaders trust',
    description: 'Burndown, velocity, workload, and time analytics — always current, never exported to a spreadsheet.',
  },
];

const PLANS = [
  { name: 'Free', price: '$0', tagline: 'For small teams getting started', highlights: ['5 members', '3 projects', 'Kanban board', '1 GB storage'] },
  { name: 'Starter', price: '$9', tagline: 'For growing teams', highlights: ['15 members', '15 projects', 'Sprints & Gantt', 'Time tracking', '10 GB storage'] },
  { name: 'Professional', price: '$24', tagline: 'For serious product teams', highlights: ['50 members', 'Unlimited projects', 'AI features', 'Advanced reports', '100 GB storage'], featured: true },
  { name: 'Enterprise', price: '$99', tagline: 'For large organizations', highlights: ['Unlimited members', 'Audit logs', 'Dedicated support', '1 TB storage'] },
];

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background">
      {/* Nav */}
      <header className="sticky top-0 z-40 glass">
        <div className="container flex h-16 items-center justify-between">
          <Link href="/" className="flex items-center gap-2 font-semibold">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground">
              <Sparkles className="h-4 w-4" />
            </div>
            TaskForge
          </Link>
          <nav className="hidden items-center gap-6 text-sm text-muted-foreground md:flex">
            <a href="#features" className="hover:text-foreground transition-colors">Features</a>
            <a href="#pricing" className="hover:text-foreground transition-colors">Pricing</a>
          </nav>
          <div className="flex items-center gap-2">
            <Button variant="ghost" asChild>
              <Link href="/login">Sign in</Link>
            </Button>
            <Button asChild>
              <Link href="/register">
                Get started <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div
          className="pointer-events-none absolute inset-0 -z-10"
          style={{
            background:
              'radial-gradient(600px circle at 50% 0%, hsl(var(--primary) / 0.12), transparent 60%)',
          }}
        />
        <div className="container flex flex-col items-center py-24 text-center md:py-32">
          <Badge className="mb-6">
            <Sparkles className="h-3 w-3" /> AI-powered project management
          </Badge>
          <h1 className="max-w-3xl text-4xl font-bold tracking-tight md:text-6xl">
            Plan, track, and ship —{' '}
            <span className="bg-gradient-to-r from-indigo-500 via-violet-500 to-fuchsia-500 bg-clip-text text-transparent">
              together
            </span>
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            TaskForge unifies boards, sprints, time tracking, chat, and reporting into one fast,
            beautiful workspace your team will actually enjoy using.
          </p>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Button size="lg" asChild>
              <Link href="/register">
                Start free — no credit card <ArrowRight />
              </Link>
            </Button>
            <Button size="lg" variant="outline" asChild>
              <a href="#features">See what&apos;s inside</a>
            </Button>
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-muted-foreground">
            {['Unlimited tasks on every plan', 'Real-time collaboration', 'SOC2-ready audit trail'].map((t) => (
              <span key={t} className="flex items-center gap-1.5">
                <CheckCircle2 className="h-4 w-4 text-success" /> {t}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="border-t bg-sidebar/50 py-24">
        <div className="container">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Everything your team needs</h2>
            <p className="mt-3 text-muted-foreground">
              Replace four tools with one. TaskForge covers planning to delivery without the tab-switching tax.
            </p>
          </div>
          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map((feature) => (
              <div
                key={feature.title}
                className="group rounded-xl border bg-card p-6 shadow-card transition-shadow hover:shadow-popover"
              >
                <div className="mb-4 flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-110">
                  <feature.icon className="h-5 w-5" />
                </div>
                <h3 className="font-semibold">{feature.title}</h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-24">
        <div className="container">
          <div className="mx-auto mb-14 max-w-xl text-center">
            <h2 className="text-3xl font-bold tracking-tight">Simple, honest pricing</h2>
            <p className="mt-3 text-muted-foreground">Start free. Upgrade when your team outgrows it.</p>
          </div>
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
            {PLANS.map((plan) => (
              <div
                key={plan.name}
                className={`relative rounded-xl border bg-card p-6 shadow-card ${
                  plan.featured ? 'border-primary ring-1 ring-primary' : ''
                }`}
              >
                {plan.featured && (
                  <Badge className="absolute -top-2.5 left-1/2 -translate-x-1/2">Most popular</Badge>
                )}
                <h3 className="font-semibold">{plan.name}</h3>
                <div className="mt-2 flex items-baseline gap-1">
                  <span className="text-3xl font-bold">{plan.price}</span>
                  <span className="text-sm text-muted-foreground">/month</span>
                </div>
                <p className="mt-1 text-sm text-muted-foreground">{plan.tagline}</p>
                <ul className="mt-5 space-y-2 text-sm">
                  {plan.highlights.map((h) => (
                    <li key={h} className="flex items-center gap-2">
                      <CheckCircle2 className="h-4 w-4 shrink-0 text-success" /> {h}
                    </li>
                  ))}
                </ul>
                <Button className="mt-6 w-full" variant={plan.featured ? 'default' : 'outline'} asChild>
                  <Link href="/register">Get started</Link>
                </Button>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-10">
        <div className="container flex flex-col items-center justify-between gap-4 text-sm text-muted-foreground md:flex-row">
          <span className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4" /> TaskForge — built for teams that ship.
          </span>
          <div className="flex items-center gap-4">
            <CalendarDays className="h-4 w-4" />
            <span>© {new Date().getFullYear()} TaskForge Inc.</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
