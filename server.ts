import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const MODEL_NAME = 'gemini-4-hydrogen';

function createAiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY не настроен на сервере.');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

async function withRetry<T>(fn: () => Promise<T>, retries = 2): Promise<T> {
  let lastError: unknown;
  for (let i = 0; i <= retries; i++) {
    try {
      return await fn();
    } catch (err: unknown) {
      lastError = err;
      const status = (err as { status?: number })?.status;
      if (status && status >= 400 && status < 500 && status !== 429) {
        throw err;
      }
      if (i < retries) {
        await new Promise((r) => setTimeout(r, 500 * (i + 1)));
      }
    }
  }
  throw lastError;
}

function formatGeminiError(err: unknown): { status: number; message: string } {
  const e = err as { status?: number; message?: string };
  const status = typeof e?.status === 'number' ? e.status : 500;
  const rawMessage = e?.message || 'Ошибка при обращении к AI-сервису.';
  if (rawMessage.includes('GEMINI_API_KEY')) {
    return {
      status: 500,
      message: 'Не найден ключ GEMINI_API_KEY. Добавьте его в Settings > Secrets.',
    };
  }
  if (status === 403 || status === 400) {
    return {
      status,
      message: `Ошибка доступа или параметров AI-модели (${status}): ${rawMessage}`,
    };
  }
  if (status === 429) {
    return {
      status: 429,
      message: 'Превышен лимит запросов к Gemini API. Попробуйте повторить через минуту.',
    };
  }
  return { status, message: rawMessage };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ ok: true, model: MODEL_NAME });
  });

  app.post('/api/mindtrace/analyze', async (req, res) => {
    try {
      const { challenge, answerText, processText, telemetry, currentDimensions } = req.body ?? {};
      if (!challenge || typeof answerText !== 'string' || answerText.trim().length < 5) {
        return res.status(400).json({
          error: 'Пожалуйста, опишите решение подробнее, чтобы ИИ смог проанализировать ход мыслей.',
        });
      }

      const ai = createAiClient();

      const prompt = `Ты — когнитивный исследователь и ментор платформы MINDTRACE для подростков и молодёжи (14–23 года).
Твоя задача — глубоко и бережно проанализировать НЕ ТОЛЬКО итоговый ответ пользователя, но и ЕГО СПОСОБ МЫШЛЕНИЯ и процесс решения.

ЗАДАЧА:
Название: ${challenge.title}
Категория: ${challenge.category}
Сложность: ${challenge.difficulty}
Условие: ${challenge.prompt}

ОТВЕТ ПОЛЬЗОВАТЕЛЯ:
${answerText}

КАК ПОЛЬЗОВАТЕЛЬ ДУМАЛ (ОПИСАНИЕ ПРОЦЕССА):
${processText || 'Пользователь не расписал процесс отдельно — опирайся на структуру самого ответа и телеметрию.'}

ТЕЛЕМЕТРИЯ РЕШЕНИЯ:
- Время размышления: ${telemetry?.durationSeconds ?? 0} сек
- Использована подсказка: ${telemetry?.hintUsed ? 'Да' : 'Нет'}
- Количество пересмотров/правок: ${telemetry?.revisionsCount ?? 0}
- Интерактивные действия: ${telemetry?.interactiveSummary || 'Нет дополнительных действий'}

ТЕКУЩИЙ БАЗОВЫЙ ПРОФИЛЬ ПОЛЬЗОВАТЕЛЯ (0-100):
${JSON.stringify(currentDimensions || {})}

ИНСТРУКЦИИ ПО ОЦЕНКЕ:
1. Пиши живым, современным, уважительным русским языком без канцелярита и без слащавой лести. Говори с пользователем на «ты», как умный старший наставник или исследователь.
2. Замечай конкретные паттерны в тексте пользователя: как он строит гипотезы, использует ли метафоры, ищет ли ограничения, проверяет ли крайние случаи, учитывает ли психологию людей.
3. Выяви 2–3 скрытые сильные стороны (hiddenStrengths) с конкретным доказательством из ответа и указанием, в каких реальных сферах (геймдизайн, продакт-менеджмент, биоинформатика, архитектура систем, медиа, инженерия и др.) это даёт преимущество.
4. Оцени проявленные показатели по 6 осям (0–100) и вычисли реалистичный прирост (dimensionDeltas от -2 до +14) относительно текущего профиля. Если ответ слишком короткий, формальный или поверхностный — честно, но мягко укажи это в growthEdge и не завышай баллы.
5. Сформируй персональное микро-задание (nextMicroChallenge) — следующий короткий шаг на 2 минуты, который развивает именно то, что проявилось в этом ответе.`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                solvingStyle: {
                  type: Type.STRING,
                  description: 'Короткое точное название стиля мышления пользователя (2–5 слов).',
                },
                solvingProcessObservation: {
                  type: Type.STRING,
                  description: 'Наблюдение о том, как именно пользователь шёл к решению (2–3 предложения).',
                },
                insightSummary: {
                  type: Type.STRING,
                  description: 'Главный вывод об интеллектуальном почерке пользователя в этой задаче (2–3 предложения).',
                },
                growthEdge: {
                  type: Type.STRING,
                  description: 'Точка роста: что осталось за кадром или какой следующий уровень можно попробовать (1–2 предложения).',
                },
                hiddenStrengths: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      name: { type: Type.STRING },
                      evidence: { type: Type.STRING },
                      domainRelevance: { type: Type.STRING },
                    },
                    required: ['name', 'evidence', 'domainRelevance'],
                  },
                },
                dimensionScores: {
                  type: Type.OBJECT,
                  properties: {
                    logic: { type: Type.INTEGER },
                    creativity: { type: Type.INTEGER },
                    analysis: { type: Type.INTEGER },
                    lateral: { type: Type.INTEGER },
                    systems: { type: Type.INTEGER },
                    empathy: { type: Type.INTEGER },
                  },
                  required: ['logic', 'creativity', 'analysis', 'lateral', 'systems', 'empathy'],
                },
                dimensionDeltas: {
                  type: Type.OBJECT,
                  properties: {
                    logic: { type: Type.INTEGER },
                    creativity: { type: Type.INTEGER },
                    analysis: { type: Type.INTEGER },
                    lateral: { type: Type.INTEGER },
                    systems: { type: Type.INTEGER },
                    empathy: { type: Type.INTEGER },
                  },
                  required: ['logic', 'creativity', 'analysis', 'lateral', 'systems', 'empathy'],
                },
                nextMicroChallenge: {
                  type: Type.OBJECT,
                  properties: {
                    title: { type: Type.STRING },
                    prompt: { type: Type.STRING },
                    targetDimension: {
                      type: Type.STRING,
                      description: 'Одно из: logic, creativity, analysis, lateral, systems, empathy',
                    },
                  },
                  required: ['title', 'prompt', 'targetDimension'],
                },
              },
              required: [
                'solvingStyle',
                'solvingProcessObservation',
                'insightSummary',
                'growthEdge',
                'hiddenStrengths',
                'dimensionScores',
                'dimensionDeltas',
                'nextMicroChallenge',
              ],
            },
          },
        })
      );

      const text = (response.text ?? '{}').trim();
      const parsed = JSON.parse(text);
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/mindtrace/generate-challenge', async (req, res) => {
    try {
      const { category, targetDimension, focusMode, recentTitles } = req.body ?? {};
      const ai = createAiClient();

      const prompt = `Придумай одну абсолютно новую, нестандартную интеллектуальную задачу для подростка или молодого человека (14–23 года) на платформе MINDTRACE.
Задача должна проверять не школьную зубрёжку, а живое мышление, наблюдательность, изобретательность или способность видеть скрытые связи.

Параметры:
- Желаемая категория: ${category || 'Нестандартное мышление'}
- Целевая когнитивная ось: ${targetDimension || 'lateral'}
- Режим тренировки: ${focusMode === 'unlock' ? 'Мягко прокачать зону роста и расширить диапазон' : 'Усилить природную суперспособность и вывести на более сложный уровень'}
- Избегай повторения тем: ${(recentTitles || []).join(', ') || 'нет'}

Пиши на чистом, современном русском языке. Сделай условие увлекательным, с конкретным парадоксом или ограничением.`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                category: {
                  type: Type.STRING,
                  description: 'Одно из: Логика, Творчество, Анализ, Нестандартное мышление',
                },
                difficulty: {
                  type: Type.STRING,
                  description: 'Одно из: Базовый, Продвинутый, Эксперимент',
                },
                durationLabel: { type: Type.STRING },
                prompt: { type: Type.STRING },
                contextNote: { type: Type.STRING },
                hint: { type: Type.STRING },
                answerPrompt: { type: Type.STRING },
                processPrompt: { type: Type.STRING },
                rationale: {
                  type: Type.STRING,
                  description: 'Короткое пояснение (1 предложение), почему это задание полезно именно сейчас.',
                },
              },
              required: [
                'title',
                'category',
                'difficulty',
                'durationLabel',
                'prompt',
                'contextNote',
                'hint',
                'answerPrompt',
                'processPrompt',
                'rationale',
              ],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  app.post('/api/mindtrace/synthesize-profile', async (req, res) => {
    try {
      const { dimensions, attempts } = req.body ?? {};
      if (!Array.isArray(attempts) || attempts.length === 0) {
        return res.status(400).json({ error: 'Нужно решить хотя бы одну задачу для синтеза карты.' });
      }

      const ai = createAiClient();

      const compactAttempts = attempts.slice(-6).map((a: Record<string, unknown>) => ({
        title: a.challengeTitle,
        category: a.category,
        solvingStyle: (a.analysis as Record<string, unknown>)?.solvingStyle,
        strengths: ((a.analysis as Record<string, unknown>)?.hiddenStrengths as Array<{ name: string }> | undefined)?.map(
          (s) => s.name
        ),
        insight: (a.analysis as Record<string, unknown>)?.insightSummary,
      }));

      const prompt = `На основе когнитивных замеров и истории решений пользователя на платформе MINDTRACE создай его индивидуальный интеллектуальный портрет (архетип мышления).

Текущие показатели по 6 осям (0-100):
${JSON.stringify(dimensions)}

История проанализированных решений:
${JSON.stringify(compactAttempts)}

Правила:
1. Название архетипа должно быть звучным, точным и современным (без фэнтези-клише, например: «Архитектор ограничений», «Системный синтезатор», «Исследователь парадоксов», «Дизайнер смыслов»).
2. Опиши уникальный почерк мышления человека, без общих гороскопных фраз.
3. Предложи 3–4 реальных направления, профессии будущего или форматы проектов, где такой склад ума раскрывается сильнее всего, с конкретным объяснением «почему».`;

      const response = await withRetry(() =>
        ai.models.generateContent({
          model: MODEL_NAME,
          contents: prompt,
          config: {
            thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                archetypeName: { type: Type.STRING },
                tagline: { type: Type.STRING },
                summary: { type: Type.STRING },
                thinkingSignature: { type: Type.STRING },
                recommendedDirections: {
                  type: Type.ARRAY,
                  items: {
                    type: Type.OBJECT,
                    properties: {
                      title: { type: Type.STRING },
                      whyItFits: { type: Type.STRING },
                    },
                    required: ['title', 'whyItFits'],
                  },
                },
              },
              required: ['archetypeName', 'tagline', 'summary', 'thinkingSignature', 'recommendedDirections'],
            },
          },
        })
      );

      const parsed = JSON.parse((response.text ?? '{}').trim());
      res.json(parsed);
    } catch (err) {
      const formatted = formatGeminiError(err);
      res.status(formatted.status).json({ error: formatted.message });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    if (fs.existsSync(distPath)) {
      app.use(express.static(distPath));
      app.get('*', (_req, res) => {
        res.sendFile(path.join(distPath, 'index.html'));
      });
    }
  }

  const port = Number(process.env.PORT || 3000);
  app.listen(port, '0.0.0.0', () => {
    console.log(`MINDTRACE server running on http://0.0.0.0:${port}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start MINDTRACE server:', err);
  process.exit(1);
});
