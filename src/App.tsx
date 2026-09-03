import React, { useState, useEffect, useRef } from 'react';
import {
  Sparkles,
  Volume2,
  Wand2,
  AlertCircle,
  FileText,
  Trash2,
  Upload,
  Flame,
  Zap,
  Cpu,
  RefreshCw,
} from 'lucide-react';
import { VoiceCustomizer } from './components/VoiceCustomizer';
import { AudioPlayer } from './components/AudioPlayer';
import { ConversionProgress } from './components/ConversionProgress';
import { AudioHistory } from './components/AudioHistory';
import { SAMPLE_TEXTS, LANGUAGES, BRAZILIAN_ACCENTS } from './data/options';
import { ConversionHistoryItem, EngineType } from './types';

const STORAGE_KEY_HISTORY = 'tts_neural_unlimited_history_v2';
const STORAGE_KEY_APIKEY = 'tts_gemini_user_api_key_v1';

export default function App() {
  const [engine, setEngine] = useState<EngineType>('unlimited');
  const [text, setText] = useState(SAMPLE_TEXTS[0].text);
  const [selectedLanguage, setSelectedLanguage] = useState('pt-BR');
  const [selectedAccent, setSelectedAccent] = useState('padrao');
  const [selectedStyles, setSelectedStyles] = useState<string[]>(['confiante', 'jornalística']);
  const [selectedVoice, setSelectedVoice] = useState('pt-BR-FranciscaNeural');
  const [pitch, setPitch] = useState(0);
  const [speed, setSpeed] = useState(1.0);
  const [playbackRate, setPlaybackRate] = useState(1.0);

  const [apiKey, setApiKey] = useState<string>(() => {
    try {
      return localStorage.getItem(STORAGE_KEY_APIKEY) || '';
    } catch {
      return '';
    }
  });

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [canFallbackToUnlimited, setCanFallbackToUnlimited] = useState(false);

  const [currentAudio, setCurrentAudio] = useState<{
    audioBase64: string;
    mimeType: string;
    durationSec: number;
    text: string;
    voice: string;
    accent: string;
    styles: string[];
    chunksProcessed?: number;
    engineUsed: EngineType;
    fellBackFromGemini?: boolean;
    fallbackReason?: string;
    subtitlesSrt?: string;
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const [history, setHistory] = useState<ConversionHistoryItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_HISTORY);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  });

  // Save history to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY_HISTORY, JSON.stringify(history));
    } catch (e) {
      console.error('Falha ao salvar histórico no localStorage:', e);
    }
  }, [history]);

  // Save API Key
  const handleApiKeyChange = (key: string) => {
    setApiKey(key);
    try {
      localStorage.setItem(STORAGE_KEY_APIKEY, key);
    } catch (e) {
      console.error('Falha ao salvar chave de API:', e);
    }
  };

  const handleToggleStyle = (styleId: string) => {
    setSelectedStyles((prev) =>
      prev.includes(styleId) ? prev.filter((s) => s !== styleId) : [...prev, styleId]
    );
  };

  const handleClearStyles = () => {
    setSelectedStyles([]);
  };

  const handleApplySample = (sample: (typeof SAMPLE_TEXTS)[0]) => {
    setText(sample.text);
    setSelectedLanguage(sample.lang);
    setSelectedAccent(sample.accent || 'padrao');
    setSelectedStyles(sample.styles || []);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const content = event.target?.result;
      if (typeof content === 'string') {
        setText(content);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // Browser Web Speech fallback synthesis
  const handleLocalWebSpeechSynthesis = () => {
    if (!('speechSynthesis' in window)) {
      setErrorMessage('A síntese de voz local não é suportada neste navegador.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = selectedLanguage;
    utterance.rate = speed;
    utterance.pitch = 1.0 + pitch / 50;

    const voices = window.speechSynthesis.getVoices();
    const matchedVoice = voices.find((v) => v.lang.startsWith(selectedLanguage.slice(0, 2)));
    if (matchedVoice) {
      utterance.voice = matchedVoice;
    }

    utterance.onstart = () => setIsLoading(true);
    utterance.onend = () => setIsLoading(false);
    utterance.onerror = (err) => {
      setIsLoading(false);
      setErrorMessage(`Erro na síntese local do navegador: ${err.error}`);
    };

    window.speechSynthesis.speak(utterance);
  };

  const handleGenerateTTS = async (overrideEngine?: EngineType) => {
    const activeEngine = overrideEngine || engine;

    if (!text.trim()) {
      setErrorMessage('Por favor, digite ou cole o texto que deseja converter em fala.');
      return;
    }

    if (activeEngine === 'local') {
      handleLocalWebSpeechSynthesis();
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    setCanFallbackToUnlimited(false);

    const langObj = LANGUAGES.find((l) => l.code === selectedLanguage);
    const accentObj = BRAZILIAN_ACCENTS.find((a) => a.id === selectedAccent);

    try {
      let response: Response | null = null;
      let isStaticHosting = false;

      try {
        response = await fetch('/api/tts/generate', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
          },
          body: JSON.stringify({
            text: text.trim(),
            engine: activeEngine,
            language: selectedLanguage,
            languageName: langObj?.name || 'Português (Brasil)',
            accent: selectedLanguage === 'pt-BR' ? selectedAccent : '',
            accentDescription: selectedLanguage === 'pt-BR' ? accentObj?.description : '',
            styles: selectedStyles,
            voice: selectedVoice,
            speed,
            pitch,
            apiKey: apiKey.trim(),
          }),
        });
      } catch (fetchErr) {
        // Static GitHub Pages hosting without backend
        isStaticHosting = true;
      }

      // If on GitHub Pages static hosting
      if (isStaticHosting || (response && response.status === 404)) {
        if (activeEngine === 'gemini' && apiKey.trim()) {
          const { synthesizeBrowserGemini } = await import('./utils/clientTTS');
          const directions: string[] = [];
          if (selectedAccent && selectedAccent !== 'padrao') {
            directions.push(`Fale com sotaque ${selectedAccent}`);
          }
          if (selectedStyles.length > 0) {
            directions.push(`Estilo: ${selectedStyles.join(', ')}`);
          }
          const geminiResult = await synthesizeBrowserGemini(
            text.trim(),
            apiKey.trim(),
            ['Kore', 'Aoede', 'Puck', 'Charon', 'Fenrir'].includes(selectedVoice) ? selectedVoice : 'Kore',
            directions
          );

          const clientAudioItem = {
            audioBase64: geminiResult.audioBase64,
            mimeType: 'audio/wav',
            durationSec: geminiResult.durationSec,
            text: text.trim(),
            voice: selectedVoice,
            accent: selectedAccent,
            styles: selectedStyles,
            engineUsed: 'gemini' as EngineType,
          };
          setCurrentAudio(clientAudioItem);
          return;
        } else {
          // Use Browser Web Speech on static hosting
          handleLocalWebSpeechSynthesis();
          return;
        }
      }

      if (!response) {
        throw new Error('Não foi possível conectar ao serviço de áudio.');
      }

      const responseText = await response.text();
      let data: any = null;

      try {
        data = JSON.parse(responseText);
      } catch {
        data = null;
      }

      if (!response.ok) {
        const serverError = data?.error;
        if (activeEngine === 'gemini') {
          setCanFallbackToUnlimited(true);
        }
        throw new Error(
          serverError || `Falha na conversão de fala (código ${response.status}). Tente novamente.`
        );
      }

      if (!data || !data.audioBase64) {
        throw new Error(data?.error || 'Nenhum dado de áudio foi retornado pelo sintetizador.');
      }

      const newAudioItem = {
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/mpeg',
        durationSec: data.durationEstimatedSec || 0,
        text: text.trim(),
        voice: data.voiceUsed || selectedVoice,
        accent: data.accentUsed || selectedAccent,
        styles: data.stylesUsed || selectedStyles,
        chunksProcessed: data.chunksProcessed || 1,
        engineUsed: (data.engineUsed as EngineType) || activeEngine,
        fellBackFromGemini: !!data.fellBackFromGemini,
        fallbackReason: data.fallbackReason,
        subtitlesSrt: data.subtitlesSrt,
      };

      setCurrentAudio(newAudioItem);

      // Add to history
      const historyEntry: ConversionHistoryItem = {
        id: Date.now().toString(),
        text: text.trim(),
        audioBase64: data.audioBase64,
        mimeType: data.mimeType || 'audio/mpeg',
        durationSec: data.durationEstimatedSec || 0,
        createdAt: Date.now(),
        engine: (data.engineUsed as EngineType) || activeEngine,
        language: selectedLanguage,
        languageName: langObj?.name || 'Português',
        accent: selectedAccent,
        styles: selectedStyles,
        voice: data.voiceUsed || selectedVoice,
        chunksProcessed: data.chunksProcessed || 1,
        pitch,
        speed,
        subtitlesSrt: data.subtitlesSrt,
      };

      setHistory((prev) => [historyEntry, ...prev.slice(0, 29)]);
    } catch (err: any) {
      console.error('Falha na conversão de fala:', err);
      setErrorMessage(
        err.message || 'Ocorreu um erro ao comunicar com o sintetizador neural.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectHistoryItem = (item: ConversionHistoryItem) => {
    setCurrentAudio({
      audioBase64: item.audioBase64,
      mimeType: item.mimeType || 'audio/mpeg',
      durationSec: item.durationSec,
      text: item.text,
      voice: item.voice,
      accent: item.accent || 'padrao',
      styles: item.styles || [],
      chunksProcessed: item.chunksProcessed || 1,
      engineUsed: item.engine || 'unlimited',
      subtitlesSrt: item.subtitlesSrt,
    });
    setText(item.text);
    setSelectedLanguage(item.language);
    if (item.engine) setEngine(item.engine);
    if (item.accent) setSelectedAccent(item.accent);
    if (item.styles) setSelectedStyles(item.styles);
    if (item.voice) setSelectedVoice(item.voice);
    if (item.pitch !== undefined) setPitch(item.pitch);
    if (item.speed !== undefined) setSpeed(item.speed);
  };

  const wordCount = text.trim() ? text.trim().split(/\s+/).length : 0;
  const charCount = text.length;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-[#e0e0e0] relative selection:bg-blue-600 selection:text-white overflow-x-hidden font-sans">
      {/* Hidden file input for importing text files */}
      <input
        ref={fileInputRef}
        type="file"
        accept=".txt,.md,.srt,.vtt"
        onChange={handleFileUpload}
        className="hidden"
      />

      {/* Ambient background glows */}
      <div className="fixed top-0 left-0 w-full h-full pointer-events-none opacity-20 z-0">
        <div className="absolute top-[-10%] right-[-10%] w-[50%] h-[55%] bg-blue-600 blur-[140px] rounded-full" />
        <div className="absolute bottom-[-10%] left-[-10%] w-[50%] h-[55%] bg-indigo-600 blur-[140px] rounded-full" />
      </div>

      {/* Top Header */}
      <header className="relative z-20 border-b border-white/10 bg-black/50 backdrop-blur-xl sticky top-0">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-18 flex items-center justify-between">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 bg-linear-to-br from-blue-600 via-indigo-600 to-cyan-500 rounded-xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20 ring-1 ring-white/15">
              <Volume2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                Conversor de Texto em Fala <span className="text-transparent bg-clip-text bg-linear-to-r from-blue-400 to-cyan-300">Neural HD</span>
              </h1>
              <div className="flex items-center gap-2 mt-0.5">
                <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse shadow-[0_0_8px_rgba(52,211,153,0.8)]" />
                <p className="text-[10px] text-gray-400 uppercase tracking-widest font-semibold">
                  Sem Limite de Cota • Síntese Neural Contínua
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5">
            <span className="px-3 py-1.5 bg-blue-500/10 border border-blue-500/30 rounded-xl text-xs font-semibold text-blue-300 hidden sm:inline-flex items-center gap-1.5">
              <Flame className="w-3.5 h-3.5 text-amber-400" />
              <span>Geração Ilimitada Ativa</span>
            </span>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="relative z-10 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8 space-y-6">
        {/* Quick Sample Selector */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-xs font-semibold text-gray-400">
            <span className="flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              <Wand2 className="w-3.5 h-3.5 text-blue-400" />
              Exemplos Rápidos de Demonstração:
            </span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto pb-1.5 scrollbar-thin">
            {SAMPLE_TEXTS.map((sample, idx) => (
              <button
                key={idx}
                id={`btn-sample-${idx}`}
                onClick={() => handleApplySample(sample)}
                className="px-3.5 py-1.5 rounded-xl bg-white/5 border border-white/10 text-xs font-medium text-gray-300 hover:bg-white/10 hover:border-blue-500/50 hover:text-blue-300 transition-all whitespace-nowrap shadow-xs cursor-pointer"
              >
                {sample.title}
              </button>
            ))}
          </div>
        </div>

        {/* Text Input Section */}
        <div
          id="text-input-card"
          className="bg-[#121212] border border-white/10 rounded-2xl p-5 sm:p-6 relative flex flex-col shadow-2xl space-y-4"
        >
          <div className="flex items-center justify-between border-b border-white/5 pb-3">
            <div className="flex items-center gap-2 text-xs font-bold text-gray-400 uppercase tracking-widest">
              <FileText className="w-4 h-4 text-blue-400" />
              <span>Editor de Texto para Narração</span>
            </div>

            <div className="flex items-center gap-3 text-xs text-gray-400">
              <button
                id="btn-upload-file"
                onClick={() => fileInputRef.current?.click()}
                title="Importar arquivo de texto (.txt, .md, .srt)"
                className="px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 flex items-center gap-1.5 transition cursor-pointer text-xs"
              >
                <Upload className="w-3.5 h-3.5 text-blue-400" />
                <span>Importar Arquivo</span>
              </button>

              <span className="font-mono">{wordCount} palavras</span>
              <span>•</span>
              <span className="font-mono">{charCount} caracteres</span>

              {text && (
                <button
                  id="btn-clear-text"
                  onClick={() => setText('')}
                  title="Limpar texto"
                  className="p-1 hover:text-rose-400 text-gray-500 rounded transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          <textarea
            id="tts-text-input"
            rows={5}
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Digite, cole ou importe o texto que deseja converter em fala com voz neural de alta fidelidade..."
            className="w-full p-2 bg-transparent border-none outline-none text-base sm:text-lg text-gray-100 resize-y leading-relaxed placeholder:text-gray-600 focus:ring-0"
            spellCheck={false}
          />

          {/* Quick Active Configuration Summary */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-white/5">
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="text-gray-500 text-[11px] uppercase tracking-wider font-semibold">Configuração:</span>
              <span className={`px-2.5 py-0.5 rounded-md font-semibold border ${
                engine === 'unlimited'
                  ? 'bg-blue-500/15 text-blue-300 border-blue-500/30'
                  : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
              }`}>
                {engine === 'unlimited' ? '🚀 Ilimitado' : engine === 'gemini' ? '⚡ Gemini AI' : '💻 Local'}
              </span>
              <span className="font-semibold text-gray-300 bg-white/5 px-2.5 py-0.5 rounded-md border border-white/5">
                {LANGUAGES.find((l) => l.code === selectedLanguage)?.name}
              </span>
              {selectedLanguage === 'pt-BR' && selectedAccent && selectedAccent !== 'padrao' && (
                <span className="px-2.5 py-0.5 rounded-md bg-blue-500/15 text-blue-400 border border-blue-500/30 font-medium">
                  Sotaque [{selectedAccent}]
                </span>
              )}
              {selectedStyles.map((style) => (
                <span
                  key={style}
                  className="px-2.5 py-0.5 rounded-md bg-white/5 text-gray-300 border border-white/10 font-medium"
                >
                  [{style}]
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Voice Customizer */}
        <VoiceCustomizer
          engine={engine}
          onEngineChange={setEngine}
          selectedLanguage={selectedLanguage}
          onLanguageChange={(lang) => {
            setSelectedLanguage(lang);
            if (lang !== 'pt-BR') {
              setSelectedAccent('padrao');
            }
          }}
          selectedAccent={selectedAccent}
          onAccentChange={setSelectedAccent}
          selectedStyles={selectedStyles}
          onToggleStyle={handleToggleStyle}
          onClearStyles={handleClearStyles}
          selectedVoice={selectedVoice}
          onVoiceChange={setSelectedVoice}
          pitch={pitch}
          onPitchChange={setPitch}
          speed={speed}
          onSpeedChange={setSpeed}
          apiKey={apiKey}
          onApiKeyChange={handleApiKeyChange}
          onInsertSamplePhrase={(phrase) => setText(phrase)}
        />

        {/* Generate Button */}
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <button
            id="btn-generate-audio"
            onClick={() => handleGenerateTTS()}
            disabled={isLoading || !text.trim()}
            className={`w-full py-4 px-6 rounded-2xl font-bold text-sm sm:text-base flex items-center justify-center gap-3 transition-all ${
              isLoading || !text.trim()
                ? 'bg-white/5 border border-white/10 text-gray-500 cursor-not-allowed'
                : engine === 'unlimited'
                ? 'bg-linear-to-r from-blue-600 via-indigo-600 to-blue-500 hover:from-blue-500 hover:to-indigo-400 text-white shadow-xl shadow-blue-600/30 active:scale-[0.99] border border-blue-400/40 cursor-pointer'
                : 'bg-indigo-600 hover:bg-indigo-500 text-white shadow-xl shadow-indigo-600/25 active:scale-[0.99] border border-indigo-400/30 cursor-pointer'
            }`}
          >
            <Sparkles className={`w-5 h-5 ${isLoading ? 'animate-spin' : 'text-blue-200'}`} />
            <span>
              {isLoading
                ? 'Processando Síntese Neural de Alta Fidelidade...'
                : engine === 'unlimited'
                ? 'Sintetizar Áudio com Motor Neural Ilimitado (Sem Limites)'
                : engine === 'gemini'
                ? 'Sintetizar com Google Gemini AI Studio'
                : 'Sintetizar com Voz Local do Navegador'}
            </span>
          </button>
        </div>

        {/* Error Notification with 1-Click Fallback */}
        {errorMessage && (
          <div
            id="error-banner"
            className="p-4 rounded-2xl bg-rose-950/60 border border-rose-800/80 text-rose-200 text-xs sm:text-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 backdrop-blur-md shadow-lg"
          >
            <div className="flex items-start gap-3 flex-1">
              <AlertCircle className="w-5 h-5 text-rose-400 shrink-0 mt-0.5" />
              <div>
                <strong className="font-semibold block mb-0.5 text-rose-100">Aviso do Sistema:</strong>
                <p className="text-rose-200/90 leading-relaxed">{errorMessage}</p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 self-end sm:self-center shrink-0">
              {canFallbackToUnlimited && (
                <button
                  id="btn-fallback-unlimited"
                  onClick={() => {
                    setEngine('unlimited');
                    setSelectedVoice('pt-BR-FranciscaNeural');
                    handleGenerateTTS('unlimited');
                  }}
                  className="px-3.5 py-1.5 rounded-xl font-bold text-xs bg-emerald-600 hover:bg-emerald-500 text-white border border-emerald-400/40 transition flex items-center gap-1.5 cursor-pointer shadow-md shadow-emerald-600/20"
                >
                  <Flame className="w-3.5 h-3.5 text-amber-300" />
                  <span>Gerar com Motor Ilimitado</span>
                </button>
              )}

              <button
                id="btn-retry-tts"
                onClick={() => handleGenerateTTS()}
                disabled={isLoading}
                className="px-3.5 py-1.5 rounded-xl font-semibold text-xs bg-rose-500/20 hover:bg-rose-500/30 border border-rose-500/40 text-rose-200 hover:text-white transition flex items-center gap-1.5 cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                <span>Tentar novamente</span>
              </button>

              <button
                onClick={() => setErrorMessage(null)}
                className="p-1.5 text-rose-400 hover:text-rose-200 hover:bg-rose-900/40 rounded-lg font-bold transition cursor-pointer"
                title="Fechar aviso"
              >
                ✕
              </button>
            </div>
          </div>
        )}

        {/* Visual Conversion Progress Bar */}
        <ConversionProgress isLoading={isLoading} engine={engine} />

        {/* Generated Audio Player */}
        {currentAudio && (
          <AudioPlayer
            audioBase64={currentAudio.audioBase64}
            mimeType={currentAudio.mimeType}
            durationSec={currentAudio.durationSec}
            textSnippet={currentAudio.text}
            voiceName={currentAudio.voice}
            accentName={currentAudio.accent}
            stylesUsed={currentAudio.styles}
            chunksProcessed={currentAudio.chunksProcessed}
            engineUsed={currentAudio.engineUsed}
            fellBackFromGemini={currentAudio.fellBackFromGemini}
            fallbackReason={currentAudio.fallbackReason}
            subtitlesSrt={currentAudio.subtitlesSrt}
            playbackRate={playbackRate}
            onPlaybackRateChange={setPlaybackRate}
          />
        )}

        {/* History of Past Generations */}
        <AudioHistory
          history={history}
          onSelectHistoryItem={handleSelectHistoryItem}
          onClearHistory={() => setHistory([])}
          onDeleteItem={(id) => setHistory((prev) => prev.filter((item) => item.id !== id))}
        />
      </main>
    </div>
  );
}
