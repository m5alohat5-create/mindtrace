import { useState } from 'react';
import { motion } from 'motion/react';
import { ArrowRight, BrainCircuit, Compass, Layers3 } from 'lucide-react';
import { DIMENSION_MAP, DIMENSION_META } from '../data/challenges.ts';
import { ChallengeCategory, CognitiveDimension, CompletedAttempt } from '../types/mindtrace.ts';

interface OverviewLabProps {
  dimensions: Record<CognitiveDimension, number>;
  attempts: CompletedAttempt[];
  onStartDiagnostic: (category?: ChallengeCategory) => void;
  onOpenMap: () => void;
  onOpenTraining: () => void;
}

const CATEGORIES: Array<{
  category: ChallengeCategory;
  title: string;
  subtitle: string;
  dimKey: CognitiveDimension;
}> = [
  {
    category: 'Логика',
    title: 'Логика и паттерны',
    subtitle: 'Поиск скрытых правил, инвариантов и устойчивых протоколов.',
    dimKey: 'logic',
  },
  {
    category: 'Творчество',
    title: 'Творческий синтез',
    subtitle: 'Соединение несовместимых идей в работающие концепты.',
    dimKey: 'creativity',
  },
  {
    category: 'Анализ',
    title: 'Глубокий анализ',
    subtitle: 'Расследование парадоксов в данных и поиск корневых причин.',
    dimKey: 'analysis',
  },
  {
    category: 'Нестандартное мышление',
    title: 'Нестандартное мышление',
    subtitle: 'Переосмысление жёстких ограничений и новые способы объяснения.',
    dimKey: 'lateral',
  },
];

