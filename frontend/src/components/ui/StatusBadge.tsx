import type { TaskStatus } from '../../types';
import { STATUS_META } from '../../lib/status';
import { Loader2 } from 'lucide-react';

const COLOR_CLASSES: Record<string, string> = {
  slate: 'bg-slate-100 text-slate-700',
  teal: 'bg-teal-50 text-teal-700 border border-teal-100',
  amber: 'bg-amber-100 text-amber-700',
  green: 'bg-green-100 text-green-700',
  red: 'bg-red-100 text-red-700',
};

interface StatusBadgeProps {
  status: TaskStatus;
}

export function StatusBadge({ status }: StatusBadgeProps) {
  const meta = STATUS_META[status];
  const colorClass = COLOR_CLASSES[meta.color] ?? COLOR_CLASSES.slate;

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${colorClass}`}
      aria-label={`状态：${meta.label}`}
    >
      {meta.spinning && (
        <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
      )}
      {meta.label}
    </span>
  );
}
