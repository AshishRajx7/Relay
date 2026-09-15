import React from 'react';

export type BadgeVariant =
  | 'accent'
  | 'success'
  | 'warning'
  | 'danger'
  | 'neutral'
  | 'outline';

interface StatusBadgeProps {
  status: string;
  variant?: BadgeVariant;
  size?: 'sm' | 'md';
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  variant,
  size = 'md',
}) => {
  // Infer variant if not provided
  let computedVariant: BadgeVariant = variant || 'neutral';
  const s = status.toUpperCase();

  if (!variant) {
    if (['ACTIVE', 'COMPLETED', 'APPROVED', 'GMAIL_DRAFT_CREATED', 'PARSED', 'CONNECTED'].includes(s)) {
      computedVariant = s === 'APPROVED' ? 'accent' : 'success';
    } else if (['PENDING', 'CRAWLING', 'ANALYZING', 'REVIEW_REQUIRED', 'EDITED'].includes(s)) {
      computedVariant = 'warning';
    } else if (['FAILED', 'REJECTED', 'DISCONNECTED', 'ERROR'].includes(s)) {
      computedVariant = 'danger';
    } else if (['DRAFT', 'GENERATED'].includes(s)) {
      computedVariant = 'outline';
    }
  }

  const variantStyles: Record<BadgeVariant, string> = {
    accent: 'bg-relay-accent-muted text-relay-accent border border-relay-accent/30',
    success: 'bg-relay-success-muted text-relay-success border border-relay-success/30',
    warning: 'bg-relay-warning-muted text-relay-warning border border-relay-warning/30',
    danger: 'bg-relay-danger-muted text-relay-danger border border-relay-danger/30',
    neutral: 'bg-relay-card text-relay-muted border border-relay-border',
    outline: 'bg-transparent text-relay-muted border border-relay-border',
  };

  const sizeStyles = {
    sm: 'px-1.5 py-0.5 text-xs font-mono',
    md: 'px-2.5 py-1 text-xs font-mono font-medium',
  };

  return (
    <span
      className={`inline-flex items-center rounded-md uppercase tracking-wider ${sizeStyles[size]} ${variantStyles[computedVariant]}`}
    >
      <span className="w-1.5 h-1.5 rounded-full mr-1.5 bg-current opacity-75" />
      {status.replace(/_/g, ' ')}
    </span>
  );
};
