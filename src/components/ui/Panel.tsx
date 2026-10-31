import React from 'react';
import { cn } from '../../utils/cn';
import { useAiva } from '../../contexts/AivaContext';
import type { PanelId } from '../../types/agent';

interface PanelProps {
  /** When set, an agent can walk to this panel and illuminate it. */
  id?: PanelId;
  title?: string;
  subtitle?: string;
  action?: React.ReactNode;
  className?: string;
  bodyClassName?: string;
  children: React.ReactNode;
}

export function Panel({ id, title, subtitle, action, className, bodyClassName, children }: PanelProps) {
  const { highlight, stageOpen } = useAiva();
  const lit = Boolean(id && highlight === id);
  const dimmed = stageOpen && Boolean(highlight) && !lit;

  return (
    <section
      data-panel={id}
      className={cn(
        'glass relative rounded-2xl shadow-panel transition-[opacity,box-shadow,transform] duration-300 ease-cinema',
        lit && 'z-[70] scale-[1.012] border-transparent',
        dimmed && 'opacity-45',
        className
      )}
      style={
      lit ?
      { boxShadow: '0 0 0 1px var(--accent), 0 0 60px -12px var(--accent), 0 30px 80px -30px rgba(0,0,0,.9)' } :
      undefined
      }>
      
      {lit &&
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-2xl opacity-40"
        style={{ background: 'radial-gradient(120% 90% at 50% 0%, var(--accent), transparent 60%)', opacity: 0.12 }} />

      }
      {(title || action) &&
      <header className="relative flex items-start justify-between gap-4 px-5 pt-4">
          <div>
            {title && <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>}
            {subtitle && <p className="mt-0.5 text-xs text-ink-muted">{subtitle}</p>}
          </div>
          {action}
        </header>
      }
      <div className={cn('relative px-5 pb-5', title ? 'pt-4' : 'pt-5', bodyClassName)}>{children}</div>
    </section>);

}

export function Eyebrow({ children, className }: {children: React.ReactNode;className?: string;}) {
  return (
    <span className={cn('text-[10px] font-medium uppercase tracking-widest text-ink-faint', className)}>
      {children}
    </span>);

}

export function StatusDot({ color, pulse = true }: {color: string;pulse?: boolean;}) {
  return (
    <span className="relative inline-flex h-2 w-2 shrink-0">
      {pulse &&
      <span
        className="absolute inset-0 rounded-full animate-pulse-ring"
        style={{ backgroundColor: color }}
        aria-hidden />

      }
      <span className="relative h-2 w-2 rounded-full" style={{ backgroundColor: color }} />
    </span>);

}