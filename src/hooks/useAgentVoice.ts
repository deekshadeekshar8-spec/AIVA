import { useCallback, useEffect, useRef } from 'react';

export interface VoiceProfile {
  pitch: number;
  rate: number;
  match: string[];
}

/**
 * Thin wrapper over the Web Speech API so each agent has its own voice.
 * Falls back silently (the script player then uses line durations) when the
 * browser has no speech synthesis or the user has muted AIVA.
 */
export function useAgentVoice() {
  const voicesRef = useRef<SpeechSynthesisVoice[]>([]);
  const supported = typeof window !== 'undefined' && 'speechSynthesis' in window;

  useEffect(() => {
    if (!supported) return;
    const load = () => {
      voicesRef.current = window.speechSynthesis.getVoices();
    };
    load();
    window.speechSynthesis.addEventListener('voiceschanged', load);
    return () => {
      window.speechSynthesis.removeEventListener('voiceschanged', load);
      window.speechSynthesis.cancel();
    };
  }, [supported]);

  const pickVoice = useCallback((profile: VoiceProfile) => {
    const voices = voicesRef.current;
    if (!voices.length) return undefined;
    const english = voices.filter((v) => v.lang.toLowerCase().startsWith('en'));
    const pool = english.length ? english : voices;
    for (const token of profile.match) {
      const hit = pool.find((v) => v.name.toLowerCase().includes(token));
      if (hit) return hit;
    }
    return pool[0];
  }, []);

  const cancel = useCallback(() => {
    if (!supported) return;
    window.speechSynthesis.cancel();
  }, [supported]);

  /** Returns true when speech actually started (caller can then wait for onEnd). */
  const speak = useCallback(
    (text: string, profile: VoiceProfile, onEnd: () => void): boolean => {
      if (!supported) return false;
      try {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        const voice = pickVoice(profile);
        if (voice) utterance.voice = voice;
        utterance.pitch = profile.pitch;
        utterance.rate = profile.rate;
        utterance.volume = 1;
        utterance.onend = onEnd;
        utterance.onerror = onEnd;
        window.speechSynthesis.speak(utterance);
        return true;
      } catch {
        return false;
      }
    },
    [pickVoice, supported]
  );

  return { speak, cancel, supported };
}