import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, Loader2, RefreshCw } from 'lucide-react';
import { BASELINE_DIMENSIONS, DIMENSION_MAP, DIMENSION_META } from '../data/challenges.ts';
import { synthesizeProfileWithAI } from '../services/mindtraceApi.ts';
import {
  CognitiveDimension,
  CognitiveProfile,
  CompletedAttempt,
} from '../types/mindtrace.ts';
import { AbilityRadarMap } from './AbilityRadarMap.tsx';

interface CognitiveMapViewProps {
  dimensions: Record<CognitiveDimension, number>;
  attempts: CompletedAttempt[];
  profile: CognitiveProfile | null;
  onUpdateProfile: (profile: CognitiveProfile) => void;
  onGoToChallenges: () => void;
  onGenerateFocusedTraining: (dim: CognitiveDimension, mode: 'amplify' | 'unlock') => void;
}

export function CognitiveMapView({
  dimensions,
  attempts,
  profile,
  onUpdateProfile,
  onGoToChallenges,
  onGenerateFocusedTraining,
}: CognitiveMapViewProps) {
  const [selectedDim, setSelectedDim] = useState<CognitiveDimension>('logic');
  const [isSynthesizing, setIsSynthesizing] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const allStrengths = useMemo(() => {
    const items: Array<{ name: string; evidence: string; domainRelevance: string; source: string }> =
      [];
    for (const attempt of attempts) {
      for (const s of attempt.analysis.hiddenStrengths) {
        items.push({ ...s, source: attempt.challengeTitle });
      }
    }
    return items.slice(-6).reverse();
  }, [attempts]);

  const sortedDims = useMemo(
    () => [...DIMENSION_META].sort((a, b) => dimensions[b.key] - dimensions[a.key]),
    [dimensions]
  );

  const strongestDim = sortedDims[0];
  const growthDim = sortedDims[sortedDims.length - 1];
  const selectedMeta = DIMENSION_MAP[selectedDim];
  const selectedScore = dimensions[selectedDim];
  const selectedBaselineDelta = selectedScore - BASELINE_DIMENSIONS[selectedDim];

  const handleSynthesize = async () => {
    if (attempts.length === 0) return;
    setIsSynthesizing(true);
    setErrorMsg(null);
    try {
      const result = await synthesizeProfileWithAI({ dimensions, attempts });
      onUpdateProfile({
        ...result,
        updatedAt: new Date().toISOString(),
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось обновить портрет.');
    } finally {
      setIsSynthesizing(false);
    }
  };

  return (
    <div className="space-y-12 pb-16">
      <div className="flex flex-wrap items-end justify-between gap-4 border-b border-white/[0.08] pb-6">
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400">
            Профиль шести осей · Проанализировано решений: {attempts.length}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F2F4F8]">
            Индивидуальная карта способностей
          </h1>
        </div>

        {attempts.length > 0 && (
          <button
            type="button"
            onClick={handleSynthesize}
            disabled={isSynthesizing}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isSynthesizing ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <RefreshCw className="w-3.5 h-3.5" />
            )}
            <span>
              {profile ? 'Обновить AI-портрет' : 'Синтезировать AI-портрет'}
            </span>
          </button>
        )}
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Radar Map + Axis Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <div className="lg:col-span-6 bg-[#15171E] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-slate-300">
              Кликни по любой вершине для деталей
            </h2>
            <span className="text-xs text-slate-500">Пунктир: базовый уровень 42</span>
          </div>

          <AbilityRadarMap
            dimensions={dimensions}
            baseline={BASELINE_DIMENSIONS}
            selectedDimension={selectedDim}
            onSelectDimension={setSelectedDim}
          />
        </div>

        <div className="lg:col-span-6 space-y-6">
          {/* Selected Dimension Inspector */}
          <motion.div
            key={selectedDim}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.2 }}
            className="bg-[#15171E] border border-white/[0.08] rounded-2xl p-6 sm:p-7 space-y-5"
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs text-violet-300">Выбранная ось</p>
                <h2 className="text-xl font-semibold text-white mt-0.5">{selectedMeta.label}</h2>
              </div>
              <div className="text-right font-mono tabular-nums">
                <p className="text-2xl font-semibold text-white">{selectedScore}</p>
                <p className="text-xs text-slate-400">
                  {selectedBaselineDelta >= 0 ? `+${selectedBaselineDelta}` : selectedBaselineDelta}{' '}
                  от базы
                </p>
              </div>
            </div>

            <p className="text-sm text-slate-300 leading-relaxed">{selectedMeta.description}</p>

            {/* Clean linear bar */}
            <div className="h-1.5 w-full rounded-full bg-white/[0.06] overflow-hidden">
              <div
                className="h-full bg-violet-500 transition-all duration-300"
                style={{ width: `${selectedScore}%` }}
              />
            </div>

            <div className="pt-2 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() =>
                  onGenerateFocusedTraining(
                    selectedDim,
                    selectedScore >= 55 ? 'amplify' : 'unlock'
                  )
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-xs font-medium text-violet-200 transition-colors cursor-pointer"
              >
                <span>
                  {selectedScore >= 55 ? 'Усилить эту грань' : 'Прокачать эту зону роста'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          </motion.div>

          {/* All 6 dimensions compact tabular breakdown */}
          <div className="bg-[#15171E] border border-white/[0.08] rounded-2xl divide-y divide-white/[0.07]">
            {sortedDims.map((dim, idx) => {
              const score = dimensions[dim.key];
              const isSelected = dim.key === selectedDim;
              return (
                <button
                  key={dim.key}
                  type="button"
                  onClick={() => setSelectedDim(dim.key)}
                  className={`w-full px-5 py-3.5 flex items-center justify-between gap-4 text-left transition-colors cursor-pointer ${
                    isSelected ? 'bg-white/[0.04]' : 'hover:bg-white/[0.02]'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <span className="text-xs font-mono tabular-nums text-slate-500">
                      0{idx + 1}
                    </span>
                    <span className="text-sm text-slate-200 truncate">{dim.label}</span>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span className="text-xs text-slate-500 hidden sm:inline">
                      {dim.key === strongestDim.key && attempts.length > 0
                        ? 'Ведущая'
                        : dim.key === growthDim.key && attempts.length > 0
                          ? 'Зона роста'
                          : ''}
                    </span>
                    <span className="text-sm font-mono tabular-nums font-medium text-white w-8 text-right">
                      {score}
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Cognitive Archetype & Real-World Directions */}
      {attempts.length === 0 ? (
        <section className="bg-[#15171E] border border-dashed border-white/[0.12] rounded-2xl p-8 text-center space-y-4">
          <h2 className="text-xl font-semibold text-[#F2F4F8]">
            Твоя карта ждёт первых решений
          </h2>
          <p className="text-sm text-slate-400 max-w-xl mx-auto leading-relaxed">
            Реши хотя бы одно нестандартное задание в разделе «Задания», чтобы ИИ распознал твой
            почерк мышления, выделил скрытые таланты и собрал персональный интеллектуальный
            портрет.
          </p>
          <div>
            <button
              type="button"
              onClick={onGoToChallenges}
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors cursor-pointer"
            >
              <span>Перейти к заданиям</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </section>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Archetype Summary */}
          <section className="lg:col-span-7 bg-[#15171E] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-6">
            {profile ? (
              <>
                <div className="space-y-1.5">
                  <p className="text-xs text-violet-300">Синтезированный архетип мышления</p>
                  <h2 className="text-2xl sm:text-3xl font-semibold text-white">
                    {profile.archetypeName}
                  </h2>
                  <p className="text-sm text-slate-400">{profile.tagline}</p>
                </div>

                <p className="text-sm sm:text-base text-slate-200 leading-relaxed">
                  {profile.summary}
                </p>

                <div className="pt-4 border-t border-white/[0.07] space-y-2">
                  <p className="text-xs text-slate-400">Интеллектуальный почерк</p>
                  <p className="text-sm text-slate-200 leading-relaxed">
                    {profile.thinkingSignature}
                  </p>
                </div>

                <div className="pt-4 border-t border-white/[0.07] space-y-3">
                  <h3 className="text-sm font-semibold text-slate-200">
                    Сферы и роли, где твой ум раскрывается сильнее всего
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    {profile.recommendedDirections.map((dir, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-[#101218] border border-white/[0.06] space-y-1.5"
                      >
                        <p className="text-sm font-medium text-violet-300">{dir.title}</p>
                        <p className="text-xs text-slate-400 leading-relaxed">{dir.whyItFits}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            ) : (
              <div className="space-y-4 py-4">
                <p className="text-xs text-violet-300">Готово к синтезу</p>
                <h2 className="text-xl font-semibold text-white">
                  Собери целостный портрет своих способностей
                </h2>
                <p className="text-sm text-slate-400 leading-relaxed">
                  У тебя уже есть {attempts.length} проанализированных решений. Нажми «Синтезировать
                  AI-портрет», чтобы объединить наблюдения в единый архетип и получить карту
                  подходящих направлений развития.
                </p>
                <button
                  type="button"
                  onClick={handleSynthesize}
                  disabled={isSynthesizing}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors cursor-pointer"
                >
                  {isSynthesizing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Синтезировать AI-портрет</span>
                </button>
              </div>
            )}
          </section>

          {/* Discovered Hidden Strengths Log */}
          <section className="lg:col-span-5 bg-[#15171E] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-5">
            <h2 className="text-lg font-semibold text-white">Найденные сильные стороны</h2>
            <div className="divide-y divide-white/[0.07]">
              {allStrengths.map((item, idx) => (
                <div key={idx} className="py-4 first:pt-0 last:pb-0 space-y-1.5">
                  <div className="flex items-baseline justify-between gap-3">
                    <p className="text-sm font-medium text-violet-300">{item.name}</p>
                    <span className="text-xs text-slate-500 truncate max-w-[160px]">
                      {item.source}
                    </span>
                  </div>
                  <p className="text-xs text-slate-300 leading-relaxed">{item.evidence}</p>
                  <p className="text-xs text-slate-500">Применение: {item.domainRelevance}</p>
                </div>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
