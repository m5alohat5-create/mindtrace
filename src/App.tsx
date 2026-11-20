import { useEffect, useMemo, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { ChallengeStudio } from './components/ChallengeStudio.tsx';
import { CognitiveMapView } from './components/CognitiveMapView.tsx';
import { OverviewLab } from './components/OverviewLab.tsx';
import { TrainingView } from './components/TrainingView.tsx';
import { BASELINE_DIMENSIONS, INITIAL_CHALLENGES } from './data/challenges.ts';
import {
  AIAnalysisResult,
  Challenge,
  ChallengeCategory,
  CognitiveDimension,
  CognitiveProfile,
  CompletedAttempt,
  TrainingQuest,
} from './types/mindtrace.ts';

type AppTab = 'lab' | 'challenges' | 'map' | 'training';

const STORAGE_KEY = 'mindtrace_state_v1';

interface PersistedState {
  dimensions: Record<CognitiveDimension, number>;
  attempts: CompletedAttempt[];
  quests: TrainingQuest[];
  customChallenges: Challenge[];
  profile: CognitiveProfile | null;
}

function loadInitialState(): PersistedState {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<PersistedState>;
      return {
        dimensions: parsed.dimensions || { ...BASELINE_DIMENSIONS },
        attempts: Array.isArray(parsed.attempts) ? parsed.attempts : [],
        quests: Array.isArray(parsed.quests) ? parsed.quests : [],
        customChallenges: Array.isArray(parsed.customChallenges) ? parsed.customChallenges : [],
        profile: parsed.profile || null,
      };
    }
  } catch {
    // Ignore corrupted storage
  }
  return {
    dimensions: { ...BASELINE_DIMENSIONS },
    attempts: [],
    quests: [],
    customChallenges: [],
    profile: null,
  };
}

