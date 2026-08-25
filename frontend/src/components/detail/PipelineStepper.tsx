import type { TaskStatus } from '../../types';

const STEPS: { key: TaskStatus; label: string }[] = [
  { key: 'queued', label: '排队' },
  { key: 'parsing', label: '解析' },
  { key: 'extracting', label: '提取' },
  { key: 'pending_confirm', label: '确认' },
];

const ORDER: TaskStatus[] = ['queued', 'parsing', 'extracting', 'pending_confirm', 'sending', 'sent'];

function stepIndex(status: TaskStatus): number {
  if (status === 'failed') return -1;
  if (status === 'sending' || status === 'sent') return 3;
  return Math.max(0, ORDER.indexOf(status));
}

interface PipelineStepperProps {
  status: TaskStatus;
}

export function PipelineStepper({ status }: PipelineStepperProps) {
  const current = stepIndex(status);
  const failed = status === 'failed';

  return (
    <ol className="flex items-center gap-2" aria-label="管线进度">
      {STEPS.map((step, index) => {
        const done = !failed && current > index;
        const active = !failed && current === index && status !== 'sent';
        const confirmed = status === 'sent' && index === 3;
        return (
          <li key={step.key} className="flex items-center gap-2">
            <span
              className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-medium ${
                failed && index === Math.max(current, 0)
                  ? 'bg-red-100 text-red-700'
                  : done || confirmed
                    ? 'bg-brand text-white'
                    : active
                      ? 'bg-brand-soft text-brand ring-1 ring-brand/40'
                      : 'bg-canvas text-subtle'
              }`}
            >
              {index + 1}
            </span>
            <span
              className={`text-xs ${
                done || active || confirmed ? 'font-medium text-ink' : 'text-subtle'
              }`}
            >
              {step.label}
              {active && status !== 'pending_confirm' ? '中' : ''}
            </span>
            {index < STEPS.length - 1 && (
              <span className="h-px w-6 bg-line" aria-hidden="true" />
            )}
          </li>
        );
      })}
    </ol>
  );
}
