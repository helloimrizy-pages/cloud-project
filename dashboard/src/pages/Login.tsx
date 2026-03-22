import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { useTheme } from '../hooks/useTheme';

type View = 'signin' | 'signup' | 'confirm';

export default function Login() {
  const { signIn, signUp, confirmSignUp } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [view, setView] = useState<View>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Invalid credentials');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await signUp(email, password);
      setView('confirm');
    } catch (err) {
      setError((err as Error).message || 'Sign up failed');
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      await confirmSignUp(email, code);
      await signIn(email, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError((err as Error).message || 'Confirmation failed');
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = 'w-full bg-bg-active text-text-primary text-sm rounded-lg px-4 py-2.5 border border-border outline-none focus:border-accent/50 placeholder:text-text-muted transition-colors';

  return (
    <div className="min-h-screen bg-bg-primary flex items-center justify-center px-4">
      <div className="w-full max-w-sm">
        {/* Brand */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <div className="w-2 h-2 rounded-full bg-accent" />
            <h1 className="text-xl font-semibold text-text-primary tracking-tight">CloudWatch AI</h1>
          </div>
          <p className="text-sm text-text-muted">Predictive Incident Detection</p>
        </div>

        {/* Card */}
        <div className="bg-bg-card border border-border rounded-2xl p-6">
          {/* Tabs (only show for signin/signup, not confirm) */}
          {view !== 'confirm' && (
            <div className="flex gap-1 bg-bg-active rounded-lg p-1 mb-6">
              <button
                onClick={() => { setView('signin'); setError(''); }}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all duration-150 ${
                  view === 'signin' ? 'bg-bg-card text-text-primary font-medium shadow-sm' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setView('signup'); setError(''); }}
                className={`flex-1 py-1.5 text-sm rounded-md transition-all duration-150 ${
                  view === 'signup' ? 'bg-bg-card text-text-primary font-medium shadow-sm' : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                Sign Up
              </button>
            </div>
          )}

          {/* Sign In Form */}
          {view === 'signin' && (
            <form onSubmit={handleSignIn} className="space-y-4">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Enter your password"
                  required
                />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-accent/15 text-accent border border-accent/20 hover:bg-accent/25 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Signing in...' : 'Sign In'}
              </button>
            </form>
          )}

          {/* Sign Up Form */}
          {view === 'signup' && (
            <form onSubmit={handleSignUp} className="space-y-4">
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Password</label>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className={inputClass}
                  placeholder="Min 8 chars, upper + lower + number"
                  required
                  minLength={8}
                />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-accent/15 text-accent border border-accent/20 hover:bg-accent/25 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Creating account...' : 'Create Account'}
              </button>
            </form>
          )}

          {/* Confirmation Form */}
          {view === 'confirm' && (
            <form onSubmit={handleConfirm} className="space-y-4">
              <div className="text-center mb-2">
                <p className="text-sm text-text-secondary">Check your email for a verification code</p>
                <p className="text-xs text-text-muted mt-1">{email}</p>
              </div>
              <div>
                <label className="text-[11px] text-text-muted uppercase tracking-wider block mb-1.5">Verification Code</label>
                <input
                  type="text"
                  value={code}
                  onChange={e => setCode(e.target.value)}
                  className={`${inputClass} text-center tracking-[0.3em] font-mono`}
                  placeholder="123456"
                  required
                  maxLength={6}
                />
              </div>
              {error && <p className="text-xs text-danger">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-2.5 rounded-lg text-sm font-medium bg-accent/15 text-accent border border-accent/20 hover:bg-accent/25 transition-all duration-150 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting ? 'Verifying...' : 'Verify & Sign In'}
              </button>
              <button
                type="button"
                onClick={() => { setView('signin'); setError(''); }}
                className="w-full py-2 text-xs text-text-muted hover:text-text-secondary transition-colors"
              >
                Back to Sign In
              </button>
            </form>
          )}
        </div>

        {/* Theme toggle */}
        <div className="flex justify-center mt-6">
          <button
            onClick={toggleTheme}
            className="text-xs text-text-muted hover:text-text-secondary transition-colors"
          >
            {theme === 'dark' ? '☀ Light Mode' : '☾ Dark Mode'}
          </button>
        </div>
      </div>
    </div>
  );
}
