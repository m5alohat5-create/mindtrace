import { useMemo, useState } from 'react';
import { motion } from 'motion/react';
import { Check, ChevronDown, ChevronUp, Loader2, Sparkles } from 'lucide-react';
import { DIMENSION_MAP, DIMENSION_META } from '../data/challenges.ts';
import { analyzeChallengeWithAI, generateChallengeWithAI } from '../services/mindtraceApi.ts';
import {
  CognitiveDimension,
  CompletedAttempt,
  TrainingQuest,
} from '../types/mindtrace.ts';
import { ProgressCurveChart } from './ProgressCurveChart.tsx';

interface TrainingViewProps {
  dimensions: Record<CognitiveDimension, number>;
  quests: TrainingQuest[];
  attempts: CompletedAttempt[];
  onAddQuest: (quest: TrainingQuest) => void;
  onCompleteQuest: (questId: string, attempt: CompletedAttempt) => void;
  preselectedTarget?: { dim: CognitiveDimension; mode: 'amplify' | 'unlock' } | null;
}

export function TrainingView({
  dimensions,
  quests,
  attempts,
  onAddQuest,
  onCompleteQuest,
  preselectedTarget,
}: TrainingViewProps) {
  const sortedDims = useMemo(
    () => [...DIMENSION_META].sort((a, b) => dimensions[b.key] - dimensions[a.key]),
    [dimensions]
  );

  const [focusMode, setFocusMode] = useState<'amplify' | 'unlock'>(
    preselectedTarget?.mode || 'unlock'
  );
  const [targetDim, setTargetDim] = useState<CognitiveDimension>(
    preselectedTarget?.dim ||
      (focusMode === 'unlock'
        ? sortedDims[sortedDims.length - 1].key
        : sortedDims[0].key)
  );

  const [activeQuestId, setActiveQuestId] = useState<string | null>(
    quests.find((q) => !q.completed)?.id || quests[0]?.id || null
  );
  const [answerText, setAnswerText] = useState('');
  const [processText, setProcessText] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [expandedAttemptId, setExpandedAttemptId] = useState<string | null>(null);

  const activeQuest = useMemo(
    () => quests.find((q) => q.id === activeQuestId) || null,
    [quests, activeQuestId]
  );

  const handleGenerateQuest = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const generated = await generateChallengeWithAI({
        targetDimension: targetDim,
        focusMode,
        recentTitles: [
          ...quests.map((q) => q.title),
          ...attempts.map((a) => a.challengeTitle),
        ],
      });

      const newQuest: TrainingQuest = {
        id: `quest-${Date.now()}`,
        title: generated.title,
        category: (['Логика', 'Творчество', 'Анализ', 'Нестандартное мышление'].includes(
          generated.category
        )
          ? generated.category
          : 'Нестандартное мышление') as TrainingQuest['category'],
        targetDimension: targetDim,
        focusMode,
        durationLabel: generated.durationLabel || '3 мин',
        prompt: generated.prompt,
        answerPrompt: generated.answerPrompt || 'Опиши своё решение',
        processPrompt: generated.processPrompt || 'Как ты пришёл к этому варианту?',
        rationale: generated.rationale,
        completed: false,
      };
      onAddQuest(newQuest);
      setActiveQuestId(newQuest.id);
      setAnswerText('');
      setProcessText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось создать тренировочный квест.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSolveQuest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeQuest) return;
    if (answerText.trim().length < 10) {
      setErrorMsg('Опиши решение немного подробнее, чтобы ИИ оценил прогресс.');
      return;
    }

    setIsSubmitting(true);
    setErrorMsg(null);
    const telemetry = {
      durationSeconds: 120,
      hintUsed: false,
      revisionsCount: 0,
      interactiveSummary: `Персональная тренировка (${
        activeQuest.focusMode === 'amplify' ? 'усиление сильной стороны' : 'зона роста'
      }: ${DIMENSION_MAP[activeQuest.targetDimension].label})`,
    };

    try {
      const analysis = await analyzeChallengeWithAI({
        challenge: {
          title: activeQuest.title,
          category: activeQuest.category,
          difficulty: 'Продвинутый',
          prompt: activeQuest.prompt,
        },
        answerText: answerText.trim(),
        processText: processText.trim(),
        telemetry,
        currentDimensions: dimensions,
      });

      const attempt: CompletedAttempt = {
        id: `attempt-${Date.now()}`,
        challengeId: activeQuest.id,
        challengeTitle: activeQuest.title,
        category: activeQuest.category,
        timestamp: new Date().toISOString(),
        answerText: answerText.trim(),
        processText: processText.trim(),
        telemetry,
        analysis,
      };

      onCompleteQuest(activeQuest.id, attempt);
      setAnswerText('');
      setProcessText('');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка анализа тренировки.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-12 pb-16">
      {/* Header + Generator Controls */}
      <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 border-b border-white/[0.08] pb-6">
        <div className="space-y-1.5">
          <p className="text-xs text-slate-400">
            Персональное развитие · Выполнено тренировок: {quests.filter((q) => q.completed).length}
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold text-[#F2F4F8]">
            Траектория и персональные тренировки
          </h1>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center p-1 bg-[#15171E] border border-white/[0.08] rounded-xl">
            <button
              type="button"
              onClick={() => setFocusMode('unlock')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                focusMode === 'unlock'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Зона роста
            </button>
            <button
              type="button"
              onClick={() => setFocusMode('amplify')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                focusMode === 'amplify'
                  ? 'bg-violet-600 text-white'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              Усилить талант
            </button>
          </div>

          <select
            aria-label="Целевая способность"
            value={targetDim}
            onChange={(e) => setTargetDim(e.target.value as CognitiveDimension)}
            className="px-3.5 py-2 rounded-xl bg-[#15171E] border border-white/[0.1] text-xs text-slate-200 focus:outline-none focus:border-violet-500 cursor-pointer"
          >
            {DIMENSION_META.map((d) => (
              <option key={d.key} value={d.key}>
                {d.shortLabel} ({dimensions[d.key]})
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={handleGenerateQuest}
            disabled={isGenerating}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {isGenerating ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin" />
            ) : (
              <Sparkles className="w-3.5 h-3.5" />
            )}
            <span>{isGenerating ? 'Подбираю квест...' : 'Создать тренировку'}</span>
          </button>
        </div>
      </div>

      {errorMsg && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200"
        >
          {errorMsg}
        </div>
      )}

      {/* Quests Split */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        <aside className="lg:col-span-5 space-y-3">
          <h2 className="text-sm font-semibold text-slate-300">Персональные квесты</h2>

          {quests.length === 0 ? (
            <div className="p-6 rounded-2xl bg-[#15171E] border border-dashed border-white/[0.1] space-y-3">
              <p className="text-sm font-medium text-slate-200">Персональных квестов пока нет</p>
              <p className="text-xs text-slate-400 leading-relaxed">
                Выбери режим «Зона роста» или «Усилить талант» выше и нажми «Создать тренировку» —
                или сохрани микро-челлендж после разбора любой задачи.
              </p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {quests.map((q) => {
                const isSelected = q.id === activeQuest?.id;
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      setActiveQuestId(q.id);
                      setErrorMsg(null);
                    }}
                    className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#191C26] border-violet-500/60'
                        : 'bg-[#15171E] border-white/[0.07] hover:border-white/[0.14]'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <p className="text-xs text-slate-400 truncate">
                          {DIMENSION_MAP[q.targetDimension]?.shortLabel} ·{' '}
                          {q.focusMode === 'amplify' ? 'Усиление' : 'Зона роста'} · {q.durationLabel}
                        </p>
                        <p className="text-sm font-medium text-slate-100">{q.title}</p>
                      </div>
                      {q.completed && <Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />}
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </aside>

        {/* Active Quest Solver */}
        <section className="lg:col-span-7 bg-[#15171E] border border-white/[0.08] rounded-2xl p-6 sm:p-8">
          {activeQuest ? (
            <div className="space-y-6">
              <div className="space-y-2 pb-5 border-b border-white/[0.07]">
                <p className="text-xs text-violet-300">
                  {DIMENSION_MAP[activeQuest.targetDimension]?.label} ·{' '}
                  {activeQuest.focusMode === 'amplify' ? 'Усиление сильной стороны' : 'Открытие зоны роста'}
                </p>
                <h2 className="text-xl sm:text-2xl font-semibold text-white">
                  {activeQuest.title}
                </h2>
                <p className="text-xs text-slate-400">{activeQuest.rationale}</p>
              </div>

              <p className="text-base text-slate-200 leading-relaxed">{activeQuest.prompt}</p>

              {activeQuest.completed && activeQuest.analysis ? (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="pt-5 border-t border-white/[0.07] space-y-4"
                >
                  <p className="text-xs text-emerald-400">Тренировка засчитана</p>
                  <p className="text-base font-medium text-white">
                    {activeQuest.analysis.solvingStyle}
                  </p>
                  <p className="text-sm text-slate-300 leading-relaxed">
                    {activeQuest.analysis.insightSummary}
                  </p>
                  <p className="text-xs text-slate-400">
                    Следующий шаг: {activeQuest.analysis.growthEdge}
                  </p>
                </motion.div>
              ) : (
                <form onSubmit={handleSolveQuest} className="space-y-4 pt-4 border-t border-white/[0.07]">
                  <div className="space-y-2">
                    <label htmlFor="quest-answer" className="block text-sm font-medium text-slate-200">
                      {activeQuest.answerPrompt}
                    </label>
                    <textarea
                      id="quest-answer"
                      rows={4}
                      value={answerText}
                      onChange={(e) => setAnswerText(e.target.value)}
                      placeholder="Сформулируй своё решение..."
                      className="w-full rounded-xl bg-[#101218] border border-white/[0.1] focus:border-violet-500 focus:outline-none px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="quest-process" className="block text-sm font-medium text-slate-300">
                      {activeQuest.processPrompt}
                    </label>
                    <textarea
                      id="quest-process"
                      rows={2}
                      value={processText}
                      onChange={(e) => setProcessText(e.target.value)}
                      placeholder="На что опирался при выборе этого подхода?"
                      className="w-full rounded-xl bg-[#101218] border border-white/[0.1] focus:border-violet-500 focus:outline-none px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600"
                    />
                  </div>
                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer"
                    >
                      {isSubmitting && <Loader2 className="w-4 h-4 animate-spin" />}
                      <span>{isSubmitting ? 'Проверяю...' : 'Завершить тренировку'}</span>
                    </button>
                  </div>
                </form>
              )}
            </div>
          ) : (
            <div className="py-10 text-center space-y-3">
              <p className="text-sm font-medium text-slate-300">
                Выбери или создай персональный квест
              </p>
              <p className="text-xs text-slate-500 max-w-md mx-auto">
                Каждое тренировочное задание учитывает твой текущий профиль и помогает сдвинуть
                выбранную ось на карте способностей.
              </p>
            </div>
          )}
        </section>
      </div>

      {/* Progress Curve & Completed History */}
      <section className="bg-[#15171E] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-6">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 className="text-lg font-semibold text-white">Динамика когнитивного профиля</h2>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            Всего сессий: {attempts.length}
          </span>
        </div>

        <ProgressCurveChart attempts={attempts} />

        {attempts.length > 0 && (
          <div className="pt-6 border-t border-white/[0.07] space-y-2">
            <h3 className="text-sm font-semibold text-slate-300 pb-2">Журнал решений и инсайтов</h3>
            <div className="divide-y divide-white/[0.07]">
              {[...attempts].reverse().map((attempt) => {
                const isExpanded = expandedAttemptId === attempt.id;
                return (
                  <div key={attempt.id} className="py-3.5">
                    <button
                      type="button"
                      onClick={() =>
                        setExpandedAttemptId(isExpanded ? null : attempt.id)
                      }
                      className="w-full flex items-center justify-between gap-4 text-left cursor-pointer group"
                    >
                      <div className="min-w-0 space-y-0.5">
                        <p className="text-sm font-medium text-slate-200 group-hover:text-violet-300 transition-colors truncate">
                          {attempt.challengeTitle}
                        </p>
                        <p className="text-xs text-slate-500">
                          {attempt.category} · {attempt.analysis.solvingStyle} ·{' '}
                          <span className="font-mono tabular-nums">
                            {attempt.telemetry.durationSeconds} сек
                          </span>
                        </p>
                      </div>
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-slate-400 shrink-0" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 pt-3 border-t border-white/[0.05] space-y-2.5 text-xs text-slate-300">
                        <p>
                          <span className="text-slate-500">Твоё решение:</span> {attempt.answerText}
                        </p>
                        <p>
                          <span className="text-slate-500">Вывод ИИ:</span>{' '}
                          {attempt.analysis.insightSummary}
                        </p>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
