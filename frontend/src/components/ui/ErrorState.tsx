import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = '加载失败，请稍后重试', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-red-50 border border-red-100">
        <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-xl border border-stone-200 px-4 py-2 text-sm font-medium text-slate-700 hover:bg-stone-50 focus:outline-none focus:ring-2 focus:ring-teal-500"
        >
          重试
        </button>
      )}
    </div>
  );
}
