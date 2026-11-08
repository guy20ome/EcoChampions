import { PollutionLog } from '../api/types';

interface ChartDataPoint {
  label: string;       // e.g. "Jan 2025"
  value: number;
}

interface TrendChartProps {
  indicator: {
    id: number;
    code: string;
    label: string;
    unit: string;
    lower_is_better: boolean;
  };
  logs: PollutionLog[];
  width?: number;
  height?: number;
}

export function TrendChart({ indicator, logs, width = 320, height = 160 }: TrendChartProps) {
  const pad = { top: 16, right: 16, bottom: 28, left: 40 };
  const chartW = width - pad.left - pad.right;
  const chartH = height - pad.top - pad.bottom;

  // Sort logs by date (oldest first) and take last 10
  const sorted = [...logs]
    .sort((a, b) => a.log_year * 12 + a.log_month - (b.log_year * 12 + b.log_month))
    .slice(-10);

  if (sorted.length === 0) {
    return (
      <div style={{ width, height, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#999', fontSize: 12 }}>
        No data yet
      </div>
    );
  }

  // Build data points with labels
  const dataPoints: ChartDataPoint[] = sorted.map((log) => ({
    label: `${String(log.log_month).padStart(2, '0')}/${String(log.log_year).slice(2)}`,
    value: log.value,
  }));

  // Compute Y range
  const values = dataPoints.map((d) => d.value);
  const minVal = Math.min(...values);
  const maxVal = Math.max(...values);
  const range = maxVal - minVal || 1;
  const yMin = minVal - range * 0.1;
  const yMax = maxVal + range * 0.1;

  // Map value to Y coordinate
  const yFor = (v: number) => pad.top + chartH - ((v - yMin) / (yMax - yMin)) * chartH;
  const xFor = (i: number) => pad.left + (i / (dataPoints.length - 1)) * chartW;

  // Build polyline points
  const linePoints = dataPoints.map((d, i) => `${xFor(i)},${yFor(d.value)}`).join(' ');

  // Determine if trend is improving
  const firstVal = dataPoints[0].value;
  const lastVal = dataPoints[dataPoints.length - 1].value;
  let improving: boolean;
  if (indicator.lower_is_better) {
    improving = lastVal <= firstVal;
  } else {
    improving = lastVal >= firstVal;
  }
  const strokeColor = improving ? '#38a169' : '#e53e3e';

  // Y axis ticks (5 ticks)
  const tickCount = 5;
  const ticks: number[] = [];
  for (let i = 0; i < tickCount; i++) {
    ticks.push(yMin + (i / (tickCount - 1)) * (yMax - yMin));
  }

  // X axis labels (show every other point if many)
  const xLabelInterval = dataPoints.length > 6 ? 2 : 1;

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} style={{ display: 'block' }}>
      {/* Grid lines */}
      {ticks.map((t, i) => {
        const y = yFor(t);
        return (
          <g key={i}>
            <line
              x1={pad.left} y1={y} x2={pad.left + chartW} y2={y}
              stroke="#e2e8f0" strokeWidth="1"
            />
            <text
              x={pad.left - 6} y={y + 4}
              textAnchor="end"
              fontSize="10"
              fill="#94a3b8"
            >
              {t.toFixed(0)}
            </text>
          </g>
        );
      })}

      {/* Baseline */}
      <line
        x1={pad.left} y1={pad.top + chartH}
        x2={pad.left + chartW} y2={pad.top + chartH}
        stroke="#cbd5e0" strokeWidth="1"
      />

      {/* Line */}
      <polyline
        points={linePoints}
        fill="none"
        stroke={strokeColor}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
      />

      {/* Data points */}
      {dataPoints.map((d, i) => (
        <circle
          key={i}
          cx={xFor(i)} cy={yFor(d.value)}
          r={3}
          fill={strokeColor}
        />
      ))}

      {/* X axis labels */}
      {dataPoints.map((d, i) => {
        if (i % xLabelInterval !== 0) return null;
        return (
          <text
            key={i}
            x={xFor(i)} y={pad.top + chartH + 16}
            textAnchor="middle"
            fontSize="10"
            fill="#94a3b8"
          >
            {d.label}
          </text>
        );
      })}

      {/* Y axis label (unit) */}
      <text
        x={10} y={pad.top + chartH / 2}
        textAnchor="middle"
        fontSize="10"
        fill="#94a3b8"
        transform={`rotate(-90, 10, ${pad.top + chartH / 2})`}
      >
        {indicator.unit}
      </text>

      {/* Trend badge */}
      <g>
        <rect
          x={pad.left + chartW - 58} y={pad.top - 2}
          width={56} height={18}
          rx={9}
          fill={strokeColor}
          opacity="0.15"
        />
        <text
          x={pad.left + chartW - 30} y={pad.top + 11}
          textAnchor="middle"
          fontSize="9"
          fontWeight="600"
          fill={strokeColor}
        >
          {improving ? 'Improving' : 'Declining'}
        </text>
      </g>
    </svg>
  );
}