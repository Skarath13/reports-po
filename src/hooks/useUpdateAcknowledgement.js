import { useEffect, useRef } from 'react';

const HOVER_ACKNOWLEDGEMENT_DELAY_MS = 550;

export function useUpdateAcknowledgement(active, onSeen) {
  const timerRef = useRef(null);

  const clearTimer = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  const acknowledge = () => {
    clearTimer();
    if (active) onSeen?.();
  };

  const startDwell = () => {
    clearTimer();
    if (!active) return;
    timerRef.current = setTimeout(acknowledge, HOVER_ACKNOWLEDGEMENT_DELAY_MS);
  };

  useEffect(() => clearTimer, []);

  return {
    onPointerEnter: (event) => {
      if (event.pointerType !== 'touch') startDwell();
    },
    onPointerLeave: clearTimer,
    onFocusCapture: startDwell,
    onBlurCapture: clearTimer,
    onClick: acknowledge,
  };
}

export const _private = { HOVER_ACKNOWLEDGEMENT_DELAY_MS };
