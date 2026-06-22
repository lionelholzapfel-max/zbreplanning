'use client';

import { useState, useRef, useEffect } from 'react';

interface DrereSpeechProps {
  date: string; // YYYY-MM-DD
  isDrere: boolean; // Is the current user the Drère?
  drereName: string;
}

export function DrereSpeech({ date, isDrere, drereName }: DrereSpeechProps) {
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordingTime, setRecordingTime] = useState(0);
  const [isUploading, setIsUploading] = useState(false);
  const [hasRecorded, setHasRecorded] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  const MAX_DURATION = 15; // 15 seconds max

  // Load existing speech
  useEffect(() => {
    async function loadSpeech() {
      try {
        const res = await fetch(`/api/drere-speech?date=${date}`);
        if (res.ok) {
          const data = await res.json();
          if (data.speech?.audio_url) {
            setAudioUrl(data.speech.audio_url);
            setHasRecorded(true);
          }
        }
      } catch (error) {
        console.error('Error loading speech:', error);
      }
    }

    loadSpeech();
  }, [date]);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const mediaRecorder = new MediaRecorder(stream);
      mediaRecorderRef.current = mediaRecorder;
      audioChunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        const url = URL.createObjectURL(audioBlob);
        setAudioUrl(url);

        // Upload
        await uploadSpeech(audioBlob);

        // Stop all tracks
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorder.start();
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

    } catch (error) {
      console.error('Error starting recording:', error);
      alert('Impossible d\'accéder au micro');
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop();
      setIsRecording(false);
      if (timerRef.current) {
        clearInterval(timerRef.current);
      }
    }
  };

  const uploadSpeech = async (audioBlob: Blob) => {
    setIsUploading(true);
    try {
      const formData = new FormData();
      formData.append('audio', audioBlob, 'speech.webm');
      formData.append('date', date);

      const res = await fetch('/api/drere-speech', {
        method: 'POST',
        body: formData,
      });

      if (res.ok) {
        setHasRecorded(true);
      } else {
        const data = await res.json();
        alert(data.error || 'Erreur upload');
      }
    } catch (error) {
      console.error('Error uploading:', error);
      alert('Erreur upload');
    } finally {
      setIsUploading(false);
    }
  };

  const playAudio = () => {
    if (!audioUrl) return;

    if (!audioRef.current) {
      audioRef.current = new Audio(audioUrl);
      audioRef.current.onended = () => setIsPlaying(false);
    }

    if (isPlaying) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      setIsPlaying(false);
    } else {
      audioRef.current.play();
      setIsPlaying(true);
    }
  };

  // If there's a speech, show play button
  if (audioUrl && hasRecorded) {
    return (
      <div className="flex items-center gap-3 mt-3 p-3 bg-black/20 rounded-xl border border-[#fbbf24]/20">
        <button
          onClick={playAudio}
          className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
            isPlaying
              ? 'bg-red-500 hover:bg-red-600'
              : 'bg-[#fbbf24] hover:bg-[#f59e0b]'
          }`}
        >
          {isPlaying ? (
            <span className="text-white text-lg">⏹</span>
          ) : (
            <span className="text-black text-lg">▶</span>
          )}
        </button>
        <div className="flex-1">
          <p className="text-sm text-white font-medium">🎤 Discours du Drère</p>
          <p className="text-xs text-gray-400">"{drereName} a quelque chose à dire..."</p>
        </div>
        {isDrere && (
          <button
            onClick={() => {
              setAudioUrl(null);
              setHasRecorded(false);
            }}
            className="text-xs text-gray-500 hover:text-red-400 transition-colors"
          >
            Refaire
          </button>
        )}
      </div>
    );
  }

  // If user is Drère and hasn't recorded yet, show record button
  if (isDrere && !hasRecorded) {
    return (
      <div className="mt-3 p-3 bg-black/20 rounded-xl border border-[#fbbf24]/20">
        {isRecording ? (
          <div className="flex items-center gap-3">
            <button
              onClick={stopRecording}
              className="w-12 h-12 rounded-full bg-red-500 hover:bg-red-600 flex items-center justify-center animate-pulse"
            >
              <span className="text-white text-xl">⏹</span>
            </button>
            <div className="flex-1">
              <p className="text-sm text-red-400 font-medium">🔴 Enregistrement...</p>
              <p className="text-xs text-gray-400">{recordingTime}s / {MAX_DURATION}s</p>
            </div>
            <div className="w-24 h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-red-500 transition-all"
                style={{ width: `${(recordingTime / MAX_DURATION) * 100}%` }}
              />
            </div>
          </div>
        ) : isUploading ? (
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border-2 border-[#fbbf24] border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-400">Sauvegarde du discours...</p>
          </div>
        ) : (
          <div className="flex items-center gap-3">
            <button
              onClick={startRecording}
              className="w-12 h-12 rounded-full bg-[#fbbf24] hover:bg-[#f59e0b] flex items-center justify-center transition-all hover:scale-110"
            >
              <span className="text-black text-xl">🎤</span>
            </button>
            <div className="flex-1">
              <p className="text-sm text-white font-medium">Tu es le Drère ! 👑</p>
              <p className="text-xs text-gray-400">Enregistre ton discours de victoire (max {MAX_DURATION}s)</p>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Not Drère and no speech recorded
  return null;
}
