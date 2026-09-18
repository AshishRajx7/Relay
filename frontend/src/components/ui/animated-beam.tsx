import React, { useId } from 'react';
import { motion } from 'framer-motion';

export interface AnimatedBeamProps {
  className?: string;
  fromX: number;
  fromY: number;
  toX: number;
  toY: number;
  isActive?: boolean;
  reverse?: boolean;
  pathColor?: string;
  pathWidth?: number;
  pathOpacity?: number;
  gradientStartColor?: string;
  gradientStopColor?: string;
  duration?: number;
  delay?: number;
}

export const AnimatedBeam: React.FC<AnimatedBeamProps> = ({
  className = '',
  fromX,
  fromY,
  toX,
  toY,
  isActive = true,
  reverse = false,
  pathColor = 'rgba(255, 255, 255, 0.08)',
  pathWidth = 2,
  pathOpacity = 0.6,
  gradientStartColor = '#C8F25C',
  gradientStopColor = '#C8F25C',
  duration = 2.5,
  delay = 0,
}) => {
  const id = useId();

  // Draw straight or slight bezier conduit
  const pathD = `M ${fromX} ${fromY} L ${toX} ${toY}`;

  return (
    <svg
      className={`pointer-events-none absolute left-0 top-0 h-full w-full overflow-visible ${className}`}
    >
      <defs>
        <linearGradient
          id={`beam-gradient-${id}`}
          gradientUnits="userSpaceOnUse"
          x1="0%"
          x2="0%"
          y1="0%"
          y2="0%"
        >
          <stop stopColor={gradientStartColor} stopOpacity="0" />
          <stop offset="50%" stopColor={gradientStartColor} stopOpacity="1" />
          <stop offset="100%" stopColor={gradientStopColor} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Base static conduit */}
      <path
        d={pathD}
        stroke={pathColor}
        strokeWidth={pathWidth}
        strokeOpacity={pathOpacity}
        strokeLinecap="round"
      />

      {/* Animated traveling beam */}
      {isActive && (
        <motion.path
          d={pathD}
          stroke={`url(#beam-gradient-${id})`}
          strokeWidth={pathWidth + 1}
          strokeLinecap="round"
          initial={{
            pathLength: 0.25,
            pathOffset: reverse ? 1 : 0,
            opacity: 0,
          }}
          animate={{
            pathOffset: reverse ? [1, 0] : [0, 1],
            opacity: [0, 1, 1, 0],
          }}
          transition={{
            duration,
            delay,
            repeat: Infinity,
            ease: 'linear',
          }}
        />
      )}
    </svg>
  );
};
