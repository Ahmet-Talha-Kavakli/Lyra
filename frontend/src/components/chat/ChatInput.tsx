import { useState } from 'react';
import { Send, Mic } from 'lucide-react';

interface ChatInputProps {
  onSend: (message: string) => void;
  disabled?: boolean;
}

export default function ChatInput({ onSend, disabled }: ChatInputProps) {
  const [message, setMessage] = useState('');
  const [isRecording, setIsRecording] = useState(false);

  const handleSend = () => {
    if (message.trim() && !disabled) {
      onSend(message.trim());
      setMessage('');
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey && !disabled) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div className="border-t border-slate-700 bg-slate-800 p-4">
      <div className="flex gap-2">
        <textarea
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          onKeyPress={handleKeyPress}
          placeholder="Type your thoughts... (Shift+Enter for new line)"
          disabled={disabled}
          className="input-base flex-1 resize-none h-12 disabled:opacity-50"
        />

        <button
          type="button"
          onClick={() => setIsRecording(!isRecording)}
          disabled={disabled}
          className={`px-4 py-2 rounded-lg flex items-center gap-2 ${
            isRecording
              ? 'bg-red-600 hover:bg-red-700'
              : 'bg-slate-700 hover:bg-slate-600'
          } disabled:opacity-50`}
          title="Voice input"
        >
          <Mic size={20} />
        </button>

        <button
          onClick={handleSend}
          disabled={disabled || !message.trim()}
          className="btn-primary flex items-center gap-2 disabled:opacity-50"
          title="Send message"
        >
          <Send size={20} />
        </button>
      </div>

      {isRecording && (
        <div className="mt-2 p-2 bg-red-900/30 border border-red-700 rounded text-red-300 text-sm">
          🎤 Recording... (click mic to stop)
        </div>
      )}
    </div>
  );
}
