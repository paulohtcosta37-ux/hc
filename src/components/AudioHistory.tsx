import React, { useState } from 'react';
import {
  History,
  Play,
  Trash2,
  Volume2,
  Calendar,
  Clock,
  Music,
  Download,
  Flame,
  Sparkles,
  Zap,
} from 'lucide-react';
import { ConversionHistoryItem } from '../types';

interface AudioHistoryProps {
  history: ConversionHistoryItem[];
  onSelectHistoryItem: (item: ConversionHistoryItem) => void;
  onClearHistory: () => void;
  onDeleteItem: (id: string) => void;
}

export const AudioHistory: React.FC<AudioHistoryProps> = ({
  history,
  onSelectHistoryItem,
  onClearHistory,
  onDeleteItem,
}) => {
  const [filterEngine, setFilterEngine] = useState<'all' | 'unlimited' | 'gemini'>('all');

  if (!history || history.length === 0) {
    return null;
  }

  const filteredHistory = history.filter((item) => {
    if (filterEngine === 'all') return true;
    return item.engine === filterEngine;
  });

  const formatDate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const handleDownload = (item: ConversionHistoryItem) => {
    try {
      const byteCharacters = atob(item.audioBase64);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const ext = (item.mimeType || '').includes('wav') ? 'wav' : 'mp3';
      const blob = new Blob([byteArray], { type: item.mimeType || 'audio/mpeg' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audio-${item.voice}-${item.id}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch (e) {
      console.error('Erro ao baixar áudio do histórico:', e);
    }
  };

  return (
    <div
      id="audio-history-card"
      className="bg-[#121212] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-white/5 pb-4">
        <div className="flex items-center gap-2.5">
          <span className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <History className="w-4 h-4" />
          </span>
          <div>
            <h3 className="font-bold text-gray-200 text-sm sm:text-base flex items-center gap-2">
              <span>Histórico de Áudios Sintetizados</span>
              <span className="px-2 py-0.5 text-[10px] font-mono font-bold rounded-full bg-white/10 text-gray-300">
                {history.length}
              </span>
            </h3>
            <p className="text-[11px] text-gray-500">
              Salvo localmente no navegador para acesso rápido
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Filter */}
          <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-lg text-xs">
            <button
              onClick={() => setFilterEngine('all')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                filterEngine === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Todos
            </button>
            <button
              onClick={() => setFilterEngine('unlimited')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                filterEngine === 'unlimited' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Ilimitado
            </button>
            <button
              onClick={() => setFilterEngine('gemini')}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                filterEngine === 'gemini' ? 'bg-indigo-600 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              Gemini
            </button>
          </div>

          <button
            id="btn-clear-history"
            onClick={onClearHistory}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1.5 font-medium px-3 py-1.5 rounded-xl bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer"
          >
            <Trash2 className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Limpar Tudo</span>
          </button>
        </div>
      </div>

      {/* List */}
      <div className="space-y-2.5 max-h-96 overflow-y-auto pr-1 scrollbar-thin">
        {filteredHistory.map((item) => (
          <div
            key={item.id}
            id={`history-item-${item.id}`}
            onClick={() => onSelectHistoryItem(item)}
            className="p-3.5 rounded-xl bg-white/5 border border-white/5 hover:border-blue-500/40 hover:bg-white/10 transition-all flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 cursor-pointer group"
          >
            <div className="space-y-1.5 flex-1 min-w-0">
              <p className="text-xs text-gray-200 font-medium line-clamp-1 group-hover:text-blue-300 transition">
                "{item.text}"
              </p>

              <div className="flex flex-wrap items-center gap-2 text-[11px] text-gray-400">
                <span className={`inline-flex items-center gap-1 px-2 py-0.2 rounded-md font-semibold text-[10px] border ${
                  item.engine === 'unlimited'
                    ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                    : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                }`}>
                  {item.engine === 'unlimited' ? <Flame className="w-3 h-3 text-amber-400" /> : <Sparkles className="w-3 h-3 text-indigo-300" />}
                  {item.engine === 'unlimited' ? 'Neural Ilimitado' : 'Gemini AI'}
                </span>

                <span>Voz: <strong className="text-gray-300">{item.voice}</strong></span>

                {item.accent && item.accent !== 'padrao' && (
                  <>
                    <span className="text-gray-600">•</span>
                    <span>Sotaque: <strong className="text-blue-400 capitalize">{item.accent}</strong></span>
                  </>
                )}

                <span className="text-gray-600">•</span>
                <span className="flex items-center gap-1 text-gray-500">
                  <Clock className="w-3 h-3" />
                  {item.durationSec ? `${item.durationSec.toFixed(1)}s` : '0s'}
                </span>

                <span className="text-gray-600">•</span>
                <span className="text-gray-500">{formatDate(item.createdAt)}</span>
              </div>
            </div>

            <div className="flex items-center gap-1.5 self-end sm:self-center shrink-0">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  handleDownload(item);
                }}
                title="Baixar áudio"
                className="p-2 text-gray-400 hover:text-blue-400 hover:bg-white/10 rounded-lg transition cursor-pointer"
              >
                <Download className="w-4 h-4" />
              </button>

              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onDeleteItem(item.id);
                }}
                title="Excluir do histórico"
                className="p-2 text-gray-500 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition cursor-pointer"
              >
                <Trash2 className="w-4 h-4" />
              </button>

              <button
                onClick={() => onSelectHistoryItem(item)}
                title="Ouvir áudio"
                className="px-3 py-1.5 bg-blue-600/30 hover:bg-blue-600 border border-blue-500/50 text-blue-300 hover:text-white rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer shadow-sm"
              >
                <Play className="w-3.5 h-3.5 ml-0.5" />
                <span>Ouvir</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
