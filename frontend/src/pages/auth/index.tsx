import { useState } from 'react';
import LoginForm from './LoginForm';
import SignupForm from './SignupForm';

export default function AuthPages() {
  const [mode, setMode] = useState<'login' | 'signup'>('login');

  return (
    <div className="h-screen flex items-center justify-center bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Lyra</h1>
          <p className="text-slate-300">Your AI Therapy Companion</p>
        </div>

        {mode === 'login' ? (
          <LoginForm onSwitchMode={() => setMode('signup')} />
        ) : (
          <SignupForm onSwitchMode={() => setMode('login')} />
        )}
      </div>
    </div>
  );
}
