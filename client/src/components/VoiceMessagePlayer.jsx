import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Play, Pause, Volume2, Download } from 'lucide-react';

export const VoiceMessagePlayer = ({ audioUrl, duration = 0, isMe = false, name = 'Voice message' }) => {
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(duration || 0);
  const [playbackRate, setPlaybackRate] = useState(1);
  const audioRef = useRef(null);

  // Generate deterministic pseudo-random waveform bars based on audioUrl
  const waveformBars = useMemo(() => {
    const bars = [];
    let seed = 0;
    for (let i = 0; i < (audioUrl || '').length; i++) {
      seed = (seed << 5) - seed + audioUrl.charCodeAt(i);
      seed |= 0;
    }
    const numBars = 32;
    for (let i = 0; i < numBars; i++) {
      const x = Math.sin(seed + i * 1.7) * 10000;
      const val = Math.floor((x - Math.floor(x)) * 75) + 25; // 25% to 100% height
      bars.push(val);
    }
    return bars;
  }, [audioUrl]);

  useEffect(() => {
    const audio = new Audio(audioUrl);
    audioRef.current = audio;

    const onLoadedMetadata = () => {
      if (audio.duration && !isNaN(audio.duration) && isFinite(audio.duration)) {
        setAudioDuration(Math.round(audio.duration));
      }
    };

    const onTimeUpdate = () => {
      setCurrentTime(audio.currentTime);
    };

    const onEnded = () => {
      setIsPlaying(false);
      setCurrentTime(0);
    };

    audio.addEventListener('loadedmetadata', onLoadedMetadata);
    audio.addEventListener('timeupdate', onTimeUpdate);
    audio.addEventListener('ended', onEnded);

    return () => {
      audio.pause();
      audio.removeEventListener('loadedmetadata', onLoadedMetadata);
      audio.removeEventListener('timeupdate', onTimeUpdate);
      audio.removeEventListener('ended', onEnded);
      audioRef.current = null;
    };
  }, [audioUrl]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.playbackRate = playbackRate;
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.warn('[Audio Play Warning]:', err.message);
      });
    }
  };

  const handleSeek = (e) => {
    if (!audioRef.current || !audioDuration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const targetPercent = Math.max(0, Math.min(1, clickX / width));
    const newTime = targetPercent * audioDuration;
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const toggleSpeed = () => {
    const speeds = [1, 1.5, 2];
    const nextIndex = (speeds.indexOf(playbackRate) + 1) % speeds.length;
    const nextSpeed = speeds[nextIndex];
    setPlaybackRate(nextSpeed);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextSpeed;
    }
  };

  const formatTime = (secs) => {
    const s = Math.floor(secs || 0);
    const m = Math.floor(s / 60);
    const rem = s % 60;
    return `${m}:${rem < 10 ? '0' : ''}${rem}`;
  };

  const progressPercent = audioDuration > 0 ? (currentTime / audioDuration) * 100 : 0;

  return (
    <div
      className={`p-3 rounded-2xl flex items-center space-x-3 select-none min-w-[240px] max-w-sm transition-all ${
        isMe
          ? 'bg-indigo-700/60 text-white'
          : 'bg-slate-100 dark:bg-slate-800 text-slate-900 dark:text-white border border-slate-200/80 dark:border-slate-700/80'
      }`}
    >
      {/* Play/Pause Circle Button */}
      <button
        type="button"
        onClick={togglePlay}
        className={`w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-transform active:scale-90 shadow-sm ${
          isMe
            ? 'bg-white text-indigo-600 hover:bg-indigo-50'
            : 'bg-indigo-600 text-white hover:bg-indigo-700'
        }`}
        title={isPlaying ? 'Pause' : 'Play voice message'}
      >
        {isPlaying ? (
          <Pause className="w-5 h-5 fill-current" />
        ) : (
          <Play className="w-5 h-5 fill-current ml-0.5" />
        )}
      </button>

      {/* Waveform & Scrubber Container */}
      <div className="flex-1 flex flex-col justify-center space-y-1.5 min-w-0">
        <div
          onClick={handleSeek}
          className="h-7 flex items-center gap-[2.5px] cursor-pointer group/wave py-1"
          title="Click to seek"
        >
          {waveformBars.map((heightPercent, index) => {
            const barProgress = (index / waveformBars.length) * 100;
            const isPlayed = barProgress <= progressPercent;

            return (
              <span
                key={index}
                style={{ height: `${heightPercent}%` }}
                className={`w-[3px] rounded-full transition-all duration-75 group-hover/wave:scale-y-110 ${
                  isPlayed
                    ? isMe
                      ? 'bg-white'
                      : 'bg-indigo-600 dark:bg-indigo-400'
                    : isMe
                    ? 'bg-indigo-300/40'
                    : 'bg-slate-300 dark:bg-slate-600'
                }`}
              />
            );
          })}
        </div>

        {/* Time and Speed Multiplier */}
        <div
          className={`flex items-center justify-between text-[10px] font-medium tracking-wide ${
            isMe ? 'text-indigo-100' : 'text-slate-500 dark:text-slate-400'
          }`}
        >
          <span>
            {isPlaying || currentTime > 0
              ? `${formatTime(currentTime)} / ${formatTime(audioDuration)}`
              : formatTime(audioDuration || duration)}
          </span>

          <div className="flex items-center space-x-1.5">
            {/* Speed Toggle */}
            <button
              type="button"
              onClick={toggleSpeed}
              className={`px-1.5 py-0.5 rounded text-[9px] font-bold transition-colors ${
                isMe
                  ? 'bg-indigo-600/80 hover:bg-indigo-500 text-white'
                  : 'bg-slate-200 dark:bg-slate-700 hover:bg-slate-300 dark:hover:bg-slate-600 text-slate-700 dark:text-slate-200'
              }`}
              title="Playback speed"
            >
              {playbackRate}x
            </button>

            {/* Download */}
            <a
              href={audioUrl}
              download={name || 'voice-message.webm'}
              target="_blank"
              rel="noreferrer"
              className={`p-1 rounded hover:opacity-100 opacity-60 transition-opacity ${
                isMe ? 'text-white' : 'text-slate-600 dark:text-slate-300'
              }`}
              title="Download voice message"
            >
              <Download className="w-3 h-3" />
            </a>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VoiceMessagePlayer;
