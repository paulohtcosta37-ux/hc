import React, { useEffect, useRef, useState } from 'react';
import {
  Play,
  Pause,
  RotateCcw,
  RotateCw,
  Volume2,
  VolumeX,
  Download,
  Gauge,
  Sparkles,
  Music,
  Share2,
  Check,
  FileText,
  Flame,
  Cpu,
} from 'lucide-react';
import { EngineType } from '../types';

interface AudioPlayerProps {
  audioBase64: string;
  mimeType?: string;
  durationSec?: number;
  textSnippet?: string;
  voiceName?: string;
  accentName?: string;
  stylesUsed?: string[];
  chunksProcessed?: number;
  engineUsed?: EngineType;
  fellBackFromGemini?: boolean;
  fallbackReason?: string;
  subtitlesSrt?: string;
  playbackRate: number;
  onPlaybackRateChange: (rate: number) => void;
}

const SPEED_PRESETS = [0.5, 0.75, 1.0, 1.25, 1.5, 1.75, 2.0];

export const AudioPlayer: React.FC<AudioPlayerProps> = ({
  audioBase64,
  mimeType = 'audio/mpeg',
  durationSec = 0,
  textSnippet,
  voiceName,
  accentName,
  stylesUsed = [],
  chunksProcessed = 1,
  engineUsed = 'unlimited',
  fellBackFromGemini = false,
  fallbackReason,
  subtitlesSrt,
  playbackRate,
  onPlaybackRateChange,
}) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(durationSec || 0);
  const [volume, setVolume] = useState(1.0);
  const [isMuted, setIsMuted] = useState(false);
  const [audioUrl, setAudioUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [copiedSrt, setCopiedSrt] = useState(false);

  // Convert base64 to Blob URL
  useEffect(() => {
    if (!audioBase64) {
      setAudioUrl('');
      return;
    }

    try {
      const byteCharacters = atob(audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: mimeType });
      const url = URL.createObjectURL(blob);
      setAudioUrl(url);
      setCurrentTime(0);
      setIsPlaying(false);

      return () => {
        URL.revokeObjectURL(url);
      };
    } catch (e) {
      console.error('Erro ao converter base64 em áudio:', e);
    }
  }, [audioBase64, mimeType]);

  // Keep playback rate in sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackRate;
    }
  }, [playbackRate, audioUrl]);

  // Keep volume in sync
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.volume = isMuted ? 0 : volume;
    }
  }, [volume, isMuted]);

  const togglePlay = () => {
    if (!audioRef.current) return;
    if (isPlaying) {
      audioRef.current.pause();
    } else {
      audioRef.current.play().catch((err) => console.error('Erro ao reproduzir áudio:', err));
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      setCurrentTime(audioRef.current.currentTime);
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current) {
      const audioDuration = audioRef.current.duration;
      if (Number.isFinite(audioDuration) && audioDuration > 0) {
        setDuration(audioDuration);
      }
      audioRef.current.playbackRate = playbackRate;
    }
  };

  const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
    const time = parseFloat(e.target.value);
    setCurrentTime(time);
    if (audioRef.current) {
      audioRef.current.currentTime = time;
    }
  };

  const handleSkip = (seconds: number) => {
    if (!audioRef.current) return;
    const newTime = Math.max(0, Math.min(duration, audioRef.current.currentTime + seconds));
    audioRef.current.currentTime = newTime;
    setCurrentTime(newTime);
  };

  const handleDownloadAudio = (format: 'mp3' | 'wav') => {
    if (!audioUrl) return;
    const a = document.createElement('a');
    a.href = audioUrl;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const safeVoice = (voiceName || 'voz').replace(/[^a-zA-Z0-9_-]/g, '_');
    a.download = `audio-${safeVoice}-${timestamp}.${format}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const handleDownloadSrt = () => {
    if (!subtitlesSrt) return;
    const blob = new Blob([subtitlesSrt], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    a.download = `legendas-${timestamp}.srt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    setCopiedSrt(true);
    setTimeout(() => setCopiedSrt(false), 2000);
  };

  const handleCopyText = () => {
    if (textSnippet) {
      navigator.clipboard.writeText(textSnippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const progressPercent = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div
      id="audio-player-card"
      className="bg-[#121212] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5 relative overflow-hidden"
    >
      <audio
        ref={audioRef}
        src={audioUrl}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onPlay={() => setIsPlaying(true)}
        onPause={() => setIsPlaying(false)}
        onEnded={() => {
          setIsPlaying(false);
          setCurrentTime(0);
        }}
      />

      {/* Fallback Banner if Gemini redirected to Unlimited */}
      {fellBackFromGemini && (
        <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl text-xs text-amber-200 flex items-start gap-2.5">
          <Flame className="w-4 h-4 text-amber-400 shrink-0 mt-0.5" />
          <div>
            <strong className="text-amber-300">Proteção de Cota Ativa:</strong> {fallbackReason || 'Áudio sintetizado com sucesso no Motor Neural Ilimitado.'}
          </div>
        </div>
      )}

      {/* Header Info */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20 shadow-sm">
            <Music className="w-5 h-5" />
          </span>
          <div>
            <h3 className="font-bold text-gray-100 text-sm sm:text-base flex flex-wrap items-center gap-2">
              <span>Reprodução de Áudio Neural</span>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 text-[10px] font-bold rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 uppercase tracking-wider">
                <Sparkles className="w-3 h-3" /> 24kHz HD
              </span>
              <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full border tracking-wide ${
                engineUsed === 'unlimited'
                  ? 'bg-blue-500/10 text-blue-400 border-blue-500/30'
                  : 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30'
              }`}>
                {engineUsed === 'unlimited' ? '🚀 Ilimitado' : '⚡ Gemini AI'}
              </span>
              {chunksProcessed > 1 && (
                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-bold rounded-full bg-purple-500/10 text-purple-300 border border-purple-500/30">
                  {chunksProcessed} blocos unidos
                </span>
              )}
            </h3>
            <div className="flex flex-wrap items-center gap-2 text-xs text-gray-400 mt-1">
              {voiceName && (
                <span>
                  Voz: <strong className="text-gray-200">{voiceName}</strong>
                </span>
              )}
              {accentName && accentName !== 'padrao' && (
                <>
                  <span className="text-gray-600">•</span>
                  <span>
                    Sotaque: <strong className="text-blue-400 capitalize">{accentName}</strong>
                  </span>
                </>
              )}
              {stylesUsed.length > 0 && (
                <>
                  <span className="text-gray-600">•</span>
                  <span>
                    Estilo: <strong className="text-gray-300">{stylesUsed.join(', ')}</strong>
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons: Copy, SRT, Download */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            id="btn-copy-text"
            onClick={handleCopyText}
            title="Copiar texto original"
            className="px-3 py-2 rounded-xl text-gray-400 hover:text-gray-200 bg-white/5 border border-white/10 hover:bg-white/10 transition text-xs flex items-center gap-1.5 cursor-pointer font-medium"
          >
            {copied ? <Check className="w-4 h-4 text-emerald-400" /> : <Share2 className="w-4 h-4" />}
            <span>{copied ? 'Copiado!' : 'Copiar Texto'}</span>
          </button>

          {subtitlesSrt && (
            <button
              id="btn-download-srt"
              onClick={handleDownloadSrt}
              title="Baixar legendas sincronizadas (.SRT)"
              className="px-3 py-2 rounded-xl text-gray-300 hover:text-white bg-white/5 border border-white/10 hover:bg-white/10 transition text-xs flex items-center gap-1.5 cursor-pointer font-medium"
            >
              {copiedSrt ? <Check className="w-4 h-4 text-emerald-400" /> : <FileText className="w-4 h-4 text-purple-400" />}
              <span>Legendas (.SRT)</span>
            </button>
          )}

          <button
            id="btn-download-audio"
            onClick={() => handleDownloadAudio(mimeType.includes('wav') ? 'wav' : 'mp3')}
            title="Baixar áudio"
            className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-xs flex items-center gap-2 shadow-lg shadow-blue-600/20 transition cursor-pointer border border-blue-400/30 active:scale-95"
          >
            <Download className="w-4 h-4" />
            <span>Baixar {mimeType.includes('wav') ? 'WAV' : 'MP3'}</span>
          </button>
        </div>
      </div>

      {/* Animated Waveform Visualizer */}
      <div
        id="waveform-container"
        className="h-20 bg-black/50 rounded-xl px-4 sm:px-6 py-3 flex items-center justify-between gap-1 overflow-hidden border border-white/5 shadow-inner"
      >
        {Array.from({ length: 48 }).map((_, idx) => {
          const barProgress = (idx / 48) * 100;
          const isPassed = barProgress <= progressPercent;
          const pseudoFreq = Math.sin(idx * 0.45 + (isPlaying ? currentTime * 7 : 0));
          const baseHeight = 12 + Math.abs(pseudoFreq) * (isPlaying ? 78 : 22);

          return (
            <div
              key={idx}
              className={`w-1 sm:w-1.5 rounded-full transition-all duration-150 ${
                isPassed
                  ? isPlaying
                    ? 'bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.7)]'
                    : 'bg-blue-500/80'
                  : 'bg-white/10'
              }`}
              style={{
                height: `${Math.max(10, Math.min(95, baseHeight))}%`,
              }}
            />
          );
        })}
      </div>

      {/* Progress & Time Slider */}
      <div className="space-y-2">
        <div className="relative flex items-center">
          <input
            id="audio-progress-bar"
            type="range"
            min={0}
            max={duration || 1}
            step={0.05}
            value={currentTime}
            onChange={handleSeek}
            className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500 focus:outline-none"
          />
        </div>
        <div className="flex justify-between text-xs font-mono text-gray-400 font-semibold">
          <span className="text-blue-400">{formatTime(currentTime)}</span>
          <span>{formatTime(duration)}</span>
        </div>
      </div>

      {/* Main Playback Controls & Speed */}
      <div className="flex flex-wrap items-center justify-between gap-4 pt-2 border-t border-white/5">
        {/* Play / Skip Buttons */}
        <div className="flex items-center gap-3">
          <button
            id="btn-skip-back-5s"
            onClick={() => handleSkip(-5)}
            title="Voltar 5 segundos"
            className="p-2.5 text-gray-400 hover:text-gray-200 hover:bg-white/10 bg-white/5 border border-white/5 rounded-xl transition cursor-pointer"
          >
            <RotateCcw className="w-4 h-4" />
          </button>

          <button
            id="btn-play-pause-audio"
            onClick={togglePlay}
            className="w-14 h-14 flex items-center justify-center rounded-2xl bg-blue-600 hover:bg-blue-500 text-white shadow-xl shadow-blue-600/25 active:scale-95 transition border border-blue-400/30 cursor-pointer"
            title={isPlaying ? 'Pausar reprodução' : 'Iniciar reprodução'}
          >
            {isPlaying ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6 ml-0.5" />}
          </button>

          <button
            id="btn-skip-forward-5s"
            onClick={() => handleSkip(5)}
            title="Avançar 5 segundos"
            className="p-2.5 text-gray-400 hover:text-gray-200 hover:bg-white/10 bg-white/5 border border-white/5 rounded-xl transition cursor-pointer"
          >
            <RotateCw className="w-4 h-4" />
          </button>
        </div>

        {/* Speed Controls (0.5x to 2x) */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-2">
          <div className="flex items-center gap-1.5 text-[11px] uppercase tracking-wider text-gray-400 font-bold">
            <Gauge className="w-3.5 h-3.5 text-blue-400" />
            <span>Velocidade:</span>
          </div>
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-xl">
            {SPEED_PRESETS.map((preset) => {
              const isSelected = Math.abs(playbackRate - preset) < 0.01;
              return (
                <button
                  key={preset}
                  id={`btn-speed-${preset}x`}
                  onClick={() => onPlaybackRateChange(preset)}
                  className={`px-2.5 py-1 text-xs font-semibold rounded-lg transition whitespace-nowrap cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25 font-bold'
                      : 'text-gray-400 hover:text-gray-200 hover:bg-white/5'
                  }`}
                >
                  {preset}x
                </button>
              );
            })}
          </div>
        </div>

        {/* Volume Control */}
        <div className="flex items-center gap-2.5 text-gray-400 bg-white/5 border border-white/5 px-3 py-1.5 rounded-xl">
          <button
            id="btn-toggle-mute"
            onClick={() => setIsMuted(!isMuted)}
            title={isMuted ? 'Ativar som' : 'Desativar som'}
            className="p-1 hover:text-gray-200 rounded-lg transition cursor-pointer"
          >
            {isMuted || volume === 0 ? <VolumeX className="w-4 h-4 text-rose-400" /> : <Volume2 className="w-4 h-4 text-blue-400" />}
          </button>
          <input
            id="volume-slider"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={isMuted ? 0 : volume}
            onChange={(e) => {
              const val = parseFloat(e.target.value);
              setVolume(val);
              setIsMuted(val === 0);
            }}
            className="w-16 sm:w-20 h-1.5 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
          />
        </div>
      </div>
    </div>
  );
};
