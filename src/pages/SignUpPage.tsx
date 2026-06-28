import { useState, type FormEvent } from 'react';
import { useAuth } from '@/auth/AuthContext';
import { isSupabaseConfigured } from '@/lib/supabase';
import { AuthShell, AuthSetupNotice } from './AuthShell';

/**
 * Owner sign-up: email + password + business name.
 * The DB trigger (`handle_new_user`) provisions the business profile + owner
 * record automatically using the `business_name` metadata.
 */
export default function SignUpPage() {
  const { signUp } = useAuth();
  const [businessName, setBusinessName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmSent, setConfirmSent] = useState(false);

  if (!isSupabaseConfigured) return <AuthSetupNotice />;

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!businessName.trim()) {
      setError('Please enter your business name.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setSubmitting(true);
    try {
      const { needsEmailConfirmation } = await signUp({
        email: email.trim(),
        password,
        businessName: businessName.trim(),
      });
      if (needsEmailConfirmation) {
        setConfirmSent(true); // show "check your email"
        setSubmitting(false);
      } else {
        window.location.assign('/account'); // logged in immediately
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign up failed. Please try again.');
      setSubmitting(false);
    }
  };

  if (confirmSent) {
    return (
      <AuthShell title="Check your email" subtitle="One more step">
        <p className="text-sm text-slate-600">
          We sent a confirmation link to <strong>{email}</strong>. Click it to
          activate your account, then log in.
        </p>
        <a href="/login" className="btn-primary mt-5 w-full">
          Go to login
        </a>
      </AuthShell>
    );
  }

  return (
    <AuthShell title="Create your account" subtitle="Start taking bookings in minutes">
      <form onSubmit={handleSubmit} className="space-y-4">
        {error && <p className="rounded-lg bg-red-50 p-3 text-sm text-red-700">{error}</p>}

        <div>
          <label htmlFor="business" className="mb-1 block text-sm font-medium text-slate-700">
            Business name
          </label>
          <input
            id="business"
            type="text"
            autoComplete="organization"
            className="input-base"
            value={businessName}
            onChange={(e) => setBusinessName(e.target.value)}
            placeholder="Spotless Mobile Detailing"
          />
        </div>

        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-slate-700">
            Email
          </label>
          <input
            id="email"
            type="email"
            autoComplete="email"
            className="input-base"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@business.com"
          />
        </div>

        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-slate-700">
            Password
          </label>
          <input
            id="password"
            type="password"
            autoComplete="new-password"
            className="input-base"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 8 characters"
          />
        </div>

        <button type="submit" disabled={submitting} className="btn-primary w-full">
          {submitting ? 'Creating account…' : 'Sign up'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-slate-500">
        Already have an account?{' '}
        <a href="/login" className="font-semibold text-brand-600 hover:underline">
          Log in
        </a>
      </p>
    </AuthShell>
  );
}
