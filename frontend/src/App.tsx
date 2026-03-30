import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useSessionStore } from './store/sessionStore';
import AuthPages from './pages/auth';
import ChatPage from './pages/chat';
import Loading from './components/Loading';

export default function App() {
  const { isAuthenticated, isLoading, checkAuth } = useAuthStore();

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (isLoading) {
    return <Loading />;
  }

  return (
    <div className="h-screen bg-gradient-to-br from-slate-900 to-slate-800">
      {isAuthenticated ? <ChatPage /> : <AuthPages />}
    </div>
  );
}
