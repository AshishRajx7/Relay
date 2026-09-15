import React from 'react';

interface MetricCardProps {
  label?: string;
  title?: string;
  value: string | number;
  subValue?: string;
  description?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  onClick?: () => void;
}

export const MetricCard: React.FC<MetricCardProps> = ({
  label,
  title,
  value,
  subValue,
  description,
  icon,
  accent = false,
  onClick,
}) => {
  const displayLabel = title || label || '';
  const displaySub = description || subValue;
  return (
    <div
      onClick={onClick}
      className={`p-4 rounded-lg border transition-colors ${
        onClick ? 'cursor-pointer hover:border-relay-border-light' : ''
      } ${
        accent
          ? 'bg-relay-card border-relay-accent/40 shadow-operator'
          : 'bg-relay-card border-relay-border shadow-operator'
      }`}
    >
      <div className="flex items-center justify-between text-relay-muted mb-2">
        <span className="text-xs font-medium uppercase tracking-wider text-relay-muted">
          {displayLabel}
        </span>
        {icon && <span className="text-relay-muted/70">{icon}</span>}
      </div>
      <div className="flex items-baseline gap-2">
        <span className={`text-2xl font-mono font-bold ${accent ? 'text-relay-accent' : 'text-relay-text'}`}>
          {value}
        </span>
        {displaySub && (
          <span className="text-xs text-relay-subtle font-mono">
            {displaySub}
          </span>
        )}
      </div>
    </div>
  );
};
