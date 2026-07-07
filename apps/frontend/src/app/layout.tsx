import type { Metadata, Viewport } from 'next';
import { Bricolage_Grotesque, Inter, JetBrains_Mono } from 'next/font/google';
import { AppProviders } from '@/providers/app-providers';
import { ContentGuard } from '@/components/system/content-guard';
import './globals.css';

const inter = Inter({ subsets: ['latin'], variable: '--font-sans' });
const mono = JetBrains_Mono({ subsets: ['latin'], variable: '--font-mono' });
const display = Bricolage_Grotesque({
  subsets: ['latin'],
  variable: '--font-display',
  weight: ['500', '700', '800'],
});

export const metadata: Metadata = {
  title: {
    default: 'TaskForge — Project management for modern teams',
    template: '%s · TaskForge',
  },
  description:
    'Plan, track, and ship work together. Kanban boards, sprints, time tracking, chat, and AI-powered planning in one workspace.',
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#FBF6EC',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={`${inter.variable} ${mono.variable} ${display.variable} font-sans`}>
        <ContentGuard />
        <AppProviders>{children}</AppProviders>
      </body>
    </html>
  );
}
