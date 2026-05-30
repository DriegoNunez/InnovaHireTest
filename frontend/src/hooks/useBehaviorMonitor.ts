'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import type { BehaviorEvent, BehaviorEventType } from '@/types';

interface UseBehaviorMonitorOptions {
  enabled: boolean;
  onEvent?: (event: BehaviorEvent) => void;
  maxEvents?: number;
}

interface UseBehaviorMonitorReturn {
  events: BehaviorEvent[];
  riskScore: number;
  clearEvents: () => void;
}

const SEVERITY_MAP: Record<BehaviorEventType, 'low' | 'medium' | 'high'> = {
  tab_switch: 'high',
  window_blur: 'medium',
  copy_attempt: 'high',
  paste_attempt: 'high',
  right_click: 'low',
  screenshot_attempt: 'high',
  devtools_open: 'high',
  fullscreen_exit: 'medium',
  idle_timeout: 'low',
  suspicious_typing: 'medium',
};

const RISK_SCORES: Record<string, number> = {
  low: 1,
  medium: 3,
  high: 5,
};

export function useBehaviorMonitor({
  enabled,
  onEvent,
  maxEvents = 100,
}: UseBehaviorMonitorOptions): UseBehaviorMonitorReturn {
  const [events, setEvents] = useState<BehaviorEvent[]>([]);
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  const addEvent = useCallback(
    (type: BehaviorEventType, details?: string) => {
      const event: BehaviorEvent = {
        id: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        type,
        timestamp: new Date().toISOString(),
        details,
        severity: SEVERITY_MAP[type],
      };

      setEvents((prev) => {
        const next = [...prev, event];
        return next.slice(-maxEvents);
      });

      onEventRef.current?.(event);
    },
    [maxEvents]
  );

  useEffect(() => {
    if (!enabled) return;

    const handleVisibilityChange = () => {
      if (document.hidden) {
        addEvent('tab_switch', 'User switched tabs');
      }
    };

    const handleBlur = () => {
      addEvent('window_blur', 'Window lost focus');
    };

    const handleCopy = (e: ClipboardEvent) => {
      e.preventDefault();
      addEvent('copy_attempt', 'Copy attempt blocked');
    };

    const handlePaste = (e: ClipboardEvent) => {
      e.preventDefault();
      addEvent('paste_attempt', 'Paste attempt blocked');
    };

    const handleContextMenu = (e: MouseEvent) => {
      e.preventDefault();
      addEvent('right_click', 'Right-click blocked');
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      // Detect devtools
      if (e.key === 'F12' || (e.ctrlKey && e.shiftKey && e.key === 'I')) {
        e.preventDefault();
        addEvent('devtools_open', 'DevTools shortcut detected');
      }
      // Detect screenshot
      if (e.key === 'PrintScreen') {
        e.preventDefault();
        addEvent('screenshot_attempt', 'Screenshot attempt detected');
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('blur', handleBlur);
    document.addEventListener('copy', handleCopy);
    document.addEventListener('paste', handlePaste);
    document.addEventListener('contextmenu', handleContextMenu);
    document.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('blur', handleBlur);
      document.removeEventListener('copy', handleCopy);
      document.removeEventListener('paste', handlePaste);
      document.removeEventListener('contextmenu', handleContextMenu);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [enabled, addEvent]);

  const riskScore = events.reduce((score, event) => {
    return score + RISK_SCORES[event.severity];
  }, 0);

  const clearEvents = useCallback(() => setEvents([]), []);

  return {
    events,
    riskScore,
    clearEvents,
  };
}
