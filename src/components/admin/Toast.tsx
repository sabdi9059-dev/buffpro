import { useEffect } from 'react';
import { CheckIcon } from '@/components/ui/icons';

interface ToastProps {
  message: string;
  /** Called after the auto-dismiss timer fires. */
  onDismiss: () => void;
}

/** Fixed, auto-dismissing success toast (bottom-center). */
export function Toast({ message, onDismiss }: ToastProps) {
  useEffect(() => {
    const id = window.setTimeout(onDismiss, 2800);
    return () => window.clearTimeout(id);
  }, [onDismiss]);

  return (
    <div className="fixed inset-x-0 bottom-6 z-50 flex justify-center px-4">
      <div className="flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg">
        <CheckIcon className="h-4 w-4" />
        {message}
      </div>
    </div>
  );
}
