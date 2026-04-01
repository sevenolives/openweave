'use client';

import { useState } from 'react';

interface PieSlice {
  label: string;
  value: number;
  color: string;
}

interface PieChartProps {
  slices: PieSlice[];
  size?: number;
  /** Show a donut hole */
  donut?: boolean;
  className?: string;
}

// Tailwind color token → actual hex for SVG fills
const COLOR_HEX: Record<string, string> = {
  gray:   '#6b7280',
  blue:   '#3b82f6',
  red:    '#ef4444',
  purple: '#8b5cf6',
  amber:  '#f59e0b',
  green:  '#22c55e',
  yellow: '#eab308',
  indigo: '#6366f1',
  pink:   '#ec4899',
  orange: '#f97316',
};

function toHex(color: string): string {
  return COLOR_HEX[color] || '#6b7280';
}

export default function PieChart({ slices, size = 200, donut = true, className = '' }: PieChartProps) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return (
      <div className={`flex items-center justify-center ${className}`} style={{ width: size, height: size }}>
        <p className="text-sm text-gray-400">No tickets</p>
      </div>
    );
  }

  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 4; // small padding
  const innerRadius = donut ? radius * 0.55 : 0;

  // Build arc paths
  let cumulativeAngle = -Math.PI / 2; // start at top
  const arcs = slices.filter(s => s.value > 0).map((slice, i) => {
    const angle = (slice.value / total) * 2 * Math.PI;
    const startAngle = cumulativeAngle;
    const endAngle = cumulativeAngle + angle;
    cumulativeAngle = endAngle;

    const largeArc = angle > Math.PI ? 1 : 0;

    const x1 = cx + radius * Math.cos(startAngle);
    const y1 = cy + radius * Math.sin(startAngle);
    const x2 = cx + radius * Math.cos(endAngle);
    const y2 = cy + radius * Math.sin(endAngle);

    let d: string;
    if (donut) {
      const ix1 = cx + innerRadius * Math.cos(startAngle);
      const iy1 = cy + innerRadius * Math.sin(startAngle);
      const ix2 = cx + innerRadius * Math.cos(endAngle);
      const iy2 = cy + innerRadius * Math.sin(endAngle);
      d = [
        `M ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        `L ${ix2} ${iy2}`,
        `A ${innerRadius} ${innerRadius} 0 ${largeArc} 0 ${ix1} ${iy1}`,
        'Z',
      ].join(' ');
    } else {
      d = [
        `M ${cx} ${cy}`,
        `L ${x1} ${y1}`,
        `A ${radius} ${radius} 0 ${largeArc} 1 ${x2} ${y2}`,
        'Z',
      ].join(' ');
    }

    // If there's only one slice filling the whole circle, draw a full circle
    if (slices.filter(s => s.value > 0).length === 1) {
      if (donut) {
        d = [
          `M ${cx} ${cy - radius}`,
          `A ${radius} ${radius} 0 1 1 ${cx - 0.001} ${cy - radius}`,
          `M ${cx} ${cy - innerRadius}`,
          `A ${innerRadius} ${innerRadius} 0 1 0 ${cx - 0.001} ${cy - innerRadius}`,
        ].join(' ');
      } else {
        d = [
          `M ${cx} ${cy - radius}`,
          `A ${radius} ${radius} 0 1 1 ${cx - 0.001} ${cy - radius}`,
          'Z',
        ].join(' ');
      }
    }

    return {
      ...slice,
      d,
      index: i,
      percentage: ((slice.value / total) * 100).toFixed(1),
    };
  });

  return (
    <div className={`flex flex-col items-center gap-4 ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="drop-shadow-sm"
      >
        {arcs.map((arc) => (
          <path
            key={arc.label}
            d={arc.d}
            fill={toHex(arc.color)}
            fillRule="evenodd"
            stroke="#0a0a0f"
            strokeWidth={2}
            opacity={hoveredIndex === null || hoveredIndex === arc.index ? 1 : 0.4}
            className="transition-opacity duration-150 cursor-pointer"
            onMouseEnter={() => setHoveredIndex(arc.index)}
            onMouseLeave={() => setHoveredIndex(null)}
          />
        ))}
        {/* Center label on hover */}
        {donut && hoveredIndex !== null && arcs[hoveredIndex] && (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-white text-lg font-bold" style={{ fontSize: 18 }}>
              {arcs[hoveredIndex].value}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-500" style={{ fontSize: 11 }}>
              {arcs[hoveredIndex].percentage}%
            </text>
          </>
        )}
        {donut && hoveredIndex === null && (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" className="fill-white text-lg font-bold" style={{ fontSize: 20 }}>
              {total}
            </text>
            <text x={cx} y={cy + 14} textAnchor="middle" className="fill-gray-500" style={{ fontSize: 11 }}>
              total
            </text>
          </>
        )}
      </svg>

      {/* Legend — show all statuses including zero */}
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1.5">
        {slices.map((slice, i) => {
          const arcIndex = arcs.findIndex(a => a.label === slice.label);
          return (
            <div
              key={slice.label}
              className="flex items-center gap-1.5 cursor-pointer"
              onMouseEnter={() => arcIndex >= 0 ? setHoveredIndex(arcIndex) : undefined}
              onMouseLeave={() => setHoveredIndex(null)}
            >
              <span
                className="w-2.5 h-2.5 rounded-full flex-shrink-0"
                style={{ backgroundColor: toHex(slice.color), opacity: slice.value > 0 ? 1 : 0.35 }}
              />
              <span className={`text-xs ${slice.value > 0 ? 'text-gray-400' : 'text-gray-400'}`}>
                {slice.label} ({slice.value})
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export { toHex, COLOR_HEX };
export type { PieSlice };
