import type { TaskStatus } from '../../types';
import { STATUS_META } from '../../lib/status';
import { Loader2 } from 'lucide-react';

const COLOR_CLASSES: Record<string, string> = {
  slate: 'bg-canvas text-muted',
  brand: 'bg-brand-soft text-brand',
  amber: 'bg-amber-50 text-amber-700',
  green: 'bg-emerald-50 text-emerald-700',
  red: 'bg-red-50 text-red-600',
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  const colorClass = COLOR_CLASSES[meta.color] ?? COLOR_CLASSES.slate;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-medium ${colorClass}`}
      aria-label={`状态：${meta.label}`}
    >
      {meta.spinning && (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
}
