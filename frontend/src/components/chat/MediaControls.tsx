import { Mic, Video } from 'lucide-react';
import { useSessionStore } from '../../store/sessionStore';

interface MediaControlsProps {
  audioEnabled: boolean;
  videoEnabled: boolean;
}

export default function MediaControls({ audioEnabled, videoEnabled }: MediaControlsProps) {
  const setAudioEnabled = useSessionStore(state => state.setAudioEnabled);
  const setVideoEnabled = useSessionStore(state => state.setVideoEnabled);

  return (
    <div className="border-t border-slate-700 bg-slate-800 px-4 py-3 flex gap-2">
      <button
        onClick={() => setAudioEnabled(!audioEnabled)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          audioEnabled
            ? 'bg-green-600/20 text-green-300 border border-green-600'
            : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
        }`}
        title={audioEnabled ? 'Audio on' : 'Audio off'}
      >
        <Mic size={18} />
        <span className="text-sm">Audio</span>
      </button>

      <button
        onClick={() => setVideoEnabled(!videoEnabled)}
        className={`flex items-center gap-2 px-3 py-2 rounded-lg transition-colors ${
          videoEnabled
            ? 'bg-green-600/20 text-green-300 border border-green-600'
            : 'bg-slate-700 text-slate-400 border border-slate-600 hover:bg-slate-600'
        }`}
        title={videoEnabled ? 'Video on' : 'Video off'}
      >
        <Video size={18} />
        <span className="text-sm">Video</span>
      </button>

      {(audioEnabled || videoEnabled) && (
        <div className="ml-auto text-xs text-slate-400">
          Recording {audioEnabled && 'audio'} {audioEnabled && videoEnabled && '+'} {videoEnabled && 'video'}
        </div>
      )}
    </div>
  );
}
