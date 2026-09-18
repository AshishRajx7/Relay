import React, { useRef } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import {
  motion,
  useMotionValue,
  useSpring,
  useTransform,
  MotionValue,
} from 'framer-motion';
import {
  Building2,
  Inbox,
  GitPullRequest,
  FileUser,
  Send,
  Sliders,
} from 'lucide-react';

export interface DockItem {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  href: string;
  exact?: boolean;
}

export const DOCK_ITEMS: DockItem[] = [
  { title: 'Companies', icon: Building2, href: '/', exact: true },
  { title: 'Queue', icon: Inbox, href: '/queue' },
  { title: 'Campaigns', icon: GitPullRequest, href: '/campaigns' },
  { title: 'Resume', icon: FileUser, href: '/resumes' },
  { title: 'Gmail', icon: Send, href: '/gmail' },
  { title: 'Settings', icon: Sliders, href: '/settings' },
];

function DockIcon({
  mouseX,
  item,
  isActive,
}: {
  mouseX: MotionValue;
  item: DockItem;
  isActive: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);

  const distance = useTransform(mouseX, (val) => {
    const bounds = ref.current?.getBoundingClientRect() ?? { y: 0, height: 0 };
    return val - bounds.y - bounds.height / 2;
  });

  const widthSync = useTransform(distance, [-100, 0, 100], [36, 46, 36]);
  const width = useSpring(widthSync, { mass: 0.1, stiffness: 160, damping: 12 });

  const Icon = item.icon;

  return (
    <NavLink to={item.href} className="group relative block">
      <motion.div
        ref={ref}
        style={{ width, height: width }}
        className={`relative flex items-center justify-center rounded-xl border transition-colors ${
          isActive
            ? 'bg-[#1E293B] border-[#C8F25C]/50 text-[#C8F25C] shadow-[0_0_12px_rgba(200,242,92,0.25)]'
            : 'bg-[#161F2C] border-slate-700/40 text-[#94A3B8] hover:bg-[#1E293B] hover:text-[#F8FAFC] hover:border-slate-600/60'
        }`}
      >
        <Icon className="w-4 h-4 shrink-0 transition-transform group-hover:scale-110" />

        {/* Active Indicator Pip */}
        {isActive && (
          <span className="absolute -left-1.5 top-1/2 -translate-y-1/2 w-1 h-3 rounded-full bg-[#C8F25C] shadow-[0_0_6px_#C8F25C]" />
        )}
      </motion.div>

      {/* Floating Tooltip Label */}
      <div className="pointer-events-none absolute left-full top-1/2 -translate-y-1/2 ml-3 hidden md:flex items-center">
        <div className="whitespace-nowrap rounded-md border border-slate-700/60 bg-[#161F2C] px-2.5 py-1 text-xs font-medium text-[#F8FAFC] shadow-xl opacity-0 transition-opacity group-hover:opacity-100 z-50">
          {item.title}
        </div>
      </div>
    </NavLink>
  );
}

export const FloatingDock: React.FC<{ onOpenCommand: () => void }> = ({ onOpenCommand }) => {
  const mouseX = useMotionValue(Infinity);
  const location = useLocation();

  return (
    <motion.div
      onMouseMove={(e) => mouseX.set(e.pageY)}
      onMouseLeave={() => mouseX.set(Infinity)}
      className="flex flex-col items-center gap-2.5 py-3 select-none"
    >
      {DOCK_ITEMS.map((item) => {
        let isActive = false;
        if (item.href === '/') {
          isActive = location.pathname === '/' || location.pathname.startsWith('/companies');
        } else if (item.href === '/queue') {
          isActive = location.pathname === '/queue' || location.pathname.startsWith('/drafts');
        } else {
          isActive = location.pathname.startsWith(item.href);
        }

        return (
          <DockIcon
            key={item.title}
            mouseX={mouseX}
            item={item}
            isActive={isActive}
          />
        );
      })}
    </motion.div>
  );
};
