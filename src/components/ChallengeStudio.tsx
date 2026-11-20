import { useEffect, useMemo, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import {
  ArrowDown,
  ArrowUp,
  Check,
  ChevronRight,
  HelpCircle,
  Loader2,
  Plus,
  RotateCcw,
  Sparkles,
} from 'lucide-react';
import { DIMENSION_MAP } from '../data/challenges.ts';
import { analyzeChallengeWithAI, generateChallengeWithAI } from '../services/mindtraceApi.ts';
import {
  AIAnalysisResult,
  Challenge,
  ChallengeCategory,
  CognitiveDimension,
  CompletedAttempt,
  SequenceStepOption,
} from '../types/mindtrace.ts';

interface ChallengeStudioProps {
  challenges: Challenge[];
  selectedCategory: ChallengeCategory | 'Все';
  onSelectCategory: (cat: ChallengeCategory | 'Все') => void;
  activeChallengeId: string;
  onSelectChallengeId: (id: string) => void;
  currentDimensions: Record<CognitiveDimension, number>;
  completedChallengeIds: Set<string>;
  onAddCustomChallenge: (challenge: Challenge) => void;
  onCompleteAttempt: (attempt: CompletedAttempt) => void;
  onAddMicroQuest: (analysis: AIAnalysisResult) => void;
  onOpenMap: () => void;
}

const FILTER_OPTIONS: Array<ChallengeCategory | 'Все'> = [
  'Все',
  'Логика',
  'Творчество',
  'Анализ',
  'Нестандартное мышление',
];

function formatTimer(sec: number): string {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function ChallengeStudio({
  challenges,
  selectedCategory,
  onSelectCategory,
  activeChallengeId,
  onSelectChallengeId,
  currentDimensions,
  completedChallengeIds,
  onAddCustomChallenge,
  onCompleteAttempt,
  onAddMicroQuest,
  onOpenMap,
}: ChallengeStudioProps) {
  const filteredChallenges = useMemo(() => {
    if (selectedCategory === 'Все') return challenges;
    return challenges.filter((c) => c.category === selectedCategory);
  }, [challenges, selectedCategory]);

  const activeChallenge = useMemo(() => {
    return (
      challenges.find((c) => c.id === activeChallengeId) ||
      filteredChallenges[0] ||
      challenges[0]
    );
  }, [challenges, filteredChallenges, activeChallengeId]);

  const [answerText, setAnswerText] = useState('');
  const [processText, setProcessText] = useState('');
  const [showHint, setShowHint] = useState(false);
  const [hintUsed, setHintUsed] = useState(false);
  const [revisionsCount, setRevisionsCount] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Interactive Matrix state (3x3 binary grid for 9th tile)
  const [matrixGrid, setMatrixGrid] = useState<number[][]>([
    [0, 0, 0],
    [0, 0, 0],
    [0, 0, 0],
  ]);

  // Interactive Sequence state
  const [sequenceOrder, setSequenceOrder] = useState<SequenceStepOption[]>([]);

  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [latestResult, setLatestResult] = useState<AIAnalysisResult | null>(null);
  const [microQuestAdded, setMicroQuestAdded] = useState(false);

  const prevAnswerLenRef = useRef(0);

  // Reset workspace when switching challenge
  useEffect(() => {
    setAnswerText('');
    setProcessText('');
    setShowHint(false);
    setHintUsed(false);
    setRevisionsCount(0);
    setElapsedSeconds(0);
    setErrorMsg(null);
    setLatestResult(null);
    setMicroQuestAdded(false);
    prevAnswerLenRef.current = 0;
    setMatrixGrid([
      [0, 0, 0],
      [0, 0, 0],
      [0, 0, 0],
    ]);
    if (activeChallenge?.sequenceItems) {
      setSequenceOrder([...activeChallenge.sequenceItems].reverse());
    } else {
      setSequenceOrder([]);
    }
  }, [activeChallenge?.id]);

  // Session thinking timer
  useEffect(() => {
    if (latestResult || isAnalyzing) return;
    const timer = window.setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [latestResult, isAnalyzing, activeChallenge?.id]);

  const handleAnswerChange = (val: string) => {
    if (val.length < prevAnswerLenRef.current - 6) {
      setRevisionsCount((c) => c + 1);
    }
    prevAnswerLenRef.current = val.length;
    setAnswerText(val);
  };

  const toggleMatrixCell = (r: number, c: number) => {
    setRevisionsCount((cnt) => cnt + 1);
    setMatrixGrid((prev) =>
      prev.map((row, ri) => row.map((cell, ci) => (ri === r && ci === c ? (cell ? 0 : 1) : cell)))
    );
  };

  const moveSequenceItem = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= sequenceOrder.length) return;
    setRevisionsCount((cnt) => cnt + 1);
    setSequenceOrder((prev) => {
      const next = [...prev];
      const temp = next[index];
      next[index] = next[target];
      next[target] = temp;
      return next;
    });
  };

  const handleRevealHint = () => {
    setShowHint((prev) => !prev);
    if (!hintUsed) setHintUsed(true);
  };

  const handleGenerateAiChallenge = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    try {
      const cat = selectedCategory === 'Все' ? undefined : selectedCategory;
      const generated = await generateChallengeWithAI({
        category: cat,
        recentTitles: challenges.map((c) => c.title),
      });
      const newChallenge: Challenge = {
        id: `ai-${Date.now()}`,
        title: generated.title,
        category: (['Логика', 'Творчество', 'Анализ', 'Нестандартное мышление'].includes(
          generated.category
        )
          ? generated.category
          : 'Нестандартное мышление') as ChallengeCategory,
        difficulty: (['Базовый', 'Продвинутый', 'Эксперимент'].includes(generated.difficulty)
          ? generated.difficulty
          : 'Продвинутый') as Challenge['difficulty'],
        durationLabel: generated.durationLabel || '3–4 мин',
        prompt: generated.prompt,
        contextNote: generated.contextNote,
        hint: generated.hint,
        answerPrompt: generated.answerPrompt,
        processPrompt: generated.processPrompt,
        interactiveType: 'reasoning',
        isAiGenerated: true,
      };
      onAddCustomChallenge(newChallenge);
      onSelectChallengeId(newChallenge.id);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Не удалось создать задачу.');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeChallenge) return;
    if (answerText.trim().length < 10) {
      setErrorMsg('Опишите ответ немного подробнее (хотя бы 1–2 осмысленных предложения).');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg(null);

    let interactiveSummary = '';
    if (activeChallenge.interactiveType === 'matrix') {
      interactiveSummary = `Собранная 9-я матрица 3x3: ${JSON.stringify(matrixGrid)}`;
    } else if (activeChallenge.interactiveType === 'sequence') {
      interactiveSummary = `Порядок протокола пользователя: ${sequenceOrder
        .map((s, i) => `${i + 1}. ${s.label}`)
        .join(' -> ')}`;
    }

    const telemetry = {
      durationSeconds: elapsedSeconds,
      hintUsed,
      revisionsCount,
      interactiveSummary: interactiveSummary || undefined,
    };

    try {
      const analysis = await analyzeChallengeWithAI({
        challenge: {
          title: activeChallenge.title,
          category: activeChallenge.category,
          difficulty: activeChallenge.difficulty,
          prompt: activeChallenge.prompt,
        },
        answerText: answerText.trim(),
        processText: processText.trim(),
        telemetry,
        currentDimensions,
      });

      setLatestResult(analysis);
      onCompleteAttempt({
        id: `attempt-${Date.now()}`,
        challengeId: activeChallenge.id,
        challengeTitle: activeChallenge.title,
        category: activeChallenge.category,
        timestamp: new Date().toISOString(),
        answerText: answerText.trim(),
        processText: processText.trim(),
        telemetry,
        analysis,
      });
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Ошибка анализа ответа.');
    } finally {
      setIsAnalyzing(false);
    }
  };

  if (!activeChallenge) return null;

  return (
    <div className="space-y-8 pb-16">
      {/* Filter & AI Challenge Generation Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 border-b border-white/[0.08] pb-5">
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-[#15171E] border border-white/[0.08] rounded-xl w-fit">
          {FILTER_OPTIONS.map((cat) => {
            const active = selectedCategory === cat;
            return (
              <button
                key={cat}
                type="button"
                onClick={() => onSelectCategory(cat)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-400 hover:text-slate-200 hover:bg-white/[0.04]'
                }`}
              >
                {cat}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={handleGenerateAiChallenge}
          disabled={isGenerating}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 text-violet-200 text-xs font-medium transition-colors disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
        >
          {isGenerating ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <Plus className="w-3.5 h-3.5" />
          )}
          <span>{isGenerating ? 'Генерация задачи...' : 'Создать новую задачу с ИИ'}</span>
        </button>
      </div>

      {/* Main Split Workspace: Task Selector + Interactive Arena */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
        {/* Left List of Challenges */}
        <aside className="lg:col-span-4 space-y-2">
          <div className="flex items-center justify-between px-1 pb-2">
            <h2 className="text-sm font-semibold text-slate-300">Банк заданий</h2>
            <span className="text-xs font-mono tabular-nums text-slate-500">
              {filteredChallenges.length}
            </span>
          </div>

          <div className="space-y-2">
            {filteredChallenges.map((item) => {
              const isActive = item.id === activeChallenge.id;
              const isDone = completedChallengeIds.has(item.id);
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onSelectChallengeId(item.id)}
                  className={`w-full text-left p-4 rounded-xl border transition-colors cursor-pointer ${
                    isActive
                      ? 'bg-[#191C26] border-violet-500/60'
                      : 'bg-[#15171E] border-white/[0.07] hover:border-white/[0.15] hover:bg-[#171A23]'
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="space-y-1.5 min-w-0">
                      <p className="text-xs text-slate-400 truncate">
                        {item.category} · {item.difficulty}
                        {item.isAiGenerated ? ' · ИИ-генерация' : ''}
                      </p>
                      <h3
                        className={`text-sm font-medium leading-snug ${
                          isActive ? 'text-white' : 'text-slate-200'
                        }`}
                      >
                        {item.title}
                      </h3>
                    </div>
                    {isDone ? (
                      <Check className="w-4 h-4 text-violet-400 shrink-0 mt-0.5" />
                    ) : (
                      <ChevronRight
                        className={`w-4 h-4 shrink-0 mt-0.5 transition-colors ${
                          isActive ? 'text-violet-400' : 'text-slate-600'
                        }`}
                      />
                    )}
                  </div>
                </button>
              );
            })}
          </div>
        </aside>

        {/* Right Interactive Arena */}
        <section className="lg:col-span-8 bg-[#15171E] border border-white/[0.08] rounded-2xl p-6 sm:p-8 space-y-7">
          {/* Challenge Header */}
          <div className="flex flex-wrap items-start justify-between gap-4 pb-6 border-b border-white/[0.07]">
            <div className="space-y-2 max-w-2xl">
              <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
                <span>{activeChallenge.category}</span>
                <span aria-hidden="true">·</span>
                <span>{activeChallenge.difficulty}</span>
                <span aria-hidden="true">·</span>
                <span>{activeChallenge.durationLabel}</span>
                {completedChallengeIds.has(activeChallenge.id) && (
                  <>
                    <span aria-hidden="true">·</span>
                    <span className="text-violet-300">Пройдено</span>
                  </>
                )}
              </div>
              <h2 className="text-2xl sm:text-3xl font-semibold text-[#F2F4F8] text-balance">
                {activeChallenge.title}
              </h2>
            </div>

            <div className="text-right shrink-0">
              <p className="text-xs text-slate-500">Время сессии</p>
              <p className="text-base font-mono tabular-nums text-slate-200 mt-0.5">
                {formatTimer(elapsedSeconds)}
              </p>
            </div>
          </div>

          {/* Prompt Body */}
          <div className="space-y-3">
            <p className="text-base text-slate-200 leading-relaxed">{activeChallenge.prompt}</p>
            <p className="text-xs text-slate-400 leading-relaxed">{activeChallenge.contextNote}</p>
          </div>

          {/* Interactive Matrix Puzzle if applicable */}
          {activeChallenge.interactiveType === 'matrix' && activeChallenge.matrixPreview && (
            <div className="pt-4 border-t border-white/[0.07] space-y-4">
              <div className="flex items-center justify-between gap-4">
                <p className="text-sm font-medium text-slate-200">
                  Интерактивная матрица (кликни по клеткам 9-го квадрата)
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setMatrixGrid([
                      [0, 0, 0],
                      [0, 0, 0],
                      [0, 0, 0],
                    ])
                  }
                  className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Очистить</span>
                </button>
              </div>

              <div className="grid grid-cols-3 gap-4 max-w-md">
                {activeChallenge.matrixPreview.map((tile, tIdx) => (
                  <div
                    key={tIdx}
                    className="p-2.5 rounded-xl bg-[#101218] border border-white/[0.07] grid grid-cols-3 gap-1.5 aspect-square"
                    aria-label={`Образец ${tIdx + 1}`}
                  >
                    {tile.flatMap((row, r) =>
                      row.map((cell, c) => (
                        <div
                          key={`${r}-${c}`}
                          className={`rounded-sm ${
                            cell ? 'bg-slate-300' : 'bg-white/[0.04]'
                          }`}
                        />
                      ))
                    )}
                  </div>
                ))}

                {/* 9th interactive tile */}
                <div
                  className="p-2.5 rounded-xl bg-[#101218] border border-violet-500/60 grid grid-cols-3 gap-1.5 aspect-square"
                  role="group"
                  aria-label="Собери 9-й квадрат"
                >
                  {matrixGrid.map((row, r) =>
                    row.map((cell, c) => (
                      <button
                        key={`${r}-${c}`}
                        type="button"
                        onClick={() => toggleMatrixCell(r, c)}
                        aria-pressed={Boolean(cell)}
                        aria-label={`Строка ${r + 1} столбец ${c + 1}`}
                        className={`rounded-sm transition-colors cursor-pointer ${
                          cell
                            ? 'bg-violet-500 hover:bg-violet-400'
                            : 'bg-white/[0.06] hover:bg-white/[0.14]'
                        }`}
                      />
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Interactive Sequence Builder if applicable */}
          {activeChallenge.interactiveType === 'sequence' && sequenceOrder.length > 0 && (
            <div className="pt-4 border-t border-white/[0.07] space-y-3">
              <p className="text-sm font-medium text-slate-200">
                Выстрой приоритетный порядок протокола стыковки
              </p>
              <div className="space-y-2">
                {sequenceOrder.map((step, idx) => (
                  <div
                    key={step.id}
                    className="flex items-center justify-between gap-4 p-3.5 rounded-xl bg-[#101218] border border-white/[0.07]"
                  >
                    <div className="flex items-start gap-3 min-w-0">
                      <span className="text-xs font-mono tabular-nums text-violet-300 mt-0.5">
                        0{idx + 1}
                      </span>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-200">{step.label}</p>
                        <p className="text-xs text-slate-400 mt-0.5">{step.detail}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        type="button"
                        onClick={() => moveSequenceItem(idx, -1)}
                        disabled={idx === 0}
                        aria-label="Поднять шаг выше"
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowUp className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => moveSequenceItem(idx, 1)}
                        disabled={idx === sequenceOrder.length - 1}
                        aria-label="Опустить шаг ниже"
                        className="p-2 rounded-lg text-slate-400 hover:text-white hover:bg-white/[0.06] disabled:opacity-30 cursor-pointer"
                      >
                        <ArrowDown className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Hint Toggle */}
          <div>
            <button
              type="button"
              onClick={handleRevealHint}
              className="inline-flex items-center gap-2 text-xs font-medium text-slate-400 hover:text-violet-300 transition-colors cursor-pointer"
            >
              <HelpCircle className="w-3.5 h-3.5" />
              <span>{showHint ? 'Скрыть подсказку' : 'Нужен вектор размышления?'}</span>
            </button>
            <AnimatePresence>
              {showHint && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.18 }}
                  className="mt-2.5 text-sm text-slate-300 bg-[#101218] border border-white/[0.07] rounded-xl p-4"
                >
                  {activeChallenge.hint}
                </motion.p>
              )}
            </AnimatePresence>
          </div>

          {/* Reasoning & Solution Form */}
          <form onSubmit={handleSubmit} className="space-y-5 pt-4 border-t border-white/[0.07]">
            <div className="space-y-2">
              <label htmlFor="mindtrace-answer" className="block text-sm font-medium text-slate-200">
                {activeChallenge.answerPrompt}
              </label>
              <textarea
                id="mindtrace-answer"
                rows={4}
                value={answerText}
                onChange={(e) => handleAnswerChange(e.target.value)}
                placeholder="Сформулируй решение своими словами — здесь ценятся смелые гипотезы и чёткая логика..."
                className="w-full rounded-xl bg-[#101218] border border-white/[0.1] focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 leading-relaxed resize-y"
              />
            </div>

            <div className="space-y-2">
              <label htmlFor="mindtrace-process" className="block text-sm font-medium text-slate-300">
                {activeChallenge.processPrompt}
              </label>
              <textarea
                id="mindtrace-process"
                rows={2}
                value={processText}
                onChange={(e) => setProcessText(e.target.value)}
                placeholder="Например: сначала я представил крайний случай, затем отбросил очевидный вариант..."
                className="w-full rounded-xl bg-[#101218] border border-white/[0.1] focus:border-violet-500 focus:outline-none focus:ring-1 focus:ring-violet-500 px-4 py-3 text-sm text-slate-100 placeholder:text-slate-600 leading-relaxed resize-y"
              />
            </div>

            {errorMsg && (
              <div
                role="alert"
                className="p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/30 text-sm text-rose-200"
              >
                {errorMsg}
              </div>
            )}

            <div className="flex flex-wrap items-center justify-between gap-4">
              <span className="text-xs text-slate-500">
                ИИ проанализирует и сам ответ, и последовательность твоих рассуждений
              </span>
              <button
                type="submit"
                disabled={isAnalyzing}
                className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 disabled:opacity-60 text-white text-sm font-medium transition-colors cursor-pointer whitespace-nowrap shrink-0"
              >
                {isAnalyzing ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Анализирую ход мыслей...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Отправить на анализ ИИ</span>
                  </>
                )}
              </button>
            </div>
          </form>

          {/* AI Analysis Output */}
          <AnimatePresence>
            {latestResult && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
                className="pt-8 border-t border-violet-500/30 space-y-6"
              >
                <div className="flex flex-wrap items-baseline justify-between gap-4">
                  <div>
                    <p className="text-xs text-violet-300">Распознанный стиль решения</p>
                    <h3 className="text-2xl font-semibold text-white mt-1">
                      {latestResult.solvingStyle}
                    </h3>
                  </div>
                  <button
                    type="button"
                    onClick={onOpenMap}
                    className="text-xs font-medium text-violet-300 hover:text-violet-200 underline underline-offset-4 cursor-pointer"
                  >
                    Посмотреть на карте способностей
                  </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-400">
                      Как ты шёл к решению
                    </h4>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {latestResult.solvingProcessObservation}
                    </p>
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-xs font-medium text-slate-400">Ключевой вывод</h4>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {latestResult.insightSummary}
                    </p>
                  </div>
                </div>

                {/* Discovered Hidden Strengths */}
                <div className="space-y-3 pt-4 border-t border-white/[0.07]">
                  <h4 className="text-sm font-semibold text-slate-200">
                    Обнаруженные сильные стороны
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {latestResult.hiddenStrengths.map((str, i) => (
                      <div
                        key={i}
                        className="p-4 rounded-xl bg-[#101218] border border-white/[0.07] space-y-2"
                      >
                        <p className="text-sm font-semibold text-violet-300">{str.name}</p>
                        <p className="text-xs text-slate-300 leading-relaxed">{str.evidence}</p>
                        <p className="text-xs text-slate-500">Где ценно: {str.domainRelevance}</p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Dimension Deltas */}
                <div className="space-y-3 pt-4 border-t border-white/[0.07]">
                  <h4 className="text-sm font-semibold text-slate-200">Сдвиг на карте способностей</h4>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                    {(Object.keys(latestResult.dimensionDeltas) as CognitiveDimension[]).map(
                      (dimKey) => {
                        const delta = latestResult.dimensionDeltas[dimKey];
                        const score = latestResult.dimensionScores[dimKey];
                        return (
                          <div
                            key={dimKey}
                            className="p-3 rounded-xl bg-[#101218] border border-white/[0.06] flex items-center justify-between gap-2"
                          >
                            <span className="text-xs text-slate-300 truncate">
                              {DIMENSION_MAP[dimKey]?.shortLabel || dimKey}
                            </span>
                            <div className="text-right font-mono tabular-nums shrink-0">
                              <span className="text-xs text-white">{score}</span>
                              <span
                                className={`ml-1.5 text-[11px] ${
                                  delta > 0
                                    ? 'text-emerald-400'
                                    : delta < 0
                                      ? 'text-amber-400'
                                      : 'text-slate-500'
                                }`}
                              >
                                {delta > 0 ? `+${delta}` : delta}
                              </span>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Growth Edge & Personalized Next Step */}
                <div className="pt-4 border-t border-white/[0.07] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div className="space-y-1 max-w-xl">
                    <p className="text-xs text-slate-400">Точка следующего роста</p>
                    <p className="text-sm text-slate-200 leading-relaxed">
                      {latestResult.growthEdge}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={microQuestAdded}
                    onClick={() => {
                      onAddMicroQuest(latestResult);
                      setMicroQuestAdded(true);
                    }}
                    className="px-4 py-2.5 rounded-xl border border-violet-500/40 bg-violet-500/10 hover:bg-violet-500/20 disabled:opacity-60 text-xs font-medium text-violet-200 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    {microQuestAdded
                      ? 'Добавлено в Тренировку'
                      : 'Сохранить персональный квест'}
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </section>
      </div>
    </div>
  );
}
