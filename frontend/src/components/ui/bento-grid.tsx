import React from 'react';

interface BentoGridProps {
  className?: string;
  children: React.ReactNode;
}

export const BentoGrid: React.FC<BentoGridProps> = ({ className = '', children }) => {
  return (
    <div
      className={`grid grid-cols-1 md:grid-cols-3 gap-4 max-w-7xl mx-auto w-full ${className}`}
    >
      {children}
    </div>
  );
};

interface BentoGridItemProps {
  className?: string;
  title?: string | React.ReactNode;
  description?: string | React.ReactNode;
  header?: React.ReactNode;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export const BentoGridItem: React.FC<BentoGridItemProps> = ({
  className = '',
  title,
  description,
  header,
  icon,
  children,
}) => {
  return (
    <div
      className={`rounded-xl group/bento transition duration-200 border border-slate-800/80 bg-[#161F2C] hover:bg-[#1E293B] hover:border-slate-700/80 p-5 flex flex-col justify-between space-y-4 shadow-operator ${className}`}
    >
      {header}
      <div className="group-hover/bento:translate-x-0.5 transition duration-200 flex-1 flex flex-col justify-between">
        <div>
          {icon && <div className="mb-2 text-[#C8F25C]">{icon}</div>}
          {title && (
            <div className="font-sans font-semibold text-[#F8FAFC] text-sm tracking-tight mb-1">
              {title}
            </div>
          )}
          {description && (
            <div className="font-sans text-xs text-[#94A3B8] leading-relaxed">
              {description}
            </div>
          )}
        </div>
        {children && <div className="mt-3">{children}</div>}
      </div>
    </div>
  );
};
