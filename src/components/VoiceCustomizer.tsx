import React, { useState } from 'react';
import {
  Globe,
  Tag,
  MapPin,
  Mic2,
  Sparkles,
  Sliders,
  Check,
  Plus,
  X,
  Key,
  ShieldCheck,
  Zap,
  Cpu,
  Flame,
  RotateCcw,
} from 'lucide-react';
import {
  LANGUAGES,
  BRAZILIAN_ACCENTS,
  STYLE_TAGS,
  UNLIMITED_VOICES,
  GEMINI_VOICES,
} from '../data/options';
import { EngineType, VoiceOption } from '../types';

interface VoiceCustomizerProps {
  engine: EngineType;
  onEngineChange: (engine: EngineType) => void;
  selectedLanguage: string;
  onLanguageChange: (lang: string) => void;
  selectedAccent: string;
  onAccentChange: (accent: string) => void;
  selectedStyles: string[];
  onToggleStyle: (styleId: string) => void;
  onClearStyles: () => void;
  selectedVoice: string;
  onVoiceChange: (voice: string) => void;
  pitch: number;
  onPitchChange: (pitch: number) => void;
  speed: number;
  onSpeedChange: (speed: number) => void;
  apiKey: string;
  onApiKeyChange: (key: string) => void;
  onInsertSamplePhrase?: (phrase: string) => void;
}

