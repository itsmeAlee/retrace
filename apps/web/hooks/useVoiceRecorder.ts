"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type RecorderState = "idle" | "recording" | "stopped";

function bestMimeType() {
  if (typeof MediaRecorder === "undefined") return "";
  const candidates = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return candidates.find((type) => MediaRecorder.isTypeSupported(type)) ?? "";
}

export function useVoiceRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<BlobPart[]>([]);
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const amplitudeTimerRef = useRef<number | null>(null);
  const durationTimerRef = useRef<number | null>(null);
  const startedAtRef = useRef(0);
  const [state, setState] = useState<RecorderState>("idle");
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioDuration, setAudioDuration] = useState(0);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [amplitudes, setAmplitudes] = useState<number[]>(Array.from({ length: 20 }, () => 0.12));

  const stopMeters = useCallback(() => {
    if (amplitudeTimerRef.current) window.clearInterval(amplitudeTimerRef.current);
    if (durationTimerRef.current) window.clearInterval(durationTimerRef.current);
    amplitudeTimerRef.current = null;
    durationTimerRef.current = null;
    void audioContextRef.current?.close().catch(() => undefined);
    audioContextRef.current = null;
    analyserRef.current = null;
  }, []);

  const reset = useCallback(() => {
    recorderRef.current = null;
    chunksRef.current = [];
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    stopMeters();
    setState("idle");
    setAudioBlob(null);
    setAudioDuration(0);
    setAmplitudes(Array.from({ length: 20 }, () => 0.12));
    setAudioUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      return null;
    });
  }, [stopMeters]);

  const startRecording = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      throw new Error("Voice recording is not supported in this browser.");
    }

    reset();
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    streamRef.current = stream;
    const mimeType = bestMimeType();
    const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
    recorderRef.current = recorder;
    chunksRef.current = [];

    recorder.ondataavailable = (event) => {
      if (event.data.size > 0) chunksRef.current.push(event.data);
    };
    recorder.onstop = () => {
      stopMeters();
      const blob = new Blob(chunksRef.current, { type: recorder.mimeType || mimeType || "audio/webm" });
      setAudioBlob(blob);
      setAudioUrl(URL.createObjectURL(blob));
      setAudioDuration(Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)));
      stream.getTracks().forEach((track) => track.stop());
      setState("stopped");
    };

    const AudioContextCtor = window.AudioContext || (window as typeof window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AudioContextCtor) {
      const audioContext = new AudioContextCtor();
      const analyser = audioContext.createAnalyser();
      analyser.fftSize = 64;
      audioContext.createMediaStreamSource(stream).connect(analyser);
      audioContextRef.current = audioContext;
      analyserRef.current = analyser;
      const data = new Uint8Array(analyser.frequencyBinCount);
      amplitudeTimerRef.current = window.setInterval(() => {
        analyser.getByteFrequencyData(data);
        const chunks = Array.from({ length: 20 }, (_, index) => {
          const value = data[index % data.length] ?? 0;
          return Math.max(0.12, Math.min(1, value / 255));
        });
        setAmplitudes(chunks);
      }, 100);
    }

    startedAtRef.current = Date.now();
    durationTimerRef.current = window.setInterval(() => setAudioDuration(Math.round((Date.now() - startedAtRef.current) / 1000)), 1000);
    recorder.start();
    setState("recording");
  }, [reset, stopMeters]);

  const stopRecording = useCallback(() => {
    if (recorderRef.current?.state === "recording") recorderRef.current.stop();
  }, []);

  useEffect(() => reset, [reset]);

  return { state, audioBlob, audioDuration, audioUrl, amplitudes, startRecording, stopRecording, reset };
}

