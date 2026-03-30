import { useEffect, useRef, useState } from 'react';
import { useAuthStore } from '../../store/authStore';
import { useSessionStore } from '../../store/sessionStore';
import ChatMessages from '../../components/chat/ChatMessages';
import ChatInput from '../../components/chat/ChatInput';
import MediaControls from '../../components/chat/MediaControls';
import SessionHeader from '../../components/chat/SessionHeader';

export default function ChatPage() {
  const user = useAuthStore(state => state.user);
  const accessToken = useAuthStore(state => state.accessToken);
  const logout = useAuthStore(state => state.logout);

  const currentSession = useSessionStore(state => state.currentSession);
  const createSession = useSessionStore(state => state.createSession);
  const endSession = useSessionStore(state => state.endSession);
  const addMessage = useSessionStore(state => state.addMessage);

  const wsRef = useRef<WebSocket | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [wsError, setWsError] = useState<string | null>(null);

  // Initialize session on component mount
  useEffect(() => {
    if (!currentSession) {
      createSession();
    }
  }, [currentSession, createSession]);

  // WebSocket connection
  useEffect(() => {
    if (!currentSession || !accessToken) return;

    const connectWebSocket = () => {
      setIsConnecting(true);
      setWsError(null);

      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${import.meta.env.VITE_WS_URL || 'localhost:3000'}/ws`;

      try {
        // SECURITY: Token in Authorization header, not URL
        wsRef.current = new WebSocket(wsUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`
          }
        });

        wsRef.current.onopen = () => {
          setIsConnecting(false);
          console.log('WebSocket connected');
        };

        wsRef.current.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data);
            if (data.type === 'message') {
              addMessage({
                id: data.id,
                role: 'assistant',
                content: data.content,
                timestamp: new Date(),
                videoAnalysis: data.videoAnalysis
              });
            }
          } catch (error) {
            console.error('Failed to parse WebSocket message:', error);
          }
        };

        wsRef.current.onerror = (error) => {
          setWsError('Connection error. Retrying...');
          console.error('WebSocket error:', error);
        };

        wsRef.current.onclose = () => {
          console.log('WebSocket disconnected');
          // Auto-reconnect after 3 seconds
          setTimeout(connectWebSocket, 3000);
        };
      } catch (error) {
        setWsError('Failed to connect');
        console.error('WebSocket connection failed:', error);
      }
    };

    connectWebSocket();

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, [currentSession, accessToken, addMessage]);

  const handleSendMessage = async (content: string) => {
    if (!currentSession || !wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setWsError('Not connected. Please wait...');
      return;
    }

    // Add user message
    addMessage({
      id: `msg_${Date.now()}`,
      role: 'user',
      content,
      timestamp: new Date()
    });

    // Send to backend
    try {
      wsRef.current.send(JSON.stringify({
        type: 'message',
        sessionId: currentSession.id,
        content,
        userId: user?.id
      }));
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
