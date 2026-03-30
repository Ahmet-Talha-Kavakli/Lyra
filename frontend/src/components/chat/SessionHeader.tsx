import { LogOut, X } from 'lucide-react';

interface SessionHeaderProps {
  sessionId: string;
  userName: string;
  onLogout: () => void;
  onEndSession: () => Promise<void>;
}

export default function SessionHeader({
  sessionId,
  userName,
  onLogout,
  onEndSession
}: SessionHeaderProps) {
  const handleEndSession = async () => {
    if (confirm('End this therapy session?')) {
      await onEndSession();
    }
  };

  return (
    <div className="bg-slate-800 border-b border-slate-700 px-4 py-3 flex items-center justify-between">
      <div>
        <h1 className="text-lg font-semibold text-slate-100">Lyra</h1>
        <p className="text-xs text-slate-400">Session {sessionId.slice(0, 8)}</p>
      </div>

      <div className="flex items-center gap-3 text-sm">
        <span className="text-slate-300">{userName}</span>

        <button
          onClick={handleEndSession}
          className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
          title="End session"
        >
          <X size={20} />
        </button>

        <button
          onClick={onLogout}
          className="p-2 hover:bg-slate-700 rounded text-slate-400 hover:text-slate-200"
          title="Log out"
        >
          <LogOut size={20} />
        </button>
      </div>
    </div>
  );
}
