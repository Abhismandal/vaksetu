import React, { useState, useEffect, useRef } from 'react';
import { Trash2, Pause, Play, Send, Loader2, AlertCircle } from 'lucide-react';

export const VoiceRecorderBar = ({ onSendVoice, onCancel }) => {
  const [isRecording, setIsRecording] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [micError, setMicError] = useState('');
  const [audioLevels, setAudioLevels] = useState(new Array(24).fill(15)); // Live equalizer bars

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const streamRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const animFrameRef = useRef(null);
  const timerIntervalRef = useRef(null);

  // Start recording on mount
  useEffect(() => {
    let isMounted = true;

    const startRecording = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          throw new Error('Microphone audio recording is not supported in this browser');
        }

        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        streamRef.current = stream;

        // Choose supported mimeType
        let mimeType = 'audio/webm';
        if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
          mimeType = 'audio/webm;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/ogg;codecs=opus')) {
          mimeType = 'audio/ogg;codecs=opus';
        } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
          mimeType = 'audio/mp4';
        }

        const recorder = new MediaRecorder(stream, { mimeType });
        mediaRecorderRef.current = recorder;
        audioChunksRef.current = [];

        recorder.ondataavailable = (e) => {
          if (e.data && e.data.size > 0) {
            audioChunksRef.current.push(e.data);
          }
        };

        recorder.start(100); // 100ms slices
        setIsRecording(true);

        // Setup timer
        timerIntervalRef.current = setInterval(() => {
          setElapsedSeconds((prev) => prev + 1);
        }, 1000);

        // Setup Web Audio API Analyser for live equalizer visualization
        try {
          const AudioContext = window.AudioContext || window.webkitAudioContext;
          if (AudioContext) {
            const audioCtx = new AudioContext();
            audioContextRef.current = audioCtx;
            const source = audioCtx.createMediaStreamSource(stream);
            const analyser = audioCtx.createAnalyser();
            analyser.fftSize = 64;
            source.connect(analyser);
            analyserRef.current = analyser;

            const bufferLength = analyser.frequencyBinCount;
            const dataArray = new Uint8Array(bufferLength);

            const updateVisualizer = () => {
              if (!analyserRef.current) return;
              analyserRef.current.getByteFrequencyData(dataArray);

              // Map first 24 bins to bar heights
              const bars = [];
              for (let i = 0; i < 24; i++) {
                const val = dataArray[i] || 0;
                // Scale from 10% to 100%
                const height = Math.max(10, Math.min(100, Math.round((val / 255) * 90 + 10)));
                bars.push(height);
              }
              setAudioLevels(bars);
              animFrameRef.current = requestAnimationFrame(updateVisualizer);
            };

            updateVisualizer();
          }
        } catch (audioErr) {
          console.warn('[Web Audio Analyser Warning]:', audioErr.message);
        }
      } catch (err) {
        console.error('[Microphone Access Error]:', err);
        setMicError(err.name === 'NotAllowedError' ? 'Microphone permission denied. Please allow microphone access.' : err.message || 'Failed to access microphone');
      }
    };

    startRecording();

    return () => {
      isMounted = false;
      cleanupRecording();
    };
  }, []);

  const cleanupRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current);
      animFrameRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    if (audioContextRef.current && audioContextRef.current.state !== 'closed') {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
  };

  const togglePauseResume = () => {
    if (!mediaRecorderRef.current) return;
    if (isPaused) {
      mediaRecorderRef.current.resume();
      setIsPaused(false);
      timerIntervalRef.current = setInterval(() => {
        setElapsedSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      mediaRecorderRef.current.pause();
      setIsPaused(true);
      if (timerIntervalRef.current) {
        clearInterval(timerIntervalRef.current);
      }
    }
  };

  const handleCancel = () => {
    cleanupRecording();
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    onCancel();
  };

  const handleStopAndSend = async () => {
    if (!mediaRecorderRef.current || isSubmitting) return;

    setIsSubmitting(true);
    const duration = Math.max(1, elapsedSeconds);

    const recorder = mediaRecorderRef.current;

    recorder.onstop = async () => {
      cleanupRecording();
      const mimeType = recorder.mimeType || 'audio/webm';
      const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });

      let ext = '.webm';
      if (mimeType.includes('mp4')) ext = '.mp4';
      else if (mimeType.includes('ogg')) ext = '.ogg';

      const file = new File([audioBlob], `voice-message-${Date.now()}${ext}`, {
        type: mimeType,
      });

      try {
        await onSendVoice({ file, duration });
      } catch (err) {
        console.error('Failed to send voice message:', err);
      } finally {
        setIsSubmitting(false);
      }
    };

    recorder.stop();
  };

  const formatTimer = (secs) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  if (micError) {
    return (
      <div className="p-3 bg-rose-50 dark:bg-rose-950/80 border-t border-rose-200 dark:border-rose-900 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300">
        <div className="flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span>{micError}</span>
        </div>
        <button
          onClick={handleCancel}
          className="px-3 py-1 rounded-xl bg-rose-200 dark:bg-rose-900 hover:bg-rose-300 dark:hover:bg-rose-800 text-rose-900 dark:text-rose-100 font-semibold"
        >
          Dismiss
        </button>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 bg-white dark:bg-slate-900 border-t border-slate-200/80 dark:border-slate-800 flex items-center justify-between space-x-3 text-xs animate-in fade-in slide-in-from-bottom-2 duration-150">
      {/* Recording Indicator & Timer */}
      <div className="flex items-center space-x-2.5 flex-shrink-0">
        <div className="relative flex items-center justify-center">
          <span className={`w-3 h-3 rounded-full bg-rose-500 ${isPaused ? '' : 'animate-ping opacity-75'}`} />
          <span className="absolute w-2.5 h-2.5 rounded-full bg-rose-600" />
        </div>
        <span className="font-mono font-bold text-sm text-slate-800 dark:text-slate-100 min-w-[42px]">
          {formatTimer(elapsedSeconds)}
        </span>
      </div>

      {/* Live Equalizer Waveform */}
      <div className="flex-1 flex items-center justify-center h-8 px-2 gap-1 overflow-hidden">
        {audioLevels.map((lvl, idx) => (
          <span
            key={idx}
            style={{ height: isPaused ? '10%' : `${lvl}%` }}
            className={`w-1 rounded-full transition-all duration-75 ${
              isPaused
                ? 'bg-slate-300 dark:bg-slate-600'
                : 'bg-rose-500/80 dark:bg-rose-400'
            }`}
          />
        ))}
      </div>

      {/* Recording Action Controls */}
      <div className="flex items-center space-x-2 flex-shrink-0">
        {/* Discard / Delete */}
        <button
          type="button"
          onClick={handleCancel}
          disabled={isSubmitting}
          className="p-2 rounded-xl text-slate-400 hover:text-rose-600 dark:hover:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/50 transition-colors"
          title="Discard recording"
        >
          <Trash2 className="w-5 h-5" />
        </button>

        {/* Pause / Resume */}
        <button
          type="button"
          onClick={togglePauseResume}
          disabled={isSubmitting}
          className="p-2 rounded-xl text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          title={isPaused ? 'Resume recording' : 'Pause recording'}
        >
          {isPaused ? <Play className="w-5 h-5" /> : <Pause className="w-5 h-5" />}
        </button>

        {/* Send Voice Message */}
        <button
          type="button"
          onClick={handleStopAndSend}
          disabled={isSubmitting || elapsedSeconds < 1}
          className="p-2.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-500/20 transition-all hover:scale-105 active:scale-95 disabled:opacity-50"
          title="Send voice message"
        >
          {isSubmitting ? (
            <Loader2 className="w-5 h-5 animate-spin" />
          ) : (
            <Send className="w-5 h-5" />
          )}
        </button>
      </div>
    </div>
  );
};

export default VoiceRecorderBar;
