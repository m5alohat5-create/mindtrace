export type CognitiveDimension =
  | 'logic'
  | 'creativity'
  | 'analysis'
  | 'lateral'
  | 'systems'
  | 'empathy';

export type ChallengeCategory =
  | 'Логика'
  | 'Творчество'
  | 'Анализ'
  | 'Нестандартное мышление';

export type ChallengeDifficulty = 'Базовый' | 'Продвинутый' | 'Эксперимент';

export type ChallengeInteractiveType = 'reasoning' | 'matrix' | 'sequence';

export interface SequenceStepOption {
  id: string;
  label: string;
  detail: string;
}

export interface Challenge {
  id: string;
  title: string;
  category: ChallengeCategory;
  difficulty: ChallengeDifficulty;
  durationLabel: string;
  prompt: string;
  contextNote: string;
  hint: string;
  answerPrompt: string;
  processPrompt: string;
  interactiveType: ChallengeInteractiveType;
  sequenceItems?: SequenceStepOption[];
  matrixPreview?: number[][][]; // 8 known 3x3 binary tiles for visual pattern challenge
  isAiGenerated?: boolean;
}

export interface SolveTelemetry {
  durationSeconds: number;
  hintUsed: boolean;
  revisionsCount: number;
  interactiveSummary?: string;
}

export interface HiddenStrength {
  name: string;
  evidence: string;
  domainRelevance: string;
}

export interface AIAnalysisResult {
  solvingStyle: string;
  solvingProcessObservation: string;
  insightSummary: string;
  growthEdge: string;
  hiddenStrengths: HiddenStrength[];
  dimensionScores: Record<CognitiveDimension, number>;
  dimensionDeltas: Record<CognitiveDimension, number>;
  nextMicroChallenge: {
    title: string;
    prompt: string;
    targetDimension: CognitiveDimension;
  };
}

export interface CompletedAttempt {
  id: string;
  challengeId: string;
  challengeTitle: string;
  category: ChallengeCategory;
  timestamp: string;
  answerText: string;
  processText: string;
  telemetry: SolveTelemetry;
  analysis: AIAnalysisResult;
}

export interface TrainingQuest {
  id: string;
  title: string;
  category: ChallengeCategory;
  targetDimension: CognitiveDimension;
  focusMode: 'amplify' | 'unlock';
  durationLabel: string;
  prompt: string;
  answerPrompt: string;
  processPrompt: string;
  rationale: string;
  completed: boolean;
  completedAt?: string;
  analysis?: AIAnalysisResult;
}

export interface CognitiveProfile {
  archetypeName: string;
  tagline: string;
  summary: string;
  thinkingSignature: string;
  recommendedDirections: Array<{
    title: string;
    whyItFits: string;
  }>;
  updatedAt: string;
}

export interface DimensionMeta {
  key: CognitiveDimension;
  label: string;
  shortLabel: string;
  description: string;
}
