import { create } from 'zustand';

export interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
  audioUrl?: string;
  videoAnalysis?: {
    actionUnits: Record<string, number>;
    confidence: number;
    symmetry: number;
  };
}

export interface Session {
  id: string;
  startTime: Date;
  endTime?: Date;
  messages: Message[];
  audioEnabled: boolean;
  videoEnabled: boolean;
  status: 'active' | 'paused' | 'ended';
}

export interface SessionState {
  currentSession: Session | null;
  sessions: Session[];
  isLoading: boolean;
  error: string | null;

  createSession: () => void;
  endSession: () => Promise<void>;
  addMessage: (message: Message) => void;
  setAudioEnabled: (enabled: boolean) => void;
  setVideoEnabled: (enabled: boolean) => void;
  loadSessions: () => Promise<void>;
  setError: (error: string | null) => void;
}

export const useSessionStore = create<SessionState>((set, get) => ({
  currentSession: null,
  sessions: [],
  isLoading: false,
  error: null,

  createSession: () => {
    const newSession: Session = {
      id: `session_${Date.now()}`,
      startTime: new Date(),
      messages: [],
      audioEnabled: false,
      videoEnabled: false,
      status: 'active'
    };
    set({ currentSession: newSession });
  },

  endSession: async () => {
    const session = get().currentSession;
    if (!session) return;

    try {
      const endedSession = { ...session, status: 'ended' as const, endTime: new Date() };
      set(state => ({
        sessions: [endedSession, ...state.sessions],
        currentSession: null
      }));

      // Save to backend
      await fetch('/api/sessions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(endedSession)
      });
    } catch (error) {
      set({ error: 'Failed to save session' });
    }
  },

  addMessage: (message) => {
    set(state => {
      if (!state.currentSession) return state;
      return {
        currentSession: {
          ...state.currentSession,
          messages: [...state.currentSession.messages, message]
        }
      };
    });
  },

  setAudioEnabled: (enabled) => {
    set(state => {
      if (!state.currentSession) return state;
      return {
        currentSession: { ...state.currentSession, audioEnabled: enabled }
      };
    });
  },

  setVideoEnabled: (enabled) => {
    set(state => {
      if (!state.currentSession) return state;
      return {
        currentSession: { ...state.currentSession, videoEnabled: enabled }
      };
    });
  },

  loadSessions: async () => {
    set({ isLoading: true });
    try {
      const response = await fetch('/api/sessions');
      if (response.ok) {
        const data = await response.json();
        set({ sessions: data, isLoading: false });
      }
    } catch (error) {
      set({ error: 'Failed to load sessions', isLoading: false });
    }
  },

  setError: (error) => set({ error })
}));
