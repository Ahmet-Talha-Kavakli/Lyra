import { useEffect, useRef } from 'react';
import { Message } from '../../store/sessionStore';

interface ChatMessagesProps {
  messages: Message[];
}

export default function ChatMessages({ messages }: ChatMessagesProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div
      ref={scrollRef}
      className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-800"
    >
      {messages.length === 0 ? (
        <div className="h-full flex items-center justify-center text-center">
          <div>
            <h2 className="text-2xl font-semibold text-slate-300 mb-2">Start a new session</h2>
            <p className="text-slate-400">Share what's on your mind, and Lyra will listen</p>
          </div>
        </div>
      ) : (
        messages.map(message => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-xs lg:max-w-md px-4 py-3 rounded-lg ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : 'bg-slate-700 text-slate-100'
              }`}
            >
              <p className="text-sm">{message.content}</p>
              {message.videoAnalysis && (
                <div className="mt-2 pt-2 border-t border-opacity-20 border-white text-xs opacity-75">
                  <p>Action Units: {Object.keys(message.videoAnalysis.actionUnits).slice(0, 3).join(', ')}</p>
                </div>
              )}
              <time className="text-xs opacity-70 mt-1 block">
                {message.timestamp.toLocaleTimeString()}
              </time>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
