'use client';

import { useState, useEffect, useCallback, useRef } from 'react';

interface UseExamTimerOptions {
  totalSeconds: number;
  onTimeUp: () => void;
  autoStart?: boolean;
}

interface UseExamTimerReturn {
  timeRemaining: number;
  formattedTime: string;
  isRunning: boolean;
  isWarning: boolean;
  isCritical: boolean;
  start: () => void;
  pause: () => void;
  resume: () => void;
  percentageRemaining: number;
}

export function useExamTimer({
  totalSeconds,
  onTimeUp,
  autoStart = false,
}: UseExamTimerOptions): UseExamTimerReturn {
  const [timeRemaining, setTimeRemaining] = useState(totalSeconds);
  const [isRunning, setIsRunning] = useState(autoStart);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const onTimeUpRef = useRef(onTimeUp);

  onTimeUpRef.current = onTimeUp;

  useEffect(() => {
    if (!isRunning) return;

    intervalRef.current = setInterval(() => {
      setTimeRemaining((prev) => {
        if (prev <= 1) {
          if (intervalRef.current) clearInterval(intervalRef.current);
          setIsRunning(false);
          onTimeUpRef.current();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isRunning]);

  const start = useCallback(() => setIsRunning(true), []);
  const pause = useCallback(() => setIsRunning(false), []);
  const resume = useCallback(() => setIsRunning(true), []);

  const formatTime = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    if (hrs > 0) {
      return `${hrs.toString().padStart(2, '0')}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const percentageRemaining = (timeRemaining / totalSeconds) * 100;
  const isWarning = percentageRemaining <= 25 && percentageRemaining > 10;
  const isCritical = percentageRemaining <= 10;

  return {
    timeRemaining,
    formattedTime: formatTime(timeRemaining),
    isRunning,
    isWarning,
    isCritical,
    start,
    pause,
    resume,
    percentageRemaining,
  };
}
