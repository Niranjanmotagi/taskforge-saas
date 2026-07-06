'use client';

import Link from 'next/link';
import { useParams, usePathname } from 'next/navigation';
import { Bell, Building2, CreditCard, MonitorSmartphone, Users } from 'lucide-react';
import { Topbar } from '@/components/shell/topbar';
import { cn } from '@/lib/utils';

const SECTIONS = [
  { label: 'General', segment: '', icon: Building2 },
  { label: 'Members', segment: 'members', icon: Users },
  { label: 'Billing', segment: 'billing', icon: CreditCard },
  { label: 'Notifications', segment: 'notifications', icon: Bell },
  { label: 'Sessions', segment: 'sessions', icon: MonitorSmartphone },
];

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const params = useParams<{ workspaceId: string }>();
  const base = `/w/${params.workspaceId}/settings`;

  return (
    <>
      <Topbar title="Settings" />
      <div className="flex min-h-0 flex-1">
        <nav className="w-52 shrink-0 space-y-0.5 border-r p-3">
          {SECTIONS.map((section) => {
            const href = section.segment ? `${base}/${section.segment}` : base;
            const active = section.segment ? pathname.startsWith(href) : pathname === base;
            return (
              <Link
                key={section.label}
                href={href}
                className={cn(
                  'flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm font-medium transition-colors',
                  active ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <section.icon className="h-4 w-4" />
                {section.label}
              </Link>
            );
          })}
        </nav>
        <div className="min-w-0 flex-1 overflow-y-auto p-6 scrollbar-thin">{children}</div>
      </div>
    </>
  );
}
