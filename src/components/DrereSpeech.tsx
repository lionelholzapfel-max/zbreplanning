'use client';

import { useState, useRef, useEffect } from 'react';
import { Mic } from 'lucide-react';

interface DrereSpeechProps {
  date: string; // YYYY-MM-DD
  drereUserId: string; // the specific Drère this slot is for
  drereName: string;
  isMe: boolean; // is the current user this Drère?
}

export function DrereSpeech({ date, drereUserId, drereName, isMe }: DrereSpeechProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);
  const [isSupported, setIsSupported] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const MAX_DURATION = 15; // 15 seconds max

  // Check if MediaRecorder is supported
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const supported = !!(navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function' && typeof window.MediaRecorder !== 'undefined');
      setIsSupported(supported);
    }
  }, []);

  // Load THIS Drère's existing speech (several Drères tied → several speeches)
  useEffect(() => {
    async function loadSpeech() {
      try {
        const res = await fetch(`/api/drere-speech?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          const mine = (data.speeches || []).find(
            (s: { user_id: string; audio_url?: string }) => s.user_id === drereUserId
          );
          if (mine?.audio_url) {
            setAudioUrl(mine.audio_url);
            setHasRecorded(true);
          } else {
            setAudioUrl(null);
            setHasRecorded(false);
          }
        }
      } catch (error) {
        console.error('Error loading speech:', error);
      }
    }

    loadSpeech();
  }, [date, drereUserId]);

  // Get supported MIME type
  const getSupportedMimeType = (): string => {
    const types = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/mp4',
      'audio/ogg',
      'audio/wav',
    ];

    for (const type of types) {
      if (MediaRecorder.isTypeSupported(type)) {
        return type;
      }
    }
    return 'audio/webm'; // fallback
  };

  const startRecording = async () => {
    setError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
        }
      });
      streamRef.current = stream;

      const mimeType = getSupportedMimeType();
      const mediaRecorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Upload
        await uploadSpeech(audioBlob, mimeType);

        // Stop all tracks
        if (streamRef.current) {
          streamRef.current.getTracks().forEach(track => track.stop());
        }
      };

      mediaRecorder.onerror = (event) => {
        console.error('MediaRecorder error:', event);
        setError('Erreur d\'enregistrement');
        setIsRecording(false);
      };

      mediaRecorder.start(1000); // Collect data every second for iOS compatibility
      setIsRecording(true);
      setRecordingTime(0);

      // Timer
      timerRef.current = setInterval(() => {
        setRecordingTime(prev => {
          if (prev >= MAX_DURATION - 1) {
            stopRecording();
            return MAX_DURATION;
          }
          return prev + 1;
        });
      }, 1000);

    } catch (error: any) {
      console.error('Error starting recording:', error);
      if (error.name === 'NotAllowedError') {
        setError('Accès au micro refusé. Autorise le micro dans les paramètres.');
      } else if (error.name === 'NotFoundError') {
        setError('Aucun micro trouvé.');
      } else {
        setError('Impossible d\'accéder au micro');
      }
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const uploadSpeech = async (audioBlob: Blob, mimeType: string) => {
    setIsUploading(true);
    try {
      const extension = mimeType.includes('mp4') ? 'mp4' : mimeType.includes('ogg') ? 'ogg' : 'webm';
      const formData = new FormData();
      formData.append('audio', audioBlob, `speech.${extension}`);
      formData.append('date', date);

      const res = await fetch('/api/drere-speech', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setHasRecorded(true);
      } else {
        const data = await res.json();
        setError(data.error || 'Erreur upload');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      setError('Erreur upload');
    } finally {
      setIsUploading(false);
    }
  };

  const playAudio = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
      audioRef.current.onerror = () => {
        setError('Impossible de lire l\'audio');
        setIsPlaying(false);
      };
    }

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play().catch(() => {
        setError('Erreur de lecture');
      });
      setIsPlaying(true);
    }
  };

  // If there's a speech, show play button
  if (audioUrl && hasRecorded) {
    return (
      <div className="flex items-center gap-3 mt-3 p-3 rounded-[10px] bg-[var(--surface-2)] top-light">
        <button
          onClick={playAudio}
          className={`w-8 h-8 rounded-full flex items-center justify-center transition-colors ${
            isPlaying ? 'bg-[var(--live)]' : 'bg-[var(--surface-3)] top-light hover:bg-[var(--surface-4)]'
          }`}
        >
          <span className={`text-sm ${isPlaying ? 'text-white' : 'text-[var(--gold)]'}`}>{isPlaying ? '⏹' : '▶'}</span>
        </button>
        <div className="flex-1">
          <p className="text-sm text-[var(--text-primary)] font-medium">Discours du Drère</p>
          <p className="text-xs text-[var(--text-tertiary)]">{drereName} a quelque chose à dire</p>
        </div>
        {isMe && (
          <button
            onClick={() => {
              setAudioUrl(null);
              setHasRecorded(false);
              if (audioRef.current) {
                audioRef.current = null;
              }
            }}
            className="text-xs text-[var(--text-tertiary)] hover:text-[var(--text-primary)] transition-colors"
          >
            Refaire
          </button>
        )}
      </div>
    );
  }

  // If user is Drère and hasn't recorded yet, show record button
  if (isMe && !hasRecorded) {
    // Check if recording is not supported
    if (!isSupported) {
      return (
        <div className="mt-3 p-3 rounded-[10px] bg-[var(--surface-2)] top-light">
          <div className="flex items-center gap-3">
            <Mic className="w-5 h-5 text-[var(--gold)]" strokeWidth={1.75} />
            <div className="flex-1">
              <p className="text-sm text-[var(--text-primary)] font-medium">Tu es le Drère</p>
              <p className="text-xs text-[var(--danger)]">L&apos;enregistrement n&apos;est pas supporté sur ce navigateur. Essaie avec Chrome ou Safari.</p>
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="mt-3 p-3 rounded-[10px] bg-[var(--surface-2)] top-light">
        {error && (
          <div className="mb-2 p-2 rounded-lg bg-[var(--danger)]/15">
            <p className="text-xs text-[var(--danger)]">{error}</p>
          </div>
        )}
        {isRecording ? (
          <div className="flex items-center gap-3">
            <button
              onClick={stopRecording}
              className="w-12 h-12 rounded-full bg-[var(--live)] flex items-center justify-center animate-pulse"
            >
              <span className="text-white text-xl">⏹</span>
            </button>
            <div className="flex-1">
              <p className="text-sm text-[var(--live)] font-medium">Enregistrement…</p>
              <p className="text-xs text-[var(--text-tertiary)] score">{recordingTime}s / {MAX_DURATION}s</p>
            </div>
            <div className="w-24 h-1.5 bg-[var(--surface-3)] rounded-full overflow-hidden">
              <div
                className="h-full bg-[var(--live)] transition-all"
                style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
              />
            </div>
          </div>
        ) : isUploading ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-[var(--gold)] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-[var(--text-secondary)]">Sauvegarde du discours…</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={startRecording}
              className="w-12 h-12 rounded-full bg-[var(--gold)] hover:opacity-90 flex items-center justify-center transition-all active:scale-95"
            >
              <Mic className="w-5 h-5 text-black" strokeWidth={2} />
            </button>
            <div className="flex-1">
              <p className="text-sm text-[var(--text-primary)] font-medium">Tu es le Drère</p>
              <p className="text-xs text-[var(--text-tertiary)]">Enregistre ton discours de victoire (max {MAX_DURATION}s)</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not Drère and no speech recorded
  return null;
}
