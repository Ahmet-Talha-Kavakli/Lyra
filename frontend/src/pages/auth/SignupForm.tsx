import { useState } from 'react';
import { useAuthStore } from '../../store/authStore';

interface SignupFormProps {
  onSwitchMode: () => void;
}

export default function SignupForm({ onSwitchMode }: SignupFormProps) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [agreed, setAgreed] = useState(false);

  const setUser = useAuthStore(state => state.setUser);
  const setAccessToken = useAuthStore(state => state.setAccessToken);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }

    if (!agreed) {
      setError('You must agree to the privacy policy');
      return;
    }

    setLoading(true);

    try {
      const response = await fetch('/api/auth/signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
        credentials: 'include'
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Signup failed');
      }

      const data = await response.json();
      localStorage.setItem('lyra_token', data.accessToken);
      setAccessToken(data.accessToken);
      setUser(data.user);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="card space-y-4">
      {error && (
        <div className="p-3 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Email</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="input-base"
          placeholder="you@example.com"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Password</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="input-base"
          placeholder="••••••••"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-slate-300 mb-2">Confirm Password</label>
        <input
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="input-base"
          placeholder="••••••••"
          required
        />
      </div>

      <div className="flex items-start space-x-2">
        <input
          type="checkbox"
          id="privacy"
          checked={agreed}
          onChange={(e) => setAgreed(e.target.checked)}
          className="mt-1"
        />
        <label htmlFor="privacy" className="text-sm text-slate-400">
          I agree to the <span className="text-blue-400">privacy policy</span> and consent to data collection for therapy purposes
        </label>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="btn-primary w-full disabled:opacity-50"
      >
        {loading ? 'Creating account...' : 'Sign Up'}
      </button>

      <p className="text-center text-slate-400 text-sm">
        Already have an account?{' '}
        <button
          type="button"
          onClick={onSwitchMode}
          className="text-blue-400 hover:text-blue-300 font-medium"
        >
          Log in
        </button>
      </p>
    </form>
  );
}
