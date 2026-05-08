import { useEffect, useRef, useState } from 'react';
import { useVoiceRecorder } from '../hooks/useVoiceRecorder';

interface Props {
  recorder: ReturnType<typeof useVoiceRecorder>;
  pttAvailable: boolean;
}

function MicIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="w-4 h-4"
    >
      <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z" />
      <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
      <line x1="12" y1="19" x2="12" y2="23" />
      <line x1="8" y1="23" x2="16" y2="23" />
    </svg>
  );
}

export function MediaConsole({ recorder, pttAvailable }: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onDocClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', onDocClick);
    return () => document.removeEventListener('mousedown', onDocClick);
  }, [open]);

  const showRight = recorder.isRecording || pttAvailable;

  return (
    <div
      ref={wrapRef}
      className="absolute top-3 left-3 z-20 inline-flex h-9 items-center rounded-full bg-gray-900/80 backdrop-blur border border-gray-700 shadow-lg"
    >
      <div className="relative flex items-center px-3 gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="text-gray-200 hover:text-white"
          title={recorder.selectedDeviceId ? 'Change microphone' : 'Select microphone'}
        >
          <MicIcon />
        </button>
        {open && (
          <div className="absolute top-full mt-1 left-0 min-w-[220px] bg-gray-900 border border-gray-700 rounded-lg shadow-xl py-1 max-h-64 overflow-y-auto">
            {recorder.devices.length === 0 && (
              <div className="px-3 py-2 text-sm text-gray-400">No microphones found</div>
            )}
            {recorder.devices.map((d) => {
              const selected = d.deviceId === recorder.selectedDeviceId;
              return (
                <button
                  key={d.deviceId}
                  onClick={() => {
                    recorder.setSelectedDeviceId(d.deviceId);
                    setOpen(false);
                  }}
                  className={`w-full text-left px-3 py-1.5 text-sm hover:bg-gray-800 ${
                    selected ? 'text-blue-400' : 'text-gray-200'
                  }`}
                >
                  {d.label || `Microphone ${d.deviceId.slice(0, 8)}`}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {showRight && (
        <>
          <div className="w-px h-5 bg-gray-700" />
          <div className="flex items-center px-3 gap-2 text-sm text-gray-200">
            {recorder.isRecording ? (
              <>
                <div className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
                <span>Recording...</span>
              </>
            ) : (
              <span>Hold T to record</span>
            )}
          </div>
        </>
      )}
    </div>
  );
}
