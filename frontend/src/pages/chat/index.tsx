import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import { createClient } from '@supabase/supabase-js';
import ChatMessages from '../../components/chat/ChatMessages';
import ChatInput from '../../components/chat/ChatInput';
import MediaControls from '../../components/chat/MediaControls';
import SessionHeader from '../../components/chat/SessionHeader';

// Supabase client for Realtime
const supabase = createClient(
  import.meta.env.VITE_SUPABASE_URL || '',
  import.meta.env.VITE_SUPABASE_ANON_KEY || ''
);

export default function ChatPage() {
  const user = useAuthStore(state => state.user);
  const accessToken = useAuthStore(state => state.accessToken);
  const logout = useAuthStore(state => state.logout);

  const currentSession = useSessionStore(state => state.currentSession);
  const createSession = useSessionStore(state => state.createSession);
  const endSession = useSessionStore(state => state.endSession);
  const addMessage = useSessionStore(state => state.addMessage);

  const realtimeChannelRef = useRef<any>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // Initialize session on component mount
  useEffect(() => {
    if (!currentSession) {
      createSession();
    }
  }, [currentSession, createSession]);

  // Supabase Realtime subscription (replaces WebSocket)
  useEffect(() => {
    if (!currentSession || !user?.id) return;

    setIsConnecting(true);
    setWsError(null);

    try {
      // Subscribe to therapist responses via Supabase Realtime
      const channelName = `therapist:${currentSession.id}`;

      const channel = supabase
        .channel(channelName)
        .on(
          'broadcast',
          {
            event: 'message'
          },
          (payload) => {
            // Receive message from therapist
            if (payload.payload?.type === 'token') {
              // Streaming token received
              addMessage({
                id: `msg_${payload.payload.messageId || Date.now()}`,
                role: 'assistant',
                content: payload.payload.content,
                timestamp: new Date(),
                videoAnalysis: payload.payload.videoAnalysis
              });
            } else if (payload.payload?.type === 'complete') {
              // Message complete
              console.log('Message complete', payload.payload);
            }
          }
        )
        .on('presence', { event: 'sync' }, () => {
          console.log('Therapist presence updated');
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            setIsConnecting(false);
            console.log('Supabase Realtime connected');
          } else if (status === 'CHANNEL_ERROR') {
            setWsError('Connection error');
            setIsConnecting(false);
          }
        });

      realtimeChannelRef.current = channel;

      return () => {
        if (realtimeChannelRef.current) {
          supabase.removeChannel(realtimeChannelRef.current);
        }
      };
    } catch (error) {
      setWsError('Failed to connect');
      setIsConnecting(false);
      console.error('Realtime connection failed:', error);
    }
  }, [currentSession, user?.id, addMessage]);

  const handleSendMessage = async (content: string) => {
    if (!currentSession) {
      setWsError('Session not ready');
      return;
    }

    // Add user message
    addMessage({
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    });

    // Send to API endpoint (instead of WebSocket)
    try {
      const response = await fetch('/api/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`
        },
        body: JSON.stringify({
          messages: currentSession.messages.map(m => ({
            role: m.role,
            content: m.content
          })),
          sessionId: currentSession.id,
          userId: user?.id
        })
      });

      if (!response.ok) {
        throw new Error('Failed to send message');
      }

      // Handle streaming response
      const reader = response.body?.getReader();
      if (!reader) return;

      const decoder = new TextDecoder();
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value);
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const json = JSON.parse(line.slice(6));
              if (json.choices?.[0]?.delta?.content) {
                addMessage({
                  id: `msg_${json.id || Date.now()}`,
                  role: 'assistant',
                  content: json.choices[0].delta.content,
                  timestamp: new Date()
                });
              }
            } catch (e) {
              // Ignore parse errors
            }
          }
        }
      }
    } catch (error) {
      console.error('Failed to send message:', error);
      setWsError('Failed to send message');
    }
  };

  if (!currentSession) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }

  return (
    <div className="h-screen flex flex-col bg-slate-900">
      <SessionHeader
        sessionId={currentSession.id}
        userName={user?.email || 'User'}
        onLogout={logout}
        onEndSession={endSession}
      />

      {wsError && (
        <div className="px-4 py-2 bg-yellow-900/30 border-b border-yellow-700 text-yellow-300 text-sm">
          {wsError}
        </div>
      )}

      <div className="flex-1 overflow-hidden flex flex-col">
        <ChatMessages messages={currentSession.messages} />

        <MediaControls
          audioEnabled={currentSession.audioEnabled}
          videoEnabled={currentSession.videoEnabled}
        />

        <ChatInput
          onSend={handleSendMessage}
          disabled={isConnecting || wsRef.current?.readyState !== WebSocket.OPEN}
        />
      </div>
    </div>
  );
}
