import { CheckIcon } from '@/components/ui/icons';

interface StepIndicatorProps {
  steps: string[];
  /** Zero-based index of the current step. */
  current: number;
}

/** Horizontal progress indicator for the booking wizard. Mobile-friendly. */
export function StepIndicator({ steps, current }: StepIndicatorProps) {
  return (
    <ol className="flex items-center gap-2" aria-label="Booking progress">
      {steps.map((label, index) => {
        const isComplete = index < current;
        const isCurrent = index === current;

        return (
          <li key={label} className="flex flex-1 items-center gap-2">
            <div className="flex items-center gap-2">
              <span
                className={[
                  'flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-sm font-semibold transition',
                  isComplete
                    ? 'border-brand-600 bg-brand-600 text-white'
                    : isCurrent
                      ? 'border-brand-600 bg-white text-brand-700'
                      : 'border-slate-300 bg-white text-slate-400',
                ].join(' ')}
                aria-current={isCurrent ? 'step' : undefined}
              >
                {isComplete ? <CheckIcon className="h-4 w-4" /> : index + 1}
              </span>
              {/* Label hidden on the smallest screens to save room. */}
              <span
                className={[
                  'hidden text-sm font-medium sm:inline',
                  isCurrent ? 'text-slate-900' : 'text-slate-500',
                ].join(' ')}
              >
                {label}
              </span>
            </div>
            {index < steps.length - 1 && (
              <span
                className={[
                  'h-px flex-1 transition',
                  isComplete ? 'bg-brand-600' : 'bg-slate-200',
                ].join(' ')}
                aria-hidden="true"
              />
            )}
          </li>
        );
      })}
    </ol>
  );
}
