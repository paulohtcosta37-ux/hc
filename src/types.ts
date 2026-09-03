export type EngineType = 'unlimited' | 'gemini' | 'local';

export interface LanguageOption {
  code: string;
  name: string;
  nativeName: string;
  flag: string;
  hasAccents?: boolean;
}

export interface AccentOption {
  id: string;
  name: string;
  region: string;
  state: string;
  description: string;
  samplePhrase: string;
  pitchModifier?: string;
  rateModifier?: string;
  promptInstruction?: string;
}

export interface VoiceOption {
  id: string;
  name: string;
  gender: 'Feminino' | 'Masculino';
  toneDescription: string;
  recommendedFor: string;
  engine: 'unlimited' | 'gemini' | 'all';
  lang?: string;
  isPopular?: boolean;
}

export interface StyleTag {
  id: string;
  label: string;
  category: 'emocao' | 'ritmo' | 'cenario' | 'tom';
  description: string;
  color: string;
  pitchHint?: string;
  rateHint?: string;
}

export interface ConversionHistoryItem {
  id: string;
  text: string;
  audioBase64: string;
  mimeType: string;
  durationSec: number;
  createdAt: number;
  engine: EngineType;
  language: string;
  languageName: string;
  accent?: string;
  styles: string[];
  voice: string;
  chunksProcessed?: number;
  pitch?: number;
  speed?: number;
  subtitlesSrt?: string;
}
