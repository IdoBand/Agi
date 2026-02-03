interface PushToTalkProps {
  isRecording: boolean;
  isLoading: boolean;
  isPlaying: boolean;
  error: string | null;
  micSelected: boolean;
}

export function PushToTalk({
  isRecording,
  isLoading,
  isPlaying,
  error,
  micSelected,
}: PushToTalkProps) {
  const getStatusText = () => {
    if (error) return error;
    if (!micSelected) return 'Select a microphone to start';
    if (isRecording) return 'Recording... Release T to send';
    if (isLoading) return 'Processing...';
    if (isPlaying) return 'Speaking...';
    return 'Hold T to talk';
  };

  const getStatusColor = () => {
    if (error) return 'bg-red-500';
    if (!micSelected) return 'bg-orange-500';
    if (isRecording) return 'bg-red-500 animate-pulse';
    if (isLoading) return 'bg-yellow-500';
    if (isPlaying) return 'bg-green-500';
    return 'bg-gray-700';
  };

  return (
    <div className="fixed bottom-8 left-1/2 transform -translate-x-1/2 z-10">
      <div
        className={`${getStatusColor()} text-white px-6 py-3 rounded-full shadow-lg transition-all duration-200`}
      >
        <div className="flex items-center gap-3">
          {isRecording && (
            <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
          )}
          {isLoading && (
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
          )}
          {isPlaying && (
            <div className="flex gap-1">
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '0ms' }} />
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '150ms' }} />
              <div className="w-1 h-4 bg-white animate-bounce" style={{ animationDelay: '300ms' }} />
            </div>
          )}
          <span className="font-medium">{getStatusText()}</span>
        </div>
      </div>
    </div>
  );
}
