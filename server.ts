import express from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

dotenv.config();

/**
 * Converts 16-bit Mono PCM raw data to a valid standard WAV ArrayBuffer (with 44-byte RIFF header).
 */
function pcmToWavBuffer(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.toString("ascii", 0, 4) === "RIFF") {
    return pcmBuffer;
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  // RIFF chunk descriptor
  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  // "fmt " sub-chunk
  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16); // subchunk1 size (16 for PCM)
  header.writeUInt16LE(1, 20); // audio format (1 = PCM)
  header.writeUInt16LE(numChannels, 22); // channels
  header.writeUInt32LE(sampleRate, 24); // sample rate
  header.writeUInt32LE(byteRate, 28); // byte rate
  header.writeUInt16LE(blockAlign, 32); // block align
  header.writeUInt16LE(bitsPerSample, 34); // bits per sample

  // "data" sub-chunk
  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

/**
 * Splits text into natural sentence-based chunks of up to ~350 words or ~2000 chars.
 * Ensures natural boundaries (periods, exclamation, question marks, line breaks).
 */
function splitTextIntoNaturalChunks(text: string, maxWordsPerChunk = 350, maxCharsPerChunk = 2200): string[] {
  const clean = text.trim();
  if (!clean) return [];

  const totalWords = clean.split(/\s+/).length;
  if (totalWords <= maxWordsPerChunk && clean.length <= maxCharsPerChunk) {
    return [clean];
  }

  const rawSentences = clean.match(/[^.!?\n]+[.!?\n]+|[^.!?\n]+$/g) || [clean];
  const chunks: string[] = [];
  let currentChunk = "";

  for (const sentence of rawSentences) {
    const trimmedSent = sentence.trim();
    if (!trimmedSent) continue;

    const testChunk = currentChunk ? `${currentChunk} ${trimmedSent}` : trimmedSent;
    const testWords = testChunk.split(/\s+/).length;

    if (testWords <= maxWordsPerChunk && testChunk.length <= maxCharsPerChunk) {
      currentChunk = testChunk;
    } else {
      if (currentChunk) {
        chunks.push(currentChunk);
      }
      if (trimmedSent.split(/\s+/).length > maxWordsPerChunk || trimmedSent.length > maxCharsPerChunk) {
        const subParts = trimmedSent.match(/[^,;—]+[,;—]+|[^,;—]+$/g) || [trimmedSent];
        let subChunk = "";
        for (const part of subParts) {
          const trimmedPart = part.trim();
          if (!trimmedPart) continue;
          const testSub = subChunk ? `${subChunk} ${trimmedPart}` : trimmedPart;
          if (testSub.split(/\s+/).length <= maxWordsPerChunk && testSub.length <= maxCharsPerChunk) {
            subChunk = testSub;
          } else {
            if (subChunk) chunks.push(subChunk);
            subChunk = trimmedPart;
          }
        }
        currentChunk = subChunk;
      } else {
        currentChunk = trimmedSent;
      }
    }
  }

  if (currentChunk.trim()) {
    chunks.push(currentChunk.trim());
  }

  return chunks.length > 0 ? chunks : [clean];
}

/**
 * Generates an SRT subtitle representation based on estimated speech pace
 */
function generateSrtSubtitles(chunks: string[], totalDurationSec: number): string {
  if (!chunks || chunks.length === 0 || totalDurationSec <= 0) return "";

  const totalChars = chunks.reduce((acc, c) => acc + c.length, 0);
  let currentTime = 0;
  const srtEntries: string[] = [];

  const formatSrtTime = (seconds: number) => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")},${String(ms).padStart(3, "0")}`;
  };

  chunks.forEach((chunk, index) => {
    const chunkRatio = totalChars > 0 ? chunk.length / totalChars : 1 / chunks.length;
    const chunkDuration = Math.max(1.0, totalDurationSec * chunkRatio);
    const startTime = currentTime;
    const endTime = Math.min(totalDurationSec, startTime + chunkDuration);

    srtEntries.push(
      `${index + 1}\n${formatSrtTime(startTime)} --> ${formatSrtTime(endTime)}\n${chunk}\n`
    );

    currentTime = endTime;
  });

  return srtEntries.join("\n");
}

