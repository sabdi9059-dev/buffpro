import { useEffect, useRef, useState } from 'react';
import { completeJob, toMessage, uploadJobPhoto } from '@/lib/techApi';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon, CheckIcon, XIcon } from '@/components/ui/icons';
import type { TechJob } from '@/types/tech';

interface CompleteJobModalProps {
  businessId: string;
  job: TechJob;
  onCancel: () => void;
  /** Called after the job is successfully marked complete. */
  onCompleted: () => void;
}

const ACCEPTED = ['image/jpeg', 'image/png'];
const MAX_BYTES = 5 * 1024 * 1024; // 5MB

/**
 * "Complete job" flow: optional after-photo (jpeg/png ≤ 5MB) with live preview,
 * optional notes, and a customer-approval checkbox. On confirm we upload the
 * photo (if any) to Storage, then flip the booking to `completed`.
 */
export function CompleteJobModal({ businessId, job, onCancel, onCompleted }: CompleteJobModalProps) {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [approved, setApproved] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Build + tear down the object URL used for the preview.
  useEffect(() => {
    if (!file) {
      setPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const onPickFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const picked = e.target.files?.[0];
    if (!picked) return;
    if (!ACCEPTED.includes(picked.type)) {
      setError('Please choose a JPEG or PNG image.');
      return;
    }
    if (picked.size > MAX_BYTES) {
      setError('Image is larger than 5MB. Please pick a smaller one.');
      return;
    }
    setFile(picked);
  };

  const submit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      let photoPath: string | null = null;
      if (file) photoPath = await uploadJobPhoto(job.job_id, file);
      await completeJob(businessId, job.job_id, {
        notes,
        photoPath,
        customerApproved: approved,
      });
      onCompleted();
    } catch (err) {
      setError(toMessage(err, 'Could not complete the job. Please try again.'));
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={submitting ? undefined : onCancel}
    >
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-t-2xl bg-white p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl sm:rounded-2xl sm:pb-5"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-bold text-slate-900">Complete job</h3>
            <p className="text-sm text-slate-500">
              {job.customer_name} · {job.service_name}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="flex h-11 w-11 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            aria-label="Close"
          >
            <XIcon className="h-6 w-6" />
          </button>
        </div>

        {/* After photo */}
        <div className="mt-5">
          <label className="mb-1 block text-sm font-semibold text-slate-700">After photo</label>
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png"
            capture="environment"
            className="hidden"
            onChange={onPickFile}
          />
          {previewUrl ? (
            <div className="relative">
              <img
                src={previewUrl}
                alt="After photo preview"
                className="h-48 w-full rounded-xl object-cover"
              />
              <button
                type="button"
                onClick={() => {
                  setFile(null);
                  if (inputRef.current) inputRef.current.value = '';
                }}
                className="absolute right-2 top-2 flex h-9 w-9 items-center justify-center rounded-full bg-slate-900/70 text-white"
                aria-label="Remove photo"
              >
                <XIcon className="h-5 w-5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              className="flex min-h-[112px] w-full flex-col items-center justify-center gap-1 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-sm font-medium text-slate-500 transition hover:border-brand-400 hover:text-brand-600"
            >
              <span className="text-2xl leading-none">+</span>
              Tap to add a photo
              <span className="text-xs text-slate-400">JPEG or PNG, up to 5MB</span>
            </button>
          )}
        </div>

        {/* Notes */}
        <div className="mt-4">
          <label className="mb-1 block text-sm font-semibold text-slate-700">Notes</label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any issues? Additional work done?"
            className="input-base min-h-[80px]"
          />
        </div>

        {/* Approval */}
        <label className="mt-4 flex min-h-[44px] cursor-pointer items-center gap-3 rounded-xl bg-slate-50 px-4">
          <input
            type="checkbox"
            checked={approved}
            onChange={(e) => setApproved(e.target.checked)}
            className="h-5 w-5 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
          />
          <span className="text-sm font-medium text-slate-700">Customer approved completion</span>
        </label>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertIcon className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        {/* Actions */}
        <div className="mt-6 flex flex-col gap-3 sm:flex-row-reverse">
          <button
            type="button"
            onClick={submit}
            disabled={submitting}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:opacity-60"
          >
            {submitting ? (
              <>
                <Spinner className="h-5 w-5" /> Completing…
              </>
            ) : (
              <>
                <CheckIcon className="h-5 w-5" /> Confirm Completion
              </>
            )}
          </button>
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="inline-flex min-h-[48px] flex-1 items-center justify-center rounded-xl border border-slate-300 bg-white px-5 font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
