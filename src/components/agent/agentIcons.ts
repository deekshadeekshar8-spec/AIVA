import type { ComponentType } from 'react';
import {
  AudioLinesIcon,
  BrainIcon,
  CrosshairIcon,
  ShieldIcon,
  SmileIcon,
  ZapIcon } from
'lucide-react';
import type { AgentId } from '../../types/agent';

export const agentIcons: Record<AgentId, ComponentType<{className?: string;}>> = {
  ava: AudioLinesIcon,
  aria: CrosshairIcon,
  mira: SmileIcon,
  zara: ShieldIcon,
  nia: BrainIcon,
  nova: ZapIcon
};