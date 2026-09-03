import express from "express";
import dotenv from "dotenv";
import { GoogleGenAI, Modality } from "@google/genai";
import { MsEdgeTTS, OUTPUT_FORMAT } from "msedge-tts";

dotenv.config();

function pcmToWavBuffer(pcmBuffer: Buffer, sampleRate = 24000, numChannels = 1, bitsPerSample = 16): Buffer {
  if (pcmBuffer.length >= 4 && pcmBuffer.toString("ascii", 0, 4) === "RIFF") {
    return pcmBuffer;
  }

  const byteRate = (sampleRate * numChannels * bitsPerSample) / 8;
  const blockAlign = (numChannels * bitsPerSample) / 8;
  const dataSize = pcmBuffer.length;
  const header = Buffer.alloc(44);

  header.write("RIFF", 0);
  header.writeUInt32LE(36 + dataSize, 4);
  header.write("WAVE", 8);

  header.write("fmt ", 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(numChannels, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(byteRate, 28);
  header.writeUInt16LE(blockAlign, 32);
  header.writeUInt16LE(bitsPerSample, 34);

  header.write("data", 36);
  header.writeUInt32LE(dataSize, 40);

  return Buffer.concat([header, pcmBuffer]);
}

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
 * Fallback synthesizer via Google TTS
 */
async function generateGoogleTranslateTTSAudio(
  text: string,
  lang: string = "pt-BR"
): Promise<{ buffer: Buffer; durationSec: number }> {
  const chunks = splitTextIntoNaturalChunks(text, 50, 200);
  const audioBuffers: Buffer[] = [];

  for (const chunk of chunks) {
    const url = `https://translate.google.com/translate_tts?ie=UTF-8&tl=${encodeURIComponent(
      lang
    )}&client=tw-ob&q=${encodeURIComponent(chunk)}`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });
    if (!res.ok) throw new Error(`Google TTS status ${res.status}`);
    const arrayBuf = await res.arrayBuffer();
    audioBuffers.push(Buffer.from(arrayBuf));
  }

  const combined = Buffer.concat(audioBuffers);
  const durationSec = Math.max(0.5, Math.round((combined.length / 4000) * 10) / 10);
  return { buffer: combined, durationSec };
}

async function generateEdgeTTSAudio(
  text: string,
  voiceName: string = "pt-BR-FranciscaNeural",
  ratePercent: number = 0,
  pitchHz: number = 0,
  volumePercent: number = 0,
  language: string = "pt-BR"
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
            const collected = Buffer.concat(dataParts);
            if (collected.length >= 800) {
              resolve(collected);
            } else {
              reject(err);
            }
          });
        });

        if (chunkBuffer && chunkBuffer.length > 0) {
          break;
        }
      } catch (err) {
        lastErr = err;
        await new Promise((r) => setTimeout(r, 150 * attempt));
      }
    }

    if (!chunkBuffer || chunkBuffer.length === 0) {
      console.warn(`[TTS Edge Fallback] Alternando bloco para Google TTS devido a: ${lastErr?.message || lastErr}`);
      try {
        const fallbackResult = await generateGoogleTranslateTTSAudio(chunk, language);
        chunkBuffer = fallbackResult.buffer;
      } catch (googleErr) {
        throw lastErr || googleErr || new Error("Falha ao sintetizar áudio.");
      }
    }

    audioBuffers.push(chunkBuffer);
  }

  const combined = Buffer.concat(audioBuffers);
  const durationSec = Math.max(0.5, Math.round((combined.length / 6000) * 10) / 10);

  return { buffer: combined, durationSec };
}

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

const app = express();
app.use(express.json({ limit: "25mb" }));

app.get("/api/health", (_req, res) => {
  res.json({
    status: "ok",
    engines: ["unlimited", "gemini", "local"],
    defaultEngine: "unlimited",
    hasGeminiKey: !!process.env.GEMINI_API_KEY,
    timestamp: new Date().toISOString(),
  });
});

app.post("/api/tts/generate", async (req, res) => {
  try {
    const {
      text,
      engine = "unlimited",
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

    if (engine === "gemini") {
      const geminiKey = apiKey || process.env.GEMINI_API_KEY;

      if (!geminiKey) {
        return res.status(400).json({
          error: "Para usar o motor Google Gemini, insira sua chave de API (GEMINI_API_KEY) ou selecione o Motor Neural Ilimitado (sem chave e sem limites).",
          suggestUnlimited: true,
        });
      }

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
        const errStr = String(geminiError?.message || geminiError || "");
        console.warn("[Gemini Error / Quota Limit]", errStr);

        const isQuotaOrDemand =
          errStr.includes("429") ||
          errStr.includes("RESOURCE_EXHAUSTED") ||
          errStr.includes("Quota exceeded") ||
          errStr.includes("503") ||
          errStr.includes("UNAVAILABLE") ||
          errStr.includes("high demand") ||
          errStr.includes("API_KEY_INVALID");

        if (isQuotaOrDemand) {
          const fallbackVoice = voice === "Puck" || voice === "Charon" || voice === "Fenrir"
            ? "pt-BR-AntonioNeural"
            : "pt-BR-FranciscaNeural";

          const ratePercent = Math.round((speed - 1.0) * 100);
          const pitchHz = typeof pitch === "number" ? pitch : 0;
          const unlimitedResult = await generateEdgeTTSAudio(cleanText, fallbackVoice, ratePercent, pitchHz);
          const srtSubtitles = generateSrtSubtitles(textChunks, unlimitedResult.durationSec);

          return res.json({
            audioBase64: unlimitedResult.buffer.toString("base64"),
            mimeType: "audio/mpeg",
            durationEstimatedSec: unlimitedResult.durationSec,
            chunksProcessed: textChunks.length,
            voiceUsed: fallbackVoice,
            accentUsed: accent,
            stylesUsed: styles,
            engineUsed: "unlimited",
            fellBackFromGemini: true,
            fallbackReason: "Limite de cota do Google AI Studio atingido. Áudio sintetizado com sucesso no Motor Neural Ilimitado!",
            subtitlesSrt: srtSubtitles,
          });
        }

        throw geminiError;
      }
    }

    let selectedVoice = voice;
    if (!selectedVoice || selectedVoice === "Kore" || selectedVoice === "Aoede" || selectedVoice === "Zephyr") {
      selectedVoice = "pt-BR-FranciscaNeural";
    } else if (selectedVoice === "Puck" || selectedVoice === "Charon" || selectedVoice === "Fenrir") {
      selectedVoice = "pt-BR-AntonioNeural";
    }

    let calculatedPitch = typeof pitch === "number" ? pitch : 0;
    if (styles.includes("grave") || styles.includes("narrador de documentário")) {
      calculatedPitch -= 15;
    } else if (styles.includes("alegre") || styles.includes("animada")) {
      calculatedPitch += 10;
    }

    let calculatedSpeed = typeof speed === "number" ? speed : 1.0;
    if (styles.includes("animada")) {
      calculatedSpeed *= 1.08;
    } else if (styles.includes("calma") || styles.includes("pausada")) {
      calculatedSpeed *= 0.92;
    }

    const ratePercent = Math.round((calculatedSpeed - 1.0) * 100);
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
      voiceUsed: selectedVoice,
      accentUsed: accent,
      stylesUsed: styles,
      engineUsed: "unlimited",
      subtitlesSrt: srtSubtitles,
    });
  } catch (error: any) {
    console.error("Erro no processamento de síntese neural:", error);
    const errMsg = error?.message || "Ocorreu um erro ao converter o texto em fala.";
    res.status(500).json({ error: errMsg });
  }
});

export default app;