/**
 * Synthesizes audio using Microsoft Edge Neural TTS (100% Free & Unlimited)
 */
async function generateEdgeTTSAudio(
  text: string,
  voiceName: string = "pt-BR-FranciscaNeural",
  ratePercent: number = 0,
  pitchHz: number = 0,
  volumePercent: number = 0
): Promise<{ buffer: Buffer; durationSec: number }> {
  const textChunks = splitTextIntoNaturalChunks(text);
  const audioBuffers: Buffer[] = [];

  const rateStr = ratePercent >= 0 ? `+${ratePercent}%` : `${ratePercent}%`;
  const pitchStr = pitchHz >= 0 ? `+${pitchHz}Hz` : `${pitchHz}Hz`;
  const volumeStr = volumePercent >= 0 ? `+${volumePercent}%` : `${volumePercent}%`;

  for (const chunk of textChunks) {
    let chunkBuffer: Buffer | null = null;
    let lastErr: any = null;

    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        const tts = new MsEdgeTTS();
        await tts.setMetadata(voiceName, OUTPUT_FORMAT.AUDIO_24KHZ_48KBITRATE_MONO_MP3);
        const options: any = {
          rate: rateStr,
          pitch: pitchStr,
          volume: volumeStr,
        };

        chunkBuffer = await new Promise<Buffer>((resolve, reject) => {
          const { audioStream } = tts.toStream(chunk, options);
          const dataParts: Buffer[] = [];

          audioStream.on("data", (data: any) => {
            dataParts.push(Buffer.from(data));
          });

          audioStream.on("end", () => {
            resolve(Buffer.concat(dataParts));
          });

          audioStream.on("error", (err: any) => {
            reject(err);
          });
        });

        if (chunkBuffer && chunkBuffer.length > 0) {
          break;
        }
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 200 * attempt));
      }
    }

    if (!chunkBuffer || chunkBuffer.length === 0) {
      throw lastErr || new Error("Falha ao sintetizar áudio.");
    }

    audioBuffers.push(chunkBuffer);
  }

  const combined = Buffer.concat(audioBuffers);
  const durationSec = Math.max(0.5, Math.round((combined.length / 6000) * 10) / 10);

  return { buffer: combined, durationSec };
}

/**
 * Synthesizes audio using Google Gemini AI Studio
 */
