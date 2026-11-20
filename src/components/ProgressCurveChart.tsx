import { CompletedAttempt } from '../types/mindtrace.ts';

interface ProgressCurveChartProps {
  attempts: CompletedAttempt[];
}

export function ProgressCurveChart({ attempts }: ProgressCurveChartProps) {
  if (attempts.length < 2) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-6 text-center border border-dashed border-white/[0.08] rounded-xl bg-[#12141B]">
        <p className="text-sm font-medium text-slate-300">
          Кривая динамики появится после двух решённых заданий
        </p>
        <p className="text-xs text-slate-500 mt-1.5 max-w-md">
          Сейчас зафиксировано замеров: {attempts.length}. Решите ещё одно задание, чтобы увидеть
          траекторию изменения индекса гибкости и глубины анализа.
        </p>
      </div>
    );
  }

  const width = 680;
  const height = 210;
  const padLeft = 36;
  const padRight = 24;
  const padTop = 22;
  const padBottom = 34;

  const plotW = width - padLeft - padRight;
  const plotH = height - padTop - padBottom;

  const points = attempts.map((attempt, idx) => {
    const scores = Object.values(attempt.analysis.dimensionScores);
    const avg = Math.round(scores.reduce((s, v) => s + v, 0) / scores.length);
    const x =
      attempts.length === 1
        ? padLeft + plotW / 2
        : padLeft + (idx / (attempts.length - 1)) * plotW;
    const y = padTop + plotH - (avg / 100) * plotH;
    return { x, y, avg, title: attempt.challengeTitle, idx };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
    .join(' ');

  const areaD = `${pathD} L ${points[points.length - 1].x.toFixed(1)} ${(padTop + plotH).toFixed(
    1
  )} L ${points[0].x.toFixed(1)} ${(padTop + plotH).toFixed(1)} Z`;

  return (
    <div className="w-full overflow-x-auto">
      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="w-full min-w-[460px] h-auto"
        role="img"
        aria-label="График когнитивного прогресса"
      >
        <defs>
          <linearGradient id="progressAreaGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.28" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.0" />
          </linearGradient>
        </defs>

        {/* Horizontal grid references */}
        {[25, 50, 75, 100].map((val) => {
          const y = padTop + plotH - (val / 100) * plotH;
          return (
            <g key={val}>
              <line
                x1={padLeft}
                y1={y}
                x2={width - padRight}
                y2={y}
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={1}
              />
              <text
                x={padLeft - 8}
                y={y + 4}
                textAnchor="end"
                className="text-[10px] font-mono tabular-nums fill-slate-500"
              >
                {val}
              </text>
            </g>
          );
        })}

        <path d={areaD} fill="url(#progressAreaGrad)" />
        <path
          d={pathD}
          fill="none"
          stroke="#8B5CF6"
          strokeWidth={2.2}
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {points.map((p) => (
          <g key={p.idx}>
            <circle
              cx={p.x}
              cy={p.y}
              r={4}
              fill="#A78BFA"
              stroke="#0E0F13"
              strokeWidth={1.5}
            />
            <text
              x={p.x}
              y={p.y - 10}
              textAnchor="middle"
              className="text-[11px] font-mono tabular-nums fill-slate-200"
            >
              {p.avg}
            </text>
            <text
              x={p.x}
              y={height - 10}
              textAnchor="middle"
              className="text-[10px] font-mono tabular-nums fill-slate-500"
            >
              #{p.idx + 1}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}
