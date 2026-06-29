import { useEffect, useState } from 'react';
import { deleteService, toMessage, updateBusiness, upsertService } from '@/lib/adminApi';
import { formatDuration, formatPrice } from '@/lib/format';
import { Spinner } from '@/components/ui/Spinner';
import { AlertIcon, PencilIcon, PlusIcon, TrashIcon, XIcon } from '@/components/ui/icons';
import type { Business, Service } from '@/types/database';

interface SettingsTabProps {
  business: Business;
  services: Service[];
  /** Re-fetch business + services after a successful save. */
  reload: () => void;
  notify: (message: string) => void;
}

/** A DB `time` value ("09:00:00") trimmed to what <input type=time> expects. */
function toTimeInput(value: string): string {
  return value.slice(0, 5);
}

export function SettingsTab({ business, services, reload, notify }: SettingsTabProps) {
  const [name, setName] = useState(business.name);
  const [phone, setPhone] = useState(business.phone ?? '');
  const [email, setEmail] = useState(business.email ?? '');
  const [openingTime, setOpeningTime] = useState(toTimeInput(business.opening_time));
  const [closingTime, setClosingTime] = useState(toTimeInput(business.closing_time));

  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Keep the form in sync if the business reloads (e.g. after another save).
  useEffect(() => {
    setName(business.name);
    setPhone(business.phone ?? '');
    setEmail(business.email ?? '');
    setOpeningTime(toTimeInput(business.opening_time));
    setClosingTime(toTimeInput(business.closing_time));
  }, [business]);

  // Service editor modal state. `undefined` = closed; `null` id = creating.
  const [editing, setEditing] = useState<Service | 'new' | null>(null);

  const saveBusiness = async () => {
    setSaving(true);
    setError(null);
    try {
      await updateBusiness(business.id, {
        name,
        phone,
        email,
        opening_time: openingTime,
        closing_time: closingTime,
      });
      reload();
      notify('Settings saved!');
    } catch (err) {
      setError(toMessage(err, 'Could not save settings.'));
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (service: Service) => {
    if (!window.confirm(`Delete “${service.name}”?`)) return;
    try {
      await deleteService(business.id, service.id);
      reload();
      notify('Service removed.');
    } catch (err) {
      notify(toMessage(err, 'Could not delete service.'));
    }
  };

  return (
    <div className="space-y-6">
      {/* Business info */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <h3 className="text-base font-semibold text-slate-900">Business info</h3>
        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Business Name">
            <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Phone Number">
            <input className="input-base" value={phone} onChange={(e) => setPhone(e.target.value)} />
          </Field>
          <Field label="Email">
            <input
              type="email"
              className="input-base"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>

        <h4 className="mt-6 text-sm font-semibold text-slate-700">Working hours</h4>
        <div className="mt-3 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Start Time">
            <input
              type="time"
              className="input-base"
              value={openingTime}
              onChange={(e) => setOpeningTime(e.target.value)}
            />
          </Field>
          <Field label="End Time">
            <input
              type="time"
              className="input-base"
              value={closingTime}
              onChange={(e) => setClosingTime(e.target.value)}
            />
          </Field>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
            <AlertIcon className="h-5 w-5 shrink-0" /> {error}
          </div>
        )}

        <div className="mt-6">
          <button
            type="button"
            onClick={saveBusiness}
            disabled={saving}
            className="inline-flex items-center justify-center gap-2 rounded-lg bg-emerald-600 px-5 py-3 font-semibold text-white shadow-sm transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {saving ? (
              <>
                <Spinner className="h-5 w-5" /> Saving…
              </>
            ) : (
              'Save Changes'
            )}
          </button>
        </div>
      </section>

      {/* Services */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold text-slate-900">Services</h3>
          <button
            type="button"
            onClick={() => setEditing('new')}
            className="inline-flex items-center gap-1.5 rounded-lg bg-brand-600 px-3.5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-brand-700"
          >
            <PlusIcon className="h-4 w-4" /> Add Service
          </button>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-3 md:grid-cols-2">
          {services.map((s) => (
            <div
              key={s.id}
              className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 p-4"
            >
              <div className="min-w-0">
                <p className="font-semibold text-slate-800">{s.name}</p>
                <p className="mt-0.5 text-sm text-slate-500">
                  {formatPrice(s.price_cents)} · {formatDuration(s.duration_minutes)}
                </p>
                {s.description && (
                  <p className="mt-1 line-clamp-2 text-xs text-slate-400">{s.description}</p>
                )}
              </div>
              <div className="flex shrink-0 gap-1">
                <button
                  type="button"
                  onClick={() => setEditing(s)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-slate-100 hover:text-brand-600"
                  aria-label={`Edit ${s.name}`}
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => handleDelete(s)}
                  className="rounded-lg p-2 text-slate-500 transition hover:bg-red-50 hover:text-red-600"
                  aria-label={`Delete ${s.name}`}
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
          {services.length === 0 && (
            <p className="text-sm text-slate-500">No services yet. Add your first one.</p>
          )}
        </div>
      </section>

      {editing && (
        <ServiceEditor
          businessId={business.id}
          service={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(msg) => {
            setEditing(null);
            reload();
            notify(msg);
          }}
        />
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium text-slate-700">{label}</span>
      {children}
    </label>
  );
}

interface ServiceEditorProps {
  businessId: string;
  service: Service | null; // null = create
  onClose: () => void;
  onSaved: (message: string) => void;
}

/** Modal form for creating/editing a single service. */
function ServiceEditor({ businessId, service, onClose, onSaved }: ServiceEditorProps) {
  const [name, setName] = useState(service?.name ?? '');
  const [description, setDescription] = useState(service?.description ?? '');
  const [duration, setDuration] = useState(String(service?.duration_minutes ?? 60));
  const [price, setPrice] = useState(
    service ? (service.price_cents / 100).toString() : '',
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    const durationMin = parseInt(duration, 10);
    const priceCents = Math.round(parseFloat(price) * 100);
    if (!name.trim()) return setError('Name is required.');
    if (!Number.isFinite(durationMin) || durationMin <= 0)
      return setError('Enter a valid duration in minutes.');
    if (!Number.isFinite(priceCents) || priceCents < 0)
      return setError('Enter a valid price.');

    setSaving(true);
    setError(null);
    try {
      await upsertService(businessId, {
        id: service?.id ?? null,
        name,
        description,
        duration_minutes: durationMin,
        price_cents: priceCents,
      });
      onSaved(service ? 'Service updated!' : 'Service added!');
    } catch (err) {
      setError(toMessage(err, 'Could not save service.'));
      setSaving(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/40 p-0 sm:items-center sm:p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="w-full max-w-md rounded-t-2xl bg-white p-6 shadow-xl sm:rounded-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-bold text-slate-900">
            {service ? 'Edit service' : 'Add service'}
          </h3>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
            aria-label="Close"
          >
            <XIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 space-y-4">
          <Field label="Name">
            <input className="input-base" value={name} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Description">
            <textarea
              className="input-base min-h-[72px]"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
            />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Duration (min)">
              <input
                type="number"
                min={1}
                className="input-base"
                value={duration}
                onChange={(e) => setDuration(e.target.value)}
              />
            </Field>
            <Field label="Price ($)">
              <input
                type="number"
                min={0}
                step="0.01"
                className="input-base"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
              />
            </Field>
          </div>

          {error && (
            <div className="flex items-center gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
              <AlertIcon className="h-5 w-5 shrink-0" /> {error}
            </div>
          )}
        </div>

        <div className="mt-6 flex justify-end gap-3">
          <button type="button" onClick={onClose} className="btn-secondary">
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={saving}
            className="btn-primary"
          >
            {saving ? (
              <>
                <Spinner className="h-5 w-5" /> Saving…
              </>
            ) : (
              'Save'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