async function generateGeminiTTSAudio(
  text: string,
  apiKey: string,
  voice: string = "Kore",
  directions: string[] = []
): Promise<{ buffer: Buffer; durationSec: number; chunksProcessed: number }> {
  const ai = new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        "User-Agent": "aistudio-build",
      },
    },
  });

  const SUPPORTED_VOICES = ["Kore", "Aoede", "Puck", "Charon", "Fenrir"];
  const validVoice = SUPPORTED_VOICES.includes(voice) ? voice : "Kore";

  const textChunks = splitTextIntoNaturalChunks(text, 300, 1800);
  const rawChunkBuffers: Buffer[] = [];

  for (let i = 0; i < textChunks.length; i++) {
    const chunkText = textChunks[i];
    const promptInstruction = `${directions.join("\n")}\n\nTexto a ser narrado com máxima expressividade:\n"${chunkText}"`;

    const response = await ai.models.generateContent({
      model: "gemini-3.1-flash-tts-preview",
      contents: [
        {
          parts: [
            {
              text: promptInstruction,
            },
          ],
        },
      ],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: {
              voiceName: validVoice,
            },
          },
        },
      },
    });

    let chunkAudioBuffer: Buffer | null = null;
    if (response?.candidates && Array.isArray(response.candidates)) {
      for (const candidate of response.candidates) {
        const parts = candidate?.content?.parts;
        if (Array.isArray(parts)) {
          for (const part of parts) {
            if (part?.inlineData?.data) {
              chunkAudioBuffer = Buffer.from(part.inlineData.data, "base64");
              break;
            }
            if (part?.inline_data?.data) {
              chunkAudioBuffer = Buffer.from(part.inline_data.data, "base64");
              break;
            }
            if (typeof part?.data === "string" && part.data.length > 0) {
              chunkAudioBuffer = Buffer.from(part.data, "base64");
              break;
            }
          }
        }
        if (chunkAudioBuffer) break;
      }
    }

    if (!chunkAudioBuffer || chunkAudioBuffer.length === 0) {
      throw new Error(`Falha na síntese do bloco ${i + 1} no Gemini AI.`);
    }

    rawChunkBuffers.push(chunkAudioBuffer);

    if (i < textChunks.length - 1) {
      await new Promise((r) => setTimeout(r, 200));
    }
  }

  // Concatenate PCM buffers with natural 120ms pause
  const pcmBuffers: Buffer[] = [];
  const pauseBytes = Math.floor(24000 * 2 * 0.12);

  rawChunkBuffers.forEach((buf, idx) => {
    pcmBuffers.push(buf);
    if (idx < rawChunkBuffers.length - 1) {
      pcmBuffers.push(Buffer.alloc(pauseBytes));
    }
  });

  const combinedPcmBuffer = Buffer.concat(pcmBuffers);
  const wavBuffer = pcmToWavBuffer(combinedPcmBuffer, 24000, 1, 16);
  const durationSec = Math.round((combinedPcmBuffer.length / (24000 * 2)) * 10) / 10;

  return { buffer: wavBuffer, durationSec, chunksProcessed: textChunks.length };
}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3000;

  app.use(express.json({ limit: "25mb" }));

  // Health check endpoint
  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      engines: ["unlimited", "gemini", "local"],
      defaultEngine: "unlimited",
      hasGeminiKey: !!process.env.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    });
  });

  // TTS Generation endpoint with multi-engine architecture & auto-fallback
  app.post("/api/tts/generate", async (req, res) => {
    try {
      const {
        text,
        engine = "unlimited", // 'unlimited' | 'gemini' | 'local'
        language = "pt-BR",
        languageName = "Português (Brasil)",
        accent = "padrao",
        accentDescription = "",
        styles = [],
        voice = "pt-BR-FranciscaNeural",
        speed = 1.0,
        pitch = 0,
        apiKey = "",
      } = req.body;

      if (!text || typeof text !== "string" || text.trim().length === 0) {
        return res.status(400).json({ error: "O texto para conversão em áudio é obrigatório." });
      }

      const cleanText = text.trim();
      const textChunks = splitTextIntoNaturalChunks(cleanText);

      const geminiKey = apiKey || process.env.GEMINI_API_KEY;

      // 1. If user explicitly requested Gemini Engine AND provided a valid key
      if (engine === "gemini" && geminiKey) {
        try {
          const directions: string[] = [];
          if (language === "pt-BR") {
            if (accent && accent !== "padrao") {
              directions.push(
                `Fale em Português do Brasil com sotaque regional ${accent.toUpperCase()}${
                  accentDescription ? ` (${accentDescription})` : ""
                }, com cadência, entonação e pronúncia autêntica dessa região.`
              );
            } else {
              directions.push("Fale em Português do Brasil com pronúncia natural, clara e expressiva.");
            }
          } else {
            directions.push(`Speak naturally in ${languageName} (${language}) with clear native pronunciation.`);
          }

          if (Array.isArray(styles) && styles.length > 0) {
            directions.push(`Tom emocional, ritmo e estilo da voz: [${styles.join(", ")}].`);
          }

          const geminiVoice = ["Kore", "Aoede", "Puck", "Charon", "Fenrir"].includes(voice) ? voice : "Kore";
          const result = await generateGeminiTTSAudio(cleanText, geminiKey, geminiVoice, directions);
          const srtSubtitles = generateSrtSubtitles(textChunks, result.durationSec);

          return res.json({
            audioBase64: result.buffer.toString("base64"),
            mimeType: "audio/wav",
            durationEstimatedSec: result.durationSec,
            chunksProcessed: result.chunksProcessed,
            voiceUsed: geminiVoice,
            accentUsed: accent,
            stylesUsed: styles,
            engineUsed: "gemini",
            subtitlesSrt: srtSubtitles,
          });
        } catch (geminiError: any) {
          console.warn("[Gemini Fallback to Unlimited Engine]", geminiError?.message || geminiError);
          // Auto fallback to Unlimited engine below
        }
      }

      // 2. UNLIMITED NEURAL ENGINE (Default - Zero limits, zero quota, high fidelity)
      // Map Gemini voices (Kore, Aoede, Puck, Charon, Fenrir) to their HD neural equivalents
      let selectedVoice = voice;
      let voicePitchOffset = 0;
      let voiceRateOffset = 0;

      if (selectedVoice === "Kore") {
        selectedVoice = "pt-BR-FranciscaNeural";
      } else if (selectedVoice === "Aoede") {
        selectedVoice = "pt-BR-ThalitaNeural";
        voicePitchOffset = 5;
        voiceRateOffset = -2;
      } else if (selectedVoice === "Puck") {
        selectedVoice = "pt-BR-DonatoNeural";
        voicePitchOffset = 5;
        voiceRateOffset = 4;
      } else if (selectedVoice === "Charon") {
        selectedVoice = "pt-BR-NicolauNeural";
        voicePitchOffset = -10;
        voiceRateOffset = -4;
      } else if (selectedVoice === "Fenrir") {
        selectedVoice = "pt-BR-FabioNeural";
        voicePitchOffset = -2;
        voiceRateOffset = 2;
      } else if (!selectedVoice) {
        selectedVoice = "pt-BR-FranciscaNeural";
      }

      // Calculate pitch modifier based on style and pitch slider
      let calculatedPitch = (typeof pitch === "number" ? pitch : 0) + voicePitchOffset;
      if (styles.includes("grave") || styles.includes("narrador de documentário")) {
        calculatedPitch -= 15;
      } else if (styles.includes("alegre") || styles.includes("animada")) {
        calculatedPitch += 10;
      }

      // Calculate speed modifier
      let calculatedSpeed = typeof speed === "number" ? speed : 1.0;
      if (styles.includes("animada")) {
        calculatedSpeed *= 1.08;
      } else if (styles.includes("calma") || styles.includes("pausada")) {
        calculatedSpeed *= 0.92;
      }

      const ratePercent = Math.round((calculatedSpeed - 1.0) * 100) + voiceRateOffset;
      const { buffer, durationSec } = await generateEdgeTTSAudio(
        cleanText,
        selectedVoice,
        ratePercent,
        calculatedPitch
      );

      const srtSubtitles = generateSrtSubtitles(textChunks, durationSec);

      res.setHeader("Content-Type", "application/json");
      res.json({
        audioBase64: buffer.toString("base64"),
        mimeType: "audio/mpeg",
        durationEstimatedSec: durationSec,
        chunksProcessed: textChunks.length,
        voiceUsed: voice,
        accentUsed: accent,
        stylesUsed: styles,
        engineUsed: "unlimited",
        subtitlesSrt: srtSubtitles,
      });
    } catch (error: any) {
      console.error("Erro no processamento de síntese neural:", error);
      const errMsg = error?.message || "Ocorreu um erro ao converter o texto em fala. Tente novamente.";
      res.status(500).json({ error: errMsg });
    }
  });

  // Explicit 404 handler for API routes
  app.all("/api/*", (_req, res) => {
    res.setHeader("Content-Type", "application/json");
    res.status(404).json({ error: "Rota da API não encontrada." });
  });

  // Vite integration
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (_req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`🎙️ TTS Server rodando em http://0.0.0.0:${PORT}`);
  });
}

startServer();
