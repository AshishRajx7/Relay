import React from 'react';

interface ScoreGaugeProps {
  score: number | null | undefined;
  maxScore?: number;
  label?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({
  score,
  label,
  size = 'md',
}) => {
  const validScore = score !== null && score !== undefined ? Math.round(score) : null;

  let colorClass = 'text-relay-muted';
  let bgClass = 'bg-relay-border';

  if (validScore !== null) {
    if (validScore >= 75) {
      colorClass = 'text-relay-accent';
      bgClass = 'bg-relay-accent';
    } else if (validScore >= 50) {
      colorClass = 'text-relay-warning';
      bgClass = 'bg-relay-warning';
    } else {
      colorClass = 'text-relay-danger';
      bgClass = 'bg-relay-danger';
    }
  }

  if (size === 'lg') {
    return (
      <div className="flex flex-col items-center justify-center p-6 bg-relay-card border border-relay-border rounded-lg">
        <div className="relative flex items-center justify-center w-24 h-24 rounded-full border-2 border-relay-border bg-relay-bg">
          <span className={`text-4xl font-mono font-bold ${colorClass}`}>
            {validScore !== null ? validScore : '—'}
          </span>
        </div>
        {label && (
          <span className="mt-2 text-xs uppercase tracking-wider text-relay-muted font-medium">
            {label}
          </span>
        )}
      </div>
    );
  }

  if (size === 'sm') {
    return (
      <div className="inline-flex items-center gap-1.5 font-mono text-xs">
        <span className={`w-2 h-2 rounded-full ${bgClass}`} />
        <span className={`font-semibold ${colorClass}`}>
          {validScore !== null ? `${validScore}%` : '—'}
        </span>
        {label && <span className="text-relay-subtle">{label}</span>}
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      <div className="flex items-center justify-center w-10 h-10 rounded-md border border-relay-border bg-relay-bg">
        <span className={`font-mono font-bold text-sm ${colorClass}`}>
          {validScore !== null ? validScore : '—'}
        </span>
      </div>
      {label && (
        <div className="flex flex-col">
          <span className="text-xs font-medium text-relay-text">{label}</span>
          <span className="text-[10px] text-relay-subtle uppercase tracking-wider">
            {validScore !== null ? (validScore >= 75 ? 'Strong Signal' : validScore >= 50 ? 'Moderate' : 'Needs Review') : 'Not Scored'}
          </span>
        </div>
      )}
    </div>
  );
};