export const VoiceCustomizer: React.FC<VoiceCustomizerProps> = ({
  engine,
  onEngineChange,
  selectedLanguage,
  onLanguageChange,
  selectedAccent,
  onAccentChange,
  selectedStyles,
  onToggleStyle,
  onClearStyles,
  selectedVoice,
  onVoiceChange,
  pitch,
  onPitchChange,
  speed,
  onSpeedChange,
  apiKey,
  onApiKeyChange,
  onInsertSamplePhrase,
}) => {
  const [activeTab, setActiveTab] = useState<'voices' | 'accents' | 'styles' | 'prosody' | 'apikey'>('voices');
  const [accentSearch, setAccentSearch] = useState('');
  const [genderFilter, setGenderFilter] = useState<'all' | 'Feminino' | 'Masculino'>('all');

  const currentLang = LANGUAGES.find((l) => l.code === selectedLanguage) || LANGUAGES[0];
  const isBrazilianPortuguese = selectedLanguage === 'pt-BR';

  const availableVoices = engine === 'gemini' ? GEMINI_VOICES : UNLIMITED_VOICES;
  const filteredVoices = availableVoices.filter((v) => {
    if (genderFilter !== 'all' && v.gender !== genderFilter) return false;
    if (engine === 'unlimited' && v.lang && v.lang !== selectedLanguage && selectedLanguage !== 'pt-BR') {
      return v.lang === selectedLanguage;
    }
    return true;
  });

  const filteredAccents = BRAZILIAN_ACCENTS.filter(
    (a) =>
      a.name.toLowerCase().includes(accentSearch.toLowerCase()) ||
      a.region.toLowerCase().includes(accentSearch.toLowerCase()) ||
      a.description.toLowerCase().includes(accentSearch.toLowerCase())
  );

  return (
    <div
      id="voice-customizer-panel"
      className="bg-[#121212] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-5"
    >
      {/* 1. TOP ENGINE SELECTOR */}
      <div className="space-y-2">
        <label className="text-[11px] font-bold text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
          <Cpu className="w-3.5 h-3.5 text-blue-400" />
          <span>Motor de Síntese de Voz:</span>
        </label>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          {/* Unlimited Engine */}
          <button
            id="engine-btn-unlimited"
            onClick={() => {
              onEngineChange('unlimited');
              if (['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'].includes(selectedVoice)) {
                onVoiceChange('pt-BR-FranciscaNeural');
              }
            }}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              engine === 'unlimited'
                ? 'bg-blue-600/20 border-blue-500/80 ring-1 ring-blue-500/50 shadow-lg shadow-blue-600/15 text-white'
                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Flame className="w-4 h-4 text-amber-400" />
                <span>Neural Ilimitado</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 uppercase tracking-wider">
                Sem Limites
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Zero cota, 100% gratuito e sem necessidade de chave de API.
            </p>
          </button>

          {/* Gemini AI Studio */}
          <button
            id="engine-btn-gemini"
            onClick={() => {
              onEngineChange('gemini');
              if (!['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'].includes(selectedVoice)) {
                onVoiceChange('Kore');
              }
            }}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              engine === 'gemini'
                ? 'bg-indigo-600/20 border-indigo-500/80 ring-1 ring-indigo-500/50 shadow-lg shadow-indigo-600/15 text-white'
                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Sparkles className="w-4 h-4 text-indigo-400" />
                <span>Google Gemini AI</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-indigo-500/20 text-indigo-300 border border-indigo-500/30 uppercase tracking-wider">
                Auto-Fallback
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Gemini 3.1 Flash com chave própria ou chave do servidor.
            </p>
          </button>

          {/* Local Web Speech */}
          <button
            id="engine-btn-local"
            onClick={() => onEngineChange('local')}
            className={`p-3.5 rounded-xl border text-left transition-all cursor-pointer relative overflow-hidden ${
              engine === 'local'
                ? 'bg-teal-600/20 border-teal-500/80 ring-1 ring-teal-500/50 shadow-lg shadow-teal-600/15 text-white'
                : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-300'
            }`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2 font-bold text-sm">
                <Zap className="w-4 h-4 text-teal-400" />
                <span>Navegador Local</span>
              </div>
              <span className="px-2 py-0.5 text-[9px] font-bold rounded-full bg-teal-500/20 text-teal-300 border border-teal-500/30 uppercase tracking-wider">
                0ms Offline
              </span>
            </div>
            <p className="text-[11px] text-gray-400 mt-1">
              Síntese instantânea de latência zero direto no navegador.
            </p>
          </button>
        </div>
      </div>

      {/* 2. LANGUAGE SELECTOR BAR */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <span className="p-2.5 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/20">
            <Globe className="w-4 h-4" />
          </span>
          <div>
            <label htmlFor="language-select" className="text-[10px] font-bold text-gray-400 uppercase tracking-widest block">
              Idioma de Síntese
            </label>
            <div className="text-sm font-bold text-gray-200">
              {currentLang.name}
            </div>
          </div>
        </div>

        <div className="w-full sm:w-64">
          <select
            id="language-select"
            value={selectedLanguage}
            onChange={(e) => onLanguageChange(e.target.value)}
            className="w-full px-3.5 py-2 text-xs bg-[#1a1a1a] border border-white/10 rounded-xl text-gray-200 font-medium focus:ring-2 focus:ring-blue-500/50 outline-none cursor-pointer"
          >
            {LANGUAGES.map((lang) => (
              <option key={lang.code} value={lang.code} className="bg-[#1a1a1a] text-gray-200">
                {lang.flag} {lang.name} ({lang.code})
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* 3. NAVIGATION TABS */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
        <div className="flex flex-wrap items-center gap-1.5 sm:gap-2">
          {/* Tab Voices */}
          <button
            id="tab-voices"
            onClick={() => setActiveTab('voices')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'voices'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50 shadow-sm'
                : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Mic2 className="w-3.5 h-3.5" />
            <span>Vozes ({selectedVoice})</span>
          </button>

          {/* Tab Brazilian Accents */}
          {isBrazilianPortuguese && (
            <button
              id="tab-accents"
              onClick={() => setActiveTab('accents')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'accents'
                  ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50 shadow-sm'
                  : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-200'
              }`}
            >
              <MapPin className="w-3.5 h-3.5" />
              <span>Sotaques BR</span>
              {selectedAccent && selectedAccent !== 'padrao' && (
                <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-blue-600 text-white">
                  1
                </span>
              )}
            </button>
          )}

          {/* Tab Styles */}
          <button
            id="tab-styles"
            onClick={() => setActiveTab('styles')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'styles'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50 shadow-sm'
                : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Tag className="w-3.5 h-3.5" />
            <span>Emoção & Estilo</span>
            {selectedStyles.length > 0 && (
              <span className="px-1.5 py-0.2 text-[9px] font-bold rounded-full bg-blue-600 text-white">
                {selectedStyles.length}
              </span>
            )}
          </button>

          {/* Tab Prosody */}
          <button
            id="tab-prosody"
            onClick={() => setActiveTab('prosody')}
            className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
              activeTab === 'prosody'
                ? 'bg-blue-600/20 text-blue-300 border border-blue-500/50 shadow-sm'
                : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Tom & Velocidade</span>
          </button>

          {/* Tab API Key */}
          {engine === 'gemini' && (
            <button
              id="tab-apikey"
              onClick={() => setActiveTab('apikey')}
              className={`px-3 py-1.5 text-xs font-semibold rounded-xl flex items-center gap-1.5 transition-all cursor-pointer ${
                activeTab === 'apikey'
                  ? 'bg-indigo-600/20 text-indigo-300 border border-indigo-500/50 shadow-sm'
                  : 'bg-white/5 border border-white/5 text-gray-400 hover:text-gray-200'
              }`}
            >
              <Key className="w-3.5 h-3.5" />
              <span>Chave Gemini</span>
            </button>
          )}
        </div>

        {selectedStyles.length > 0 && activeTab === 'styles' && (
          <button
            id="btn-clear-styles"
            onClick={onClearStyles}
            className="text-xs text-rose-400 hover:text-rose-300 flex items-center gap-1 font-medium px-2.5 py-1 rounded-lg bg-rose-500/10 border border-rose-500/20 hover:bg-rose-500/20 transition cursor-pointer"
          >
            <X className="w-3 h-3" /> Limpar
          </button>
        )}
      </div>

      {/* 4. TAB CONTENTS */}

      {/* TAB: VOICES */}
      {activeTab === 'voices' && (
        <div id="section-voices" className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-gray-400">
            <span>
              Selecione o timbre da voz neural ({filteredVoices.length} vozes disponíveis):
            </span>
            <div className="flex items-center gap-1 bg-black/40 border border-white/10 p-1 rounded-lg">
              <button
                onClick={() => setGenderFilter('all')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  genderFilter === 'all' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Todas
              </button>
              <button
                onClick={() => setGenderFilter('Feminino')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  genderFilter === 'Feminino' ? 'bg-pink-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Femininas
              </button>
              <button
                onClick={() => setGenderFilter('Masculino')}
                className={`px-2.5 py-0.5 rounded text-[11px] font-semibold transition cursor-pointer ${
                  genderFilter === 'Masculino' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white'
                }`}
              >
                Masculinas
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-84 overflow-y-auto pr-1 scrollbar-thin">
            {filteredVoices.map((voice) => {
              const isSelected = selectedVoice === voice.id;
              return (
                <div
                  key={voice.id}
                  id={`voice-card-${voice.id}`}
                  onClick={() => onVoiceChange(voice.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between space-y-2 ${
                    isSelected
                      ? 'bg-blue-500/20 border-blue-500/70 shadow-lg shadow-blue-500/15 ring-1 ring-blue-500/40 text-white'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-xs flex items-center gap-1.5">
                      <Mic2 className={`w-3.5 h-3.5 ${isSelected ? 'text-blue-300' : 'text-gray-400'}`} />
                      <span className={isSelected ? 'text-white' : 'text-gray-200'}>{voice.name}</span>
                    </span>
                    <div className="flex items-center gap-1">
                      {voice.isPopular && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/30">
                          Popular
                        </span>
                      )}
                      <span
                        className={`text-[9px] font-bold px-2 py-0.5 rounded-full border ${
                          voice.gender === 'Feminino'
                            ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                            : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                        }`}
                      >
                        {voice.gender}
                      </span>
                    </div>
                  </div>
                  <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                    {voice.toneDescription}
                  </p>
                  <p className="text-[10px] text-gray-500 italic truncate" title={voice.recommendedFor}>
                    Ideal: {voice.recommendedFor}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: BRAZILIAN ACCENTS */}
      {activeTab === 'accents' && isBrazilianPortuguese && (
        <div id="section-accents" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs text-gray-400">
              Escolha a prosódia, cadência e sotaque regional brasileiro:
            </div>
            <input
              id="accent-search-input"
              type="text"
              placeholder="Buscar sotaque (ex: carioca, gaúcho, mineiro)..."
              value={accentSearch}
              onChange={(e) => setAccentSearch(e.target.value)}
              className="px-3 py-1.5 text-xs bg-[#1a1a1a] border border-white/10 rounded-xl text-gray-200 outline-none focus:ring-1 focus:ring-blue-500 w-full sm:w-56"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-84 overflow-y-auto pr-1 scrollbar-thin">
            {filteredAccents.map((accent) => {
              const isSelected = selectedAccent === accent.id;
              return (
                <div
                  key={accent.id}
                  id={`accent-card-${accent.id}`}
                  onClick={() => onAccentChange(accent.id)}
                  className={`p-3.5 rounded-xl border cursor-pointer transition-all flex flex-col justify-between ${
                    isSelected
                      ? 'bg-blue-500/20 border-blue-500/70 shadow-lg shadow-blue-500/15 ring-1 ring-blue-500/40 text-white'
                      : 'bg-white/5 border-white/10 hover:border-white/20 hover:bg-white/10 text-gray-300'
                  }`}
                >
                  <div className="space-y-1.5">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs flex items-center gap-1.5">
                        <span className={isSelected ? 'text-blue-300' : 'text-gray-200'}>[{accent.name}]</span>
                      </span>
                      <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded bg-black/40 text-gray-400 border border-white/5">
                        {accent.state}
                      </span>
                    </div>
                    <p className="text-[11px] text-gray-400 line-clamp-2 leading-relaxed">
                      {accent.description}
                    </p>
                  </div>

                  {onInsertSamplePhrase && accent.samplePhrase && (
                    <div className="mt-2.5 pt-2 border-t border-white/5 flex items-center justify-between text-[11px]">
                      <span className="text-gray-500 italic truncate max-w-[150px]" title={accent.samplePhrase}>
                        "{accent.samplePhrase}"
                      </span>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onInsertSamplePhrase(accent.samplePhrase);
                          onAccentChange(accent.id);
                        }}
                        title="Usar frase de exemplo"
                        className="text-[10px] font-bold text-blue-400 hover:text-blue-300 hover:underline shrink-0 ml-1 cursor-pointer"
                      >
                        Usar frase
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB: STYLES & EMOTIONS */}
      {activeTab === 'styles' && (
        <div id="section-styles" className="space-y-4">
          <div className="flex items-center justify-between text-xs text-gray-400">
            <span>
              Selecione as nuances emocionais e modulações expressivas:
            </span>
            <span className="font-mono text-[11px] text-blue-400 font-bold">
              {selectedStyles.length} ativa{selectedStyles.length === 1 ? '' : 's'}
            </span>
          </div>

          <div className="flex flex-wrap gap-2">
            {STYLE_TAGS.map((tag) => {
              const isSelected = selectedStyles.includes(tag.id);
              return (
                <button
                  key={tag.id}
                  id={`tag-style-${tag.id}`}
                  onClick={() => onToggleStyle(tag.id)}
                  title={tag.description}
                  className={`group px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 cursor-pointer ${
                    isSelected
                      ? 'bg-blue-600 text-white border-blue-500 shadow-md shadow-blue-600/30 font-bold'
                      : 'bg-white/5 text-gray-300 border-white/10 hover:border-blue-500/50 hover:bg-white/10 hover:text-white'
                  }`}
                >
                  <span className="opacity-40">#</span>
                  <span>[{tag.label}]</span>
                  {isSelected ? (
                    <Check className="w-3 h-3 text-white" />
                  ) : (
                    <Plus className="w-3 h-3 opacity-40 group-hover:opacity-100 transition" />
                  )}
                </button>
              );
            })}
          </div>

          {selectedStyles.length > 0 && (
            <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-xl text-xs text-blue-200 flex items-start gap-2.5">
              <Sparkles className="w-4 h-4 text-blue-400 shrink-0 mt-0.5" />
              <div>
                <strong className="text-blue-300">Modulação Ativa:</strong> A voz neural aplicará a intenção emocional e entonação de <em>[{selectedStyles.join(', ')}]</em> na síntese do áudio.
              </div>
            </div>
          )}
        </div>
      )}

      {/* TAB: PROSODY (PITCH & SPEED) */}
      {activeTab === 'prosody' && (
        <div id="section-prosody" className="space-y-5">
          <div className="text-xs text-gray-400">
            Ajuste fino da afinação tonal (Pitch) e ritmo da fala (Velocidade):
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 bg-black/30 p-4 rounded-xl border border-white/5">
            {/* Pitch Control */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-300 flex items-center gap-1.5">
                  <span>Tom da Voz (Pitch):</span>
                  <span className="font-mono text-blue-400">{pitch > 0 ? `+${pitch}Hz (Agudo)` : pitch < 0 ? `${pitch}Hz (Grave)` : '0Hz (Natural)'}</span>
                </span>
                {pitch !== 0 && (
                  <button
                    onClick={() => onPitchChange(0)}
                    className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Redefinir
                  </button>
                )}
              </div>
              <input
                id="pitch-slider"
                type="range"
                min={-40}
                max={40}
                step={5}
                value={pitch}
                onChange={(e) => onPitchChange(parseInt(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>-40Hz (Voz Mais Grave)</span>
                <span>0Hz</span>
                <span>+40Hz (Voz Mais Aguda)</span>
              </div>
            </div>

            {/* Speed Control */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-gray-300 flex items-center gap-1.5">
                  <span>Velocidade da Narração:</span>
                  <span className="font-mono text-blue-400">{speed.toFixed(2)}x</span>
                </span>
                {speed !== 1.0 && (
                  <button
                    onClick={() => onSpeedChange(1.0)}
                    className="text-[10px] text-gray-400 hover:text-white flex items-center gap-1"
                  >
                    <RotateCcw className="w-2.5 h-2.5" /> Redefinir
                  </button>
                )}
              </div>
              <input
                id="speed-slider"
                type="range"
                min={0.5}
                max={1.8}
                step={0.05}
                value={speed}
                onChange={(e) => onSpeedChange(parseFloat(e.target.value))}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-blue-500"
              />
              <div className="flex justify-between text-[10px] text-gray-500 font-mono">
                <span>0.5x (Lenta)</span>
                <span>1.0x (Padrão)</span>
                <span>1.8x (Acelerada)</span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* TAB: GEMINI API KEY */}
      {activeTab === 'apikey' && engine === 'gemini' && (
        <div id="section-apikey" className="space-y-4">
          <div className="flex items-start gap-3 p-3.5 bg-indigo-500/10 border border-indigo-500/20 rounded-xl text-xs text-indigo-200">
            <ShieldCheck className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <strong className="text-indigo-100 block">Chave de API do Google AI Studio (Opcional):</strong>
              <p className="text-indigo-200/90 leading-relaxed">
                Insira sua chave própria do Google AI Studio para usar os modelos Gemini. Se você não tiver uma chave ou atingir limite de cota, o sistema alternará automaticamente para o <strong>Motor Neural Ilimitado</strong> sem interromper o áudio.
              </p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="gemini-api-key-input" className="text-xs font-bold text-gray-300 flex items-center justify-between">
              <span>Chave Gemini (AIzaSy...):</span>
              {apiKey ? (
                <span className="text-[10px] text-emerald-400 font-semibold flex items-center gap-1">
                  <Check className="w-3 h-3" /> Chave personalizada inserida
                </span>
              ) : (
                <span className="text-[10px] text-gray-500">Usando padrão do ambiente</span>
              )}
            </label>
            <input
              id="gemini-api-key-input"
              type="password"
              placeholder="Cole sua GEMINI_API_KEY aqui (ex: AIzaSy...)"
              value={apiKey}
              onChange={(e) => onApiKeyChange(e.target.value)}
              className="w-full px-4 py-2.5 text-xs font-mono bg-[#1a1a1a] border border-white/10 rounded-xl text-gray-200 outline-none focus:ring-2 focus:ring-indigo-500/50"
            />
          </div>
        </div>
      )}
    </div>
  );
};