export default function App() {
  const initial = useMemo(() => loadInitialState(), []);

  const [activeTab, setActiveTab] = useState<AppTab>('lab');
  const [dimensions, setDimensions] = useState<Record<CognitiveDimension, number>>(
    initial.dimensions
  );
  const [attempts, setAttempts] = useState<CompletedAttempt[]>(initial.attempts);
  const [quests, setQuests] = useState<TrainingQuest[]>(initial.quests);
  const [customChallenges, setCustomChallenges] = useState<Challenge[]>(initial.customChallenges);
  const [profile, setProfile] = useState<CognitiveProfile | null>(initial.profile);

  const [selectedCategory, setSelectedCategory] = useState<ChallengeCategory | 'Все'>('Все');
  const [activeChallengeId, setActiveChallengeId] = useState<string>(INITIAL_CHALLENGES[0].id);
  const [trainingTarget, setTrainingTarget] = useState<{
    dim: CognitiveDimension;
    mode: 'amplify' | 'unlock';
  } | null>(null);

  const allChallenges = useMemo(
    () => [...customChallenges, ...INITIAL_CHALLENGES],
    [customChallenges]
  );

  const completedChallengeIds = useMemo(
    () => new Set(attempts.map((a) => a.challengeId)),
    [attempts]
  );

  useEffect(() => {
    try {
      const payload: PersistedState = {
        dimensions,
        attempts,
        quests,
        customChallenges,
        profile,
      };
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    } catch {
      // Ignore quota errors
    }
  }, [dimensions, attempts, quests, customChallenges, profile]);

  const applyAnalysisToDimensions = (analysis: AIAnalysisResult) => {
    setDimensions((prev) => {
      const next = { ...prev };
      (Object.keys(next) as CognitiveDimension[]).forEach((key) => {
        const delta = Number(analysis.dimensionDeltas?.[key] ?? 0);
        next[key] = Math.max(15, Math.min(99, Math.round(next[key] + delta)));
      });
      return next;
    });
  };

  const handleCompleteAttempt = (attempt: CompletedAttempt) => {
    setAttempts((prev) => [...prev, attempt]);
    applyAnalysisToDimensions(attempt.analysis);
  };

  const handleAddMicroQuest = (analysis: AIAnalysisResult) => {
    const mc = analysis.nextMicroChallenge;
    const validDims: CognitiveDimension[] = [
      'logic',
      'creativity',
      'analysis',
      'lateral',
      'systems',
      'empathy',
    ];
    const targetDim: CognitiveDimension = validDims.includes(mc.targetDimension)
      ? mc.targetDimension
      : 'lateral';

    const newQuest: TrainingQuest = {
      id: `micro-${Date.now()}`,
      title: mc.title,
      category: 'Нестандартное мышление',
      targetDimension: targetDim,
      focusMode: 'amplify',
      durationLabel: '2–3 мин',
      prompt: mc.prompt,
      answerPrompt: 'Сформулируй своё решение',
      processPrompt: 'Какой новый приём ты попробовал в этот раз?',
      rationale: `Персональный шаг после анализа стиля «${analysis.solvingStyle}».`,
      completed: false,
    };
    setQuests((prev) => [newQuest, ...prev]);
  };

  const handleCompleteQuest = (questId: string, attempt: CompletedAttempt) => {
    setQuests((prev) =>
      prev.map((q) =>
        q.id === questId
          ? {
              ...q,
              completed: true,
              completedAt: attempt.timestamp,
              analysis: attempt.analysis,
            }
          : q
      )
    );
    setAttempts((prev) => [...prev, attempt]);
    applyAnalysisToDimensions(attempt.analysis);
  };

  const handleStartDiagnostic = (category?: ChallengeCategory) => {
    if (category) {
      setSelectedCategory(category);
      const firstMatch = allChallenges.find((c) => c.category === category);
      if (firstMatch) setActiveChallengeId(firstMatch.id);
    } else {
      setSelectedCategory('Все');
      const unsolved = allChallenges.find((c) => !completedChallengeIds.has(c.id));
      if (unsolved) setActiveChallengeId(unsolved.id);
    }
    setActiveTab('challenges');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleGenerateFocusedTraining = (
    dim: CognitiveDimension,
    mode: 'amplify' | 'unlock'
  ) => {
    setTrainingTarget({ dim, mode });
    setActiveTab('training');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleResetProgress = () => {
    setDimensions({ ...BASELINE_DIMENSIONS });
    setAttempts([]);
    setQuests([]);
    setCustomChallenges([]);
    setProfile(null);
    window.localStorage.removeItem(STORAGE_KEY);
  };

  const navItems: Array<{ id: AppTab; label: string }> = [
    { id: 'lab', label: 'Лаборатория' },
    { id: 'challenges', label: 'Задания' },
    { id: 'map', label: 'Карта' },
    { id: 'training', label: 'Тренировка' },
  ];

  return (
    <div className="min-h-screen bg-[#0E0F13] text-[#F2F4F8] flex flex-col">
      {/* Three-Zone Top Bar Contract */}
      <header className="border-b border-white/[0.08] bg-[#0E0F13]">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Single-line Wordmark */}
          <button
            type="button"
            onClick={() => setActiveTab('lab')}
            className="font-display text-lg font-bold tracking-tight text-white whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded"
          >
            MINDTRACE
          </button>

          {/* Zone 2: 4 Clean Single-Line Nav Links */}
          <nav
            aria-label="Основная навигация"
            className="hidden md:flex items-center gap-7 text-sm font-medium"
          >
            {navItems.map((item) => {
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setActiveTab(item.id)}
                  className={`relative py-1 transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 rounded ${
                    isActive ? 'text-white' : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  {item.label}
                  {isActive && (
                    <span className="absolute left-0 right-0 -bottom-[21px] h-[2px] bg-violet-500" />
                  )}
                </button>
              );
            })}
          </nav>

          {/* Zone 3: 1 Primary Action */}
          <div className="shrink-0">
            <button
              type="button"
              onClick={() => handleStartDiagnostic()}
              className="px-4 py-2 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-medium transition-colors whitespace-nowrap shrink-0 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400"
            >
              Решить задачу
            </button>
          </div>
        </div>

        {/* Mobile Secondary Row */}
        <nav
          aria-label="Мобильная навигация"
          className="md:hidden border-t border-white/[0.06] px-4 py-2 flex items-center justify-between gap-2 overflow-x-auto"
        >
          {navItems.map((item) => {
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveTab(item.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap shrink-0 transition-colors cursor-pointer ${
                  isActive ? 'bg-violet-600 text-white' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </nav>
      </header>

      {/* Main Content */}
      <main className="flex-1 w-full max-w-[1200px] mx-auto px-4 sm:px-6 pt-8">
        <AnimatePresence mode="wait">
          {activeTab === 'lab' && (
            <motion.div
              key="lab"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <OverviewLab
                dimensions={dimensions}
                attempts={attempts}
                onStartDiagnostic={handleStartDiagnostic}
                onOpenMap={() => setActiveTab('map')}
                onOpenTraining={() => setActiveTab('training')}
              />
            </motion.div>
          )}

          {activeTab === 'challenges' && (
            <motion.div
              key="challenges"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <ChallengeStudio
                challenges={allChallenges}
                selectedCategory={selectedCategory}
                onSelectCategory={setSelectedCategory}
                activeChallengeId={activeChallengeId}
                onSelectChallengeId={setActiveChallengeId}
                currentDimensions={dimensions}
                completedChallengeIds={completedChallengeIds}
                onAddCustomChallenge={(c) => setCustomChallenges((prev) => [c, ...prev])}
                onCompleteAttempt={handleCompleteAttempt}
                onAddMicroQuest={handleAddMicroQuest}
                onOpenMap={() => setActiveTab('map')}
              />
            </motion.div>
          )}

          {activeTab === 'map' && (
            <motion.div
              key="map"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <CognitiveMapView
                dimensions={dimensions}
                attempts={attempts}
                profile={profile}
                onUpdateProfile={setProfile}
                onGoToChallenges={() => handleStartDiagnostic()}
                onGenerateFocusedTraining={handleGenerateFocusedTraining}
              />
            </motion.div>
          )}

          {activeTab === 'training' && (
            <motion.div
              key="training"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            >
              <TrainingView
                dimensions={dimensions}
                quests={quests}
                attempts={attempts}
                onAddQuest={(q) => setQuests((prev) => [q, ...prev])}
                onCompleteQuest={handleCompleteQuest}
                preselectedTarget={trainingTarget}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Quiet Minimal Footer */}
      <footer className="border-t border-white/[0.07] mt-auto">
        <div className="max-w-[1200px] mx-auto px-4 sm:px-6 py-6 flex flex-wrap items-center justify-between gap-4 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>MINDTRACE</span>
            <span aria-hidden="true">·</span>
            <span>Индивидуальная карта способностей</span>
          </div>
          {attempts.length > 0 && (
            <button
              type="button"
              onClick={handleResetProgress}
              className="text-slate-500 hover:text-slate-300 transition-colors cursor-pointer"
            >
              Сбросить прогресс
            </button>
          )}
        </div>
      </footer>
    </div>
  );
}
