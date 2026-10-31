import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'framer-motion';
import { cn } from '../../utils/cn';
import { walkInSeconds } from '../../motion/walkTiming';
import type { Agent, AgentState } from '../../types/agent';

interface AgentVideoPanelProps {
  agent: Agent;
  state: AgentState;
  atPanel?: boolean;
  className?: string;
  /** Called once if /agents/<id>/presence.mp4 fails to load, so the caller can fall back. */
  onUnavailable: () => void;
}

const SPEAKING_STATES: AgentState[] = ['speaking', 'explaining', 'warning', 'success', 'executing'];

/**
 * Plays a single cinematic clip as a self-contained "video call" style
 * panel — the clip's own baked-in office background shows as-is (no live
 * background removal). This is the fallback for agents that don't have
 * green-screen state clips yet (see AgentCharacter's render-mode order);
 * once real green-screen footage lands, that mode takes over automatically.
 *
 * Playback is manual and state-driven, not a dumb loop:
 *  - The walk-in plays once per activation, then freezes on the settled
 *    "standing, ready to talk" frame — it never replays on later lines.
 *  - Once speaking starts, playback resumes from that settle point and
 *    loops only the talking segment for as long as speech continues.
 *  - When speech stops, playback freezes on the current frame.
 */
export function AgentVideoPanel({ agent, state, className, onUnavailable }: AgentVideoPanelProps) {
  const [videoNode, setVideoNode] = useState<HTMLVideoElement | null>(null);
  const walkDoneRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const durationRef = useRef(0);
  const [failed, setFailed] = useState(false);

  const isSpeaking = SPEAKING_STATES.includes(state);
  const settleAt = walkInSeconds(agent.id);

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  // Fresh activation for this agent: replay the walk-in from the top.
  useEffect(() => {
    if (!videoNode) return;
    walkDoneRef.current = false;
    videoNode.currentTime = 0;
    videoNode.play().catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoNode, agent.id]);

  useEffect(() => {
    if (!videoNode) return;

    const handleLoadedMetadata = () => {
      durationRef.current = videoNode.duration || 0;
    };

    const handleTimeUpdate = () => {
      if (!walkDoneRef.current && videoNode.currentTime >= settleAt) {
        walkDoneRef.current = true;
        if (!isSpeakingRef.current) videoNode.pause();
      }
      const duration = durationRef.current;
      if (walkDoneRef.current && isSpeakingRef.current && duration && videoNode.currentTime >= duration - 0.15) {
        videoNode.currentTime = settleAt;
        videoNode.play().catch(() => {});
      }
    };

    const handleError = () => onUnavailable();

    videoNode.addEventListener('loadedmetadata', handleLoadedMetadata);
    videoNode.addEventListener('timeupdate', handleTimeUpdate);
    videoNode.addEventListener('error', handleError);
    return () => {
      videoNode.removeEventListener('loadedmetadata', handleLoadedMetadata);
      videoNode.removeEventListener('timeupdate', handleTimeUpdate);
      videoNode.removeEventListener('error', handleError);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoNode, settleAt]);

  // Resume into the talking loop when speech starts; freeze when it stops.
  useEffect(() => {
    if (!videoNode || !walkDoneRef.current) return;
    if (isSpeaking) {
      if (videoNode.currentTime < settleAt) videoNode.currentTime = settleAt;
      videoNode.play().catch(() => {});
    } else {
      videoNode.pause();
    }
  }, [videoNode, isSpeaking, settleAt]);

  if (failed) return null;

  return (
    <motion.div
      className={cn('pointer-events-none relative select-none overflow-hidden rounded-3xl', className)}
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: state === 'exiting' ? 0 : 1, scale: 1 }}
      transition={{ duration: 0.5, ease: [0.23, 1, 0.32, 1] }}
      style={{
        boxShadow: `0 0 0 1px ${agent.accent}55, 0 30px 80px -30px rgba(0,0,0,.9), 0 0 60px -18px ${isSpeaking ? agent.accent : 'transparent'}`
      }}>

      <video
        ref={(el) => setVideoNode(el)}
        src={`/agents/${agent.id}/presence.mp4`}
        muted
        playsInline
        onError={() => {
          setFailed(true);
          onUnavailable();
        }}
        className="h-full w-full object-cover" />


      <div className="absolute left-3 top-3 flex items-center gap-1.5 rounded-full bg-black/50 px-2.5 py-1 backdrop-blur-sm">
        <span
          className={cn('h-1.5 w-1.5 rounded-full', isSpeaking ? 'animate-pulse-ring' : '')}
          style={{ background: agent.accent }} />

        <span className="text-[10px] uppercase tracking-widest text-white/80">{state}</span>
      </div>
    </motion.div>);

}