export function OverviewLab({
  dimensions,
  attempts,
  onStartDiagnostic,
  onOpenMap,
  onOpenTraining,
}: OverviewLabProps) {
  const [heroImgFailed, setHeroImgFailed] = useState(false);
  const [prismImgFailed, setPrismImgFailed] = useState(false);
  const [latticeImgFailed, setLatticeImgFailed] = useState(false);

  const sortedDims = [...DIMENSION_META].sort(
    (a, b) => dimensions[b.key] - dimensions[a.key]
  );
  const topDim = sortedDims[0];
  const avgScore = Math.round(
    Object.values(dimensions).reduce((sum, val) => sum + val, 0) / 6
  );

  return (
    <div className="space-y-16 pb-16">
      {/* Hero Two-Column Split */}
      <section className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch pt-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-7 flex flex-col justify-between bg-[#15171E] border border-white/[0.08] rounded-2xl p-8 sm:p-10"
        >
          <div className="space-y-6">
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span>Когнитивная лаборатория</span>
              <span aria-hidden="true">·</span>
              <span>Для подростков и молодёжи</span>
              <span aria-hidden="true">·</span>
              <span>Анализ хода мыслей</span>
            </div>

            <h1 className="text-3xl sm:text-5xl font-semibold tracking-tight text-[#F2F4F8] leading-[1.1] text-balance">
              Обнаружь, как именно работает твой ум
            </h1>

            <p className="text-base sm:text-lg text-slate-300 leading-relaxed max-w-2xl">
              MINDTRACE предлагает необычные интеллектуальные задачи без шаблонных тестов и зубрёжки.
              Искусственный интеллект анализирует не только итоговый ответ, но и сам способ, которым ты
              идёшь к решению, чтобы построить твою индивидуальную карту способностей.
            </p>
          </div>

          <div className="pt-8 mt-8 border-t border-white/[0.07] flex flex-wrap items-center gap-4">
            <button
              type="button"
              onClick={() => onStartDiagnostic()}
              className="inline-flex items-center gap-2.5 px-6 py-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>{attempts.length > 0 ? 'Продолжить исследование' : 'Начать диагностику'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>

            <button
              type="button"
              onClick={onOpenMap}
              className="inline-flex items-center gap-2 px-5 py-3 rounded-xl border border-white/[0.1] hover:border-white/20 hover:bg-white/[0.04] text-slate-200 text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-400 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <span>Карта способностей</span>
            </button>
          </div>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.32, delay: 0.05, ease: [0.16, 1, 0.3, 1] }}
          className="lg:col-span-5 relative rounded-2xl overflow-hidden border border-white/[0.08] bg-[#15171E] min-h-[280px]"
        >
          {!heroImgFailed ? (
            <img
              src="/src/assets/images/hero_mindtrace_sculpture_1795174156876.jpg"
              alt="Архитектурная композиция MINDTRACE из графита и тонированного фиолетового стекла"
              referrerPolicy="no-referrer"
              onError={() => setHeroImgFailed(true)}
              className="w-full h-full lg:h-full object-cover object-center"
            />
          ) : (
            <div className="w-full h-full flex flex-col items-center justify-center p-8 bg-gradient-to-br from-[#191B24] via-[#13151D] to-[#1D1631]">
              <BrainCircuit className="w-12 h-12 text-violet-400 mb-3" />
              <span className="text-sm font-medium text-slate-300">MINDTRACE</span>
            </div>
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-[#0E0F13]/85 via-[#0E0F13]/20 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 inset-x-0 p-6 flex items-end justify-between gap-4">
            <div>
              <p className="text-xs text-slate-400">
                {attempts.length > 0 ? 'Ведущий вектор сейчас' : 'Шесть осей профиля'}
              </p>
              <p className="text-base font-medium text-white mt-0.5">
                {attempts.length > 0
                  ? `${DIMENSION_MAP[topDim.key].label} · ${dimensions[topDim.key]}`
                  : 'Логика · Творчество · Анализ · Системность'}
              </p>
            </div>
            <span className="text-xs font-mono tabular-nums text-violet-300 whitespace-nowrap shrink-0">
              {attempts.length > 0 ? `Индекс ${avgScore}` : '8 задач'}
            </span>
          </div>
        </motion.div>
      </section>

      {/* Full-Width 4-Column Cognitive Dimensions Strip */}
      <section aria-labelledby="dimensions-heading" className="space-y-5">
        <div className="flex flex-wrap items-baseline justify-between gap-4">
          <h2 id="dimensions-heading" className="text-xl sm:text-2xl font-semibold text-[#F2F4F8]">
            Четыре входа в исследование
          </h2>
          <span className="text-xs text-slate-400 font-mono tabular-nums">
            Решено задач: {attempts.length}
          </span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 border border-white/[0.08] rounded-2xl bg-[#15171E] divide-y sm:divide-y-0 sm:divide-x divide-white/[0.07] overflow-hidden">
          {CATEGORIES.map((item, idx) => (
            <button
              key={item.category}
              type="button"
              onClick={() => onStartDiagnostic(item.category)}
              className="group text-left p-6 hover:bg-white/[0.03] transition-colors flex flex-col justify-between gap-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-violet-400 cursor-pointer"
            >
              <div className="space-y-2.5">
                <div className="flex items-center justify-between text-xs text-slate-400">
                  <span className="font-mono tabular-nums">0{idx + 1}</span>
                  <span className="font-mono tabular-nums text-violet-300">
                    {dimensions[item.dimKey]} / 100
                  </span>
                </div>
                <h3 className="text-base font-semibold text-[#F2F4F8] group-hover:text-violet-300 transition-colors">
                  {item.title}
                </h3>
                <p className="text-sm text-slate-400 leading-relaxed">{item.subtitle}</p>
              </div>
              <span className="inline-flex items-center gap-1.5 text-xs font-medium text-slate-300 group-hover:text-violet-300 transition-colors">
                <span>Открыть задания</span>
                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Mechanism Showcase (2 Editorial Columns with Generated Assets) */}
      <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <article className="bg-[#15171E] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
          <div className="aspect-[16/10] bg-[#12141B] overflow-hidden relative">
            {!prismImgFailed ? (
              <img
                src="/src/assets/images/lab_logic_prism_1795174157654.jpg"
                alt="Обсидиановая призма и точный измерительный инструмент на графитовой поверхности"
                referrerPolicy="no-referrer"
                onError={() => setPrismImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#181B24]">
                <Compass className="w-10 h-10 text-violet-400" />
              </div>
            )}
          </div>
          <div className="p-7 flex-1 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <p className="text-xs text-slate-400">01. Траектория мысли вместо угадывания</p>
              <h3 className="text-xl font-semibold text-[#F2F4F8]">
                ИИ изучает, как ты приходишь к ответу
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                Два человека могут прийти к разным выводам, но оба проявить сильный интеллект: один
                через строгие ограничения, другой через неожиданную метафору. MINDTRACE фиксирует
                твой метод рассуждения и переводит его в конкретные сильные стороны.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={() => onStartDiagnostic()}
                className="inline-flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200 transition-colors cursor-pointer"
              >
                <span>Попробовать первую задачу</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>

        <article className="bg-[#15171E] border border-white/[0.08] rounded-2xl overflow-hidden flex flex-col">
          <div className="aspect-[16/10] bg-[#12141B] overflow-hidden relative">
            {!latticeImgFailed ? (
              <img
                src="/src/assets/images/lab_creative_lattice_1795174157583.jpg"
                alt="Геометрические формы, соединённые тонкими нитями, на тёмном графите"
                referrerPolicy="no-referrer"
                onError={() => setLatticeImgFailed(true)}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-[#181B24]">
                <Layers3 className="w-10 h-10 text-violet-400" />
              </div>
            )}
          </div>
          <div className="p-7 flex-1 flex flex-col justify-between gap-5">
            <div className="space-y-2.5">
              <p className="text-xs text-slate-400">02. Индивидуальная карта и рост</p>
              <h3 className="text-xl font-semibold text-[#F2F4F8]">
                Персональные задания под твой профиль
              </h3>
              <p className="text-sm text-slate-400 leading-relaxed">
                После каждого решения обновляется шестиосевая карта способностей. Алгоритм подбирает
                следующий микро-челлендж: либо чтобы усилить природный талант, либо чтобы открыть
                новую грань мышления.
              </p>
            </div>
            <div>
              <button
                type="button"
                onClick={onOpenTraining}
                className="inline-flex items-center gap-2 text-sm font-medium text-violet-300 hover:text-violet-200 transition-colors cursor-pointer"
              >
                <span>Перейти к тренировкам</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
}
