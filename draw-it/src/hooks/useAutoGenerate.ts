import { useEffect, useRef, useState, useCallback } from 'react';
import { useAppStore } from '../store/useAppStore';
import { useGeneration } from './useGeneration';

interface UseAutoGenerateReturn {
  countdown: number | null;
  cancelCountdown: () => void;
  triggerGenerate: () => void;
}

export function useAutoGenerate(): UseAutoGenerateReturn {
  const canvasDataUrl = useAppStore((s) => s.canvasDataUrl);
  const isDrawing = useAppStore((s) => s.isDrawing);
  const isGenerating = useAppStore((s) => s.isGenerating);
  const autoGenerate = useAppStore((s) => s.autoGenerate);
  const debounceDelay = useAppStore((s) => s.debounceDelay);

  const { generate } = useGeneration();
  const [countdown, setCountdown] = useState<number | null>(null);

  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const countdownIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const clearTimers = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownIntervalRef.current) {
      clearInterval(countdownIntervalRef.current);
      countdownIntervalRef.current = null;
    }
    setCountdown(null);
  }, []);

  const cancelCountdown = useCallback(() => {
    clearTimers();
  }, [clearTimers]);

  const triggerGenerate = useCallback(() => {
    clearTimers();
    generate();
  }, [clearTimers, generate]);

  useEffect(() => {
    if (!autoGenerate || isDrawing || isGenerating || !canvasDataUrl) {
      clearTimers();
      return;
    }

    // Canvas data changed and all conditions met — start countdown
    const endTime = Date.now() + debounceDelay;

    setCountdown(debounceDelay);
    countdownIntervalRef.current = setInterval(() => {
      const remaining = Math.max(0, endTime - Date.now());
      setCountdown(remaining);
      if (remaining <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
    }, 100);

    timerRef.current = setTimeout(() => {
      setCountdown(null);
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
        countdownIntervalRef.current = null;
      }
      generate();
    }, debounceDelay);

    return () => {
      clearTimers();
    };
  }, [canvasDataUrl, isDrawing, isGenerating, autoGenerate, debounceDelay, generate, clearTimers]);

  return {
    countdown,
    cancelCountdown,
    triggerGenerate,
  };
}
