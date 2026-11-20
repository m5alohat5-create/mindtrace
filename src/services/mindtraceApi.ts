import {
  AIAnalysisResult,
  Challenge,
  ChallengeCategory,
  CognitiveDimension,
  CognitiveProfile,
  CompletedAttempt,
  SolveTelemetry,
} from '../types/mindtrace.ts';

async function postJson<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `Ошибка сервера (${res.status})`);
  }
  return data as T;
}

export async function analyzeChallengeWithAI(params: {
  challenge: Pick<Challenge, 'title' | 'category' | 'difficulty' | 'prompt'>;
  answerText: string;
  processText: string;
  telemetry: SolveTelemetry;
  currentDimensions: Record<CognitiveDimension, number>;
}): Promise<AIAnalysisResult> {
  return postJson<AIAnalysisResult>('/api/mindtrace/analyze', params);
}

export async function generateChallengeWithAI(params: {
  category?: ChallengeCategory;
  targetDimension?: CognitiveDimension;
  focusMode?: 'amplify' | 'unlock';
  recentTitles?: string[];
}): Promise<
  Omit<Challenge, 'id' | 'interactiveType'> & {
    rationale: string;
  }
> {
  return postJson('/api/mindtrace/generate-challenge', params);
}

export async function synthesizeProfileWithAI(params: {
  dimensions: Record<CognitiveDimension, number>;
  attempts: CompletedAttempt[];
}): Promise<Omit<CognitiveProfile, 'updatedAt'>> {
  return postJson('/api/mindtrace/synthesize-profile', params);
}
