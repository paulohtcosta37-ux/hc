import { GoogleGenAI, Modality } from '@google/genai';

/**
 * Converts PCM ArrayBuffer into a valid WAV format Blob / Base64 in browser
 */
export function pcmToWavBlob(
  pcmData: Uint8Array,
  sampleRate = 24000,
  numChannels = 1,
  bitsPerSample = 16
): Blob {
  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmData.length;
  const buffer = new ArrayBuffer(44 + dataSize);
  const view = new DataView(buffer);

  function writeString(offset: number, str: string) {
    for (let i = 0; i < str.length; i++) {
      view.setUint8(offset + i, str.charCodeAt(i));
    }
  }

  // RIFF chunk descriptor
  writeString(0, 'RIFF');
  view.setUint32(4, 36 + dataSize, true);
  writeString(8, 'WAVE');

  // "fmt " sub-chunk
  writeString(12, 'fmt ');
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM format
  view.setUint16(22, numChannels, true);
  view.setUint32(24, sampleRate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);

  // "data" sub-chunk
  writeString(36, 'data');
  view.setUint32(40, dataSize, true);

  // Write PCM audio samples
  const uint8View = new Uint8Array(buffer, 44);
  uint8View.set(pcmData);

  return new Blob([buffer], { type: 'audio/wav' });
}

export function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const dataUrl = reader.result as string;
      const base64 = dataUrl.split(',')[1] || '';
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

/**
 * Splits text into natural sentence chunks
 */
export function splitTextIntoChunks(text: string, maxWords = 300): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const sentences = clean.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [clean];
  const chunks: string[] = [];
  let currentChunk = '';

  for (const sentence of sentences) {
    const trimmed = sentence.trim();
    if (!trimmed) continue;
    const test = currentChunk ? `${currentChunk} ${trimmed}` : trimmed;
    if (test.split(/\s+/).length <= maxWords) {
      currentChunk = test;
    } else {
      if (currentChunk) chunks.push(currentChunk);
      currentChunk = trimmed;
    }
  }
  if (currentChunk.trim()) chunks.push(currentChunk.trim());
  return chunks.length > 0 ? chunks : [clean];
}

/**
 * Synthesizes speech using Google Gemini directly in the client
 */
export async function synthesizeBrowserGemini(
  text: string,
  apiKey: string,
  voice: string = 'Kore',
  directions: string[] = []
): Promise<{ audioBase64: string; durationSec: number }> {
  if (!apiKey) {
    throw new Error('Insira sua GEMINI_API_KEY no menu "Configuração" para usar o Gemini no GitHub Pages.');
  }

  const ai = new GoogleGenAI({ apiKey });
  const textChunks = splitTextIntoChunks(text, 250);
  const audioBuffers: Uint8Array[] = [];

  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i];
    const promptInstruction = `${directions.join('\n')}\n\nTexto a ser narrado:\n"${chunkText}"`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.1-flash-tts-preview',
      contents: [
        {
          parts: [{ text: promptInstruction }],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: voice,
            },
          },
        },
      },
    });

    let chunkBase64: string | null = null;
    const candidates = response?.candidates;
    if (Array.isArray(candidates)) {
      for (const cand of candidates) {
        const parts = cand?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.inlineData?.data) {
              chunkBase64 = part.inlineData.data;
              break;
            }
          }
        }
        if (chunkBase64) break;
      }
    }

    if (!chunkBase64) {
      throw new Error(`Falha na síntese do bloco ${i + 1} no Gemini.`);
    }

    const binaryString = atob(chunkBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let j = 0; j < binaryString.length; j++) {
      bytes[j] = binaryString.charCodeAt(j);
    }
    audioBuffers.push(bytes);
  }

  // Concat all PCM buffers
  const totalLength = audioBuffers.reduce((acc, b) => acc + b.length, 0);
  const combined = new Uint8Array(totalLength);
  let offset = 0;
  for (const b of audioBuffers) {
    combined.set(b, offset);
    offset += b.length;
  }

  const wavBlob = pcmToWavBlob(combined, 24000, 1, 16);
  const audioBase64 = await blobToBase64(wavBlob);
  const durationSec = Math.round((combined.length / (24000 * 2)) * 10) / 10;

  return { audioBase64, durationSec };
}
