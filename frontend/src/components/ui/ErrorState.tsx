import { AlertTriangle } from 'lucide-react';

interface ErrorStateProps {
  message?: string;
  onRetry?: () => void;
}

export function ErrorState({ message = '加载失败，请稍后重试', onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg border border-red-100 bg-red-50">
        <AlertTriangle className="h-7 w-7 text-red-400" aria-hidden="true" />
      </div>
      <p className="text-sm font-medium text-red-700">{message}</p>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 rounded-md border border-line px-3 py-1.5 text-sm font-medium text-ink hover:bg-canvas"
        >
          重试
        </button>
      )}
    </div>
  );
}
