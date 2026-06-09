'use client';

import { useState, useRef, useCallback } from 'react';

type RecorderState = 'idle' | 'recording' | 'stopped';

const DEFAULT_MAX_DURATION = 120; // 2 minutes

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/mp4',
  ];
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return '';
}

export function useAudioRecorder(maxDuration = DEFAULT_MAX_DURATION) {
  const [state, setState] = useState<RecorderState>('idle');
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const recorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const cleanup = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    recorderRef.current = null;
  }, []);

  const start = useCallback(async () => {
    setError(null);
    setAudioBlob(null);
    setElapsedSeconds(0);
    chunksRef.current = [];

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      recorderRef.current = recorder;

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType,
        });
        setAudioBlob(blob);
        setState('stopped');
        cleanup();
      };

      recorder.start(1000); // collect chunks every second
      setState('recording');

      let seconds = 0;
      timerRef.current = setInterval(() => {
        seconds++;
        setElapsedSeconds(seconds);
        if (seconds >= maxDuration) {
          recorder.stop();
        }
      }, 1000);
    } catch (err) {
      cleanup();
      setState('idle');
      if (err instanceof DOMException && err.name === 'NotAllowedError') {
        setError('Microphone permission denied. Please allow mic access and try again.');
      } else {
        setError('Could not access microphone.');
      }
    }
  }, [cleanup]);

  const stop = useCallback(() => {
    if (recorderRef.current && recorderRef.current.state === 'recording') {
      recorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setAudioBlob(null);
    setElapsedSeconds(0);
    setError(null);
    chunksRef.current = [];
  }, [cleanup]);

  return { start, stop, reset, audioBlob, state, elapsedSeconds, error };
}
