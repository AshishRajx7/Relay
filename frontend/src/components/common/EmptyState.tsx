import React from 'react';

interface EmptyStateProps {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  icon,
  action,
}) => {
  return (
    <div className="flex flex-col items-center justify-center p-8 text-center border border-dashed border-relay-border rounded-lg bg-relay-card/40 my-4">
      {icon && <div className="text-relay-muted/60 mb-3">{icon}</div>}
      <h3 className="text-sm font-medium text-relay-text uppercase tracking-wider font-mono">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs text-relay-muted max-w-sm">
          {description}
        </p>
      )}
      {action && (
        <button
          onClick={action.onClick}
          className="mt-4 px-3 py-1.5 text-xs font-mono font-medium rounded border border-relay-accent/40 text-relay-accent bg-relay-accent-muted hover:bg-relay-accent hover:text-black transition-colors"
        >
          {action.label}
        </button>
      )}
    </div>
  );
};
