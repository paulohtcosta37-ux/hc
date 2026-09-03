import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { Bot, Sparkles, Cpu, Waves, CheckCircle2, Flame } from 'lucide-react';
import { EngineType } from '../types';

interface ConversionProgressProps {
  isLoading: boolean;
  engine?: EngineType;
  statusMessage?: string;
}

const STEPS = [
  { label: 'Iniciando síntese de voz neural', icon: Flame, threshold: 20 },
  { label: 'Analisando fonemas, pontuação e prosódia', icon: Sparkles, threshold: 45 },
  { label: 'Modulando entonação, tom e sotaque regional', icon: Cpu, threshold: 70 },
  { label: 'Sintetizando áudio em 24kHz HD', icon: Waves, threshold: 90 },
  { label: 'Finalizando codificação de áudio', icon: CheckCircle2, threshold: 100 },
];

export const ConversionProgress: React.FC<ConversionProgressProps> = ({
  isLoading,
  engine = 'unlimited',
  statusMessage,
}) => {
  const [progress, setProgress] = useState(5);

  useEffect(() => {
    if (!isLoading) {
      setProgress(0);
      return;
    }

    setProgress(12);

    const interval = setInterval(() => {
      setProgress((prev) => {
        if (prev < 35) return prev + 8;
        if (prev < 70) return prev + 4;
        if (prev < 88) return prev + 2;
        if (prev < 96) return prev + 0.5;
        return prev;
      });
    }, 180);

    return () => clearInterval(interval);
  }, [isLoading]);

  if (!isLoading) return null;

  const activeStepIndex = STEPS.findIndex((s) => progress <= s.threshold);
  const currentStep = STEPS[activeStepIndex >= 0 ? activeStepIndex : STEPS.length - 1];
  const StepIcon = currentStep.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      id="conversion-progress-container"
      className="bg-[#121212] border border-white/10 rounded-2xl p-5 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden backdrop-blur-xl"
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <span className="p-2 bg-blue-600/20 border border-blue-500/40 text-blue-400 rounded-xl animate-pulse shadow-sm shadow-blue-500/10">
            <StepIcon className="w-5 h-5" />
          </span>
          <div>
            <h4 className="text-sm font-bold text-white tracking-wide">
              {statusMessage || currentStep.label}
            </h4>
            <p className="text-[10px] text-gray-400 uppercase tracking-widest mt-0.5 font-semibold">
              {engine === 'unlimited'
                ? 'Motor Neural HD Ilimitado • Sem restrições de cota'
                : engine === 'gemini'
                ? 'Google Gemini AI Studio Neural • Proteção de cota ativa'
                : 'Síntese Local do Navegador'}
            </p>
          </div>
        </div>
        <div className="text-right">
          <span className="text-xl font-mono text-blue-400 font-bold">
            {Math.round(progress)}%
          </span>
        </div>
      </div>

      {/* Progress Bar Track */}
      <div className="w-full h-2.5 bg-white/5 rounded-full p-0.5 border border-white/10 overflow-hidden">
        <motion.div
          className="h-full bg-linear-to-r from-blue-600 via-indigo-500 to-cyan-400 rounded-full shadow-[0_0_15px_rgba(37,99,235,0.5)]"
          initial={{ width: '5%' }}
          animate={{ width: `${Math.min(100, Math.max(5, progress))}%` }}
          transition={{ ease: 'easeOut', duration: 0.2 }}
        />
      </div>

      {/* Sub-steps Indicator */}
      <div className="grid grid-cols-5 gap-2 pt-1">
        {STEPS.map((s, idx) => {
          const isDone = progress >= s.threshold;
          const isCurrent = activeStepIndex === idx;
          return (
            <div key={idx} className="flex flex-col items-center gap-1.5">
              <div
                className={`h-1.5 w-full rounded-full transition-all duration-300 ${
                  isDone
                    ? 'bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.6)]'
                    : isCurrent
                    ? 'bg-blue-400 animate-pulse'
                    : 'bg-white/10'
                }`}
              />
              <span className={`text-[10px] text-center hidden sm:block truncate max-w-full font-medium ${
                isDone ? 'text-gray-300' : isCurrent ? 'text-blue-400 font-bold' : 'text-gray-600'
              }`}>
                {s.label.split(' ')[0]}
              </span>
            </div>
          );
        })}
      </div>
    </motion.div>
  );
};
