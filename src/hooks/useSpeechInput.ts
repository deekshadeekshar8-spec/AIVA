import { useCallback, useEffect, useRef, useState } from 'react';

type RecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: any) => void) | null;
  onerror: (() => void) | null;
  onend: (() => void) | null;
};

/**
 * Voice command capture. Uses the browser SpeechRecognition API when present;
 * otherwise reports unsupported so the UI can fall back to typing.
 */
export function useSpeechInput(onResult: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const recognitionRef = useRef<RecognitionLike | null>(null);
  const supported =
  typeof window !== 'undefined' &&
  Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition);

  useEffect(() => {
    if (!supported) return;
    const Ctor = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    const recognition: RecognitionLike = new Ctor();
    recognition.lang = 'en-IN';
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.onresult = (e: any) => {
      const text = e?.results?.[0]?.[0]?.transcript;
      if (text) onResult(String(text));
    };
    recognition.onerror = () => setListening(false);
    recognition.onend = () => setListening(false);
    recognitionRef.current = recognition;
    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {

        /* already stopped */}
    };
  }, [onResult, supported]);

  const start = useCallback(() => {
    if (!recognitionRef.current) return false;
    try {
      recognitionRef.current.start();
      setListening(true);
      return true;
    } catch {
      return false;
    }
  }, []);

  const stop = useCallback(() => {
    try {
      recognitionRef.current?.stop();
    } catch {

      /* noop */}
    setListening(false);
  }, []);

  return { supported, listening, start, stop };
}