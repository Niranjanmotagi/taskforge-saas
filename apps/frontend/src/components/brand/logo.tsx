import { cn } from '@/lib/utils';

const INK = '#161616';
const YELLOW = '#FFD43B';

/**
 * TaskForge logo mark — a bold checkmark (tasks) with a spark (the "forge"),
 * on a chunky rounded tile with the brand's ink border. High-contrast, so it
 * reads on light and dark surfaces without theming.
 */
export function LogoMark({
  size = 32,
  shadow = false,
  className,
  title = 'TaskForge',
}: {
  size?: number;
  /** Hard offset shadow for the neo-brutalist "sticker" look. */
  shadow?: boolean;
  className?: string;
  title?: string;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 96 96"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={className}
    >
      {shadow && <rect x="14" y="14" width="76" height="76" rx="21" fill={INK} />}
      <rect x="6" y="6" width="76" height="76" rx="21" fill={YELLOW} stroke={INK} strokeWidth="5" />
      {/* checkmark = task done */}
      <path
        d="M26 46 L40 60 L64 32"
        stroke={INK}
        strokeWidth="9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* spark = forge / a little magic */}
      <path
        d="M68 14 L71.4 21.6 L79 25 L71.4 28.4 L68 36 L64.6 28.4 L57 25 L64.6 21.6 Z"
        fill={INK}
      />
    </svg>
  );
}

/**
 * Full logo lockup: mark + "TaskForge" wordmark in the display font.
 */
export function Logo({
  size = 28,
  shadow = false,
  className,
  wordClassName,
}: {
  size?: number;
  shadow?: boolean;
  className?: string;
  wordClassName?: string;
}) {
  return (
    <span className={cn('inline-flex items-center gap-2', className)}>
      <LogoMark size={size} shadow={shadow} />
      <span className={cn('font-display text-lg font-extrabold tracking-tight', wordClassName)}>
        TaskForge
      </span>
    </span>
  );
}
