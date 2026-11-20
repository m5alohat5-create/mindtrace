import { motion } from 'motion/react';
import { DIMENSION_META } from '../data/challenges.ts';
import { CognitiveDimension } from '../types/mindtrace.ts';

interface AbilityRadarMapProps {
  dimensions: Record<CognitiveDimension, number>;
  baseline: Record<CognitiveDimension, number>;
  selectedDimension: CognitiveDimension;
  onSelectDimension: (dim: CognitiveDimension) => void;
}

const SIZE = 420;
const CENTER = SIZE / 2;
const MAX_RADIUS = 144;
const RINGS = [25, 50, 75, 100];

function polarToCartesian(angleDeg: number, value: number): { x: number; y: number } {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const r = (Math.max(0, Math.min(100, value)) / 100) * MAX_RADIUS;
  return {
    x: CENTER + r * Math.cos(rad),
    y: CENTER + r * Math.sin(rad),
  };
}

export function AbilityRadarMap({
  dimensions,
  baseline,
  selectedDimension,
  onSelectDimension,
}: AbilityRadarMapProps) {
  const count = DIMENSION_META.length;
  const angleStep = 360 / count;

  const polygonPoints = DIMENSION_META.map((dim, idx) => {
    const pt = polarToCartesian(idx * angleStep, dimensions[dim.key]);
    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }).join(' ');

  const baselinePoints = DIMENSION_META.map((dim, idx) => {
    const pt = polarToCartesian(idx * angleStep, baseline[dim.key]);
    return `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`;
  }).join(' ');

  return (
    <div className="relative w-full max-w-[440px] mx-auto select-none">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full h-auto overflow-visible"
        role="img"
        aria-label="Индивидуальная карта когнитивных способностей"
      >
        <defs>
          <radialGradient id="mindtraceRadarFill" cx="50%" cy="50%" r="55%">
            <stop offset="0%" stopColor="#8B5CF6" stopOpacity="0.34" />
            <stop offset="100%" stopColor="#6D28D9" stopOpacity="0.12" />
          </radialGradient>
        </defs>

        {/* Concentric hexagonal grid rings */}
        {RINGS.map((ring) => {
          const pts = DIMENSION_META.map((_, idx) => {
            const p = polarToCartesian(idx * angleStep, ring);
            return `${p.x.toFixed(1)},${p.y.toFixed(1)}`;
          }).join(' ');
          return (
            <polygon
              key={ring}
              points={pts}
              fill="none"
              stroke="rgba(255,255,255,0.07)"
              strokeWidth={ring === 100 ? 1.2 : 1}
            />
          );
        })}

        {/* Axis spokes */}
        {DIMENSION_META.map((dim, idx) => {
          const outer = polarToCartesian(idx * angleStep, 100);
          const isSelected = selectedDimension === dim.key;
          return (
            <line
              key={dim.key}
              x1={CENTER}
              y1={CENTER}
              x2={outer.x}
              y2={outer.y}
              stroke={isSelected ? 'rgba(139, 92, 246, 0.45)' : 'rgba(255,255,255,0.08)'}
              strokeWidth={isSelected ? 1.5 : 1}
            />
          );
        })}

        {/* Baseline reference polygon */}
        <polygon
          points={baselinePoints}
          fill="none"
          stroke="rgba(148, 152, 168, 0.28)"
          strokeDasharray="4 4"
          strokeWidth={1}
        />

        {/* Active cognitive profile polygon */}
        <motion.polygon
          initial={false}
          animate={{ points: polygonPoints }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          fill="url(#mindtraceRadarFill)"
          stroke="#8B5CF6"
          strokeWidth={2}
          strokeLinejoin="round"
        />

        {/* Interactive axis vertices & labels */}
        {DIMENSION_META.map((dim, idx) => {
          const angle = idx * angleStep;
          const pt = polarToCartesian(angle, dimensions[dim.key]);
          const labelPt = polarToCartesian(angle, 121);
          const isSelected = selectedDimension === dim.key;
          const score = dimensions[dim.key];

          let textAnchor: 'middle' | 'start' | 'end' = 'middle';
          if (labelPt.x < CENTER - 24) textAnchor = 'end';
          if (labelPt.x > CENTER + 24) textAnchor = 'start';

          return (
            <g
              key={dim.key}
              className="cursor-pointer group"
              onClick={() => onSelectDimension(dim.key)}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  onSelectDimension(dim.key);
                }
              }}
              aria-label={`${dim.label}: ${score} из 100`}
            >
              {/* Outer selection halo */}
              {isSelected && (
                <circle
                  cx={pt.x}
                  cy={pt.y}
                  r={10}
                  fill="rgba(139, 92, 246, 0.22)"
                  stroke="rgba(167, 139, 250, 0.6)"
                  strokeWidth={1}
                />
              )}

              {/* Vertex dot */}
              <motion.circle
                initial={false}
                animate={{ cx: pt.x, cy: pt.y }}
                transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
                r={isSelected ? 5 : 3.8}
                fill={isSelected ? '#A78BFA' : '#8B5CF6'}
                stroke="#0E0F13"
                strokeWidth={1.5}
              />

              {/* Label + tabular score */}
              <text
                x={labelPt.x}
                y={labelPt.y - 4}
                textAnchor={textAnchor}
                className={`text-[12px] font-medium transition-colors ${
                  isSelected ? 'fill-violet-300' : 'fill-slate-300 group-hover:fill-white'
                }`}
              >
                {dim.shortLabel}
              </text>
              <text
                x={labelPt.x}
                y={labelPt.y + 12}
                textAnchor={textAnchor}
                className="text-[11px] font-mono tabular-nums fill-slate-400"
              >
                {score}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
