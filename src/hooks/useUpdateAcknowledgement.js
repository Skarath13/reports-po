import { useEffect, useRef } from 'react';

const HOVER_ACKNOWLEDGEMENT_DELAY_MS = 550;
const VIEW_DWELL_MS = 900;

function visibleTarget(target, requireFull = false) {
  if (
    !target?.isConnected ||
    document.visibilityState === 'hidden' ||
    target.closest('[inert], [aria-hidden="true"]')
  )
    return false;
  const rect = target.getBoundingClientRect();
  const width = window.innerWidth;
  const height = window.innerHeight;
  if (
    rect.width <= 0 ||
    rect.height <= 0 ||
    rect.bottom <= 0 ||
    rect.top >= height ||
    rect.right <= 0 ||
    rect.left >= width
  )
    return false;
  if (
    requireFull &&
    (rect.top < 0 ||
      rect.left < 0 ||
      rect.bottom > height ||
      rect.right > width)
  )
    return false;
  // IntersectionObserver does not account for a sheet or navigation overlay.
  const x = (Math.max(0, rect.left) + Math.min(width, rect.right)) / 2;
  const y = (Math.max(0, rect.top) + Math.min(height, rect.bottom)) / 2;
  const foreground = document.elementFromPoint?.(x, y);
  return (
    !document.elementFromPoint ||
    Boolean(foreground && target.contains(foreground))
  );
}

export function useUpdateAcknowledgement(active, onSeen, entry) {
  const targetRef = useRef(null);
  const hoverTimerRef = useRef(null);
  const viewTimerRef = useRef(null);
  const onSeenRef = useRef(onSeen);
  useEffect(() => {
    onSeenRef.current = onSeen;
  }, [onSeen]);

  const clearTimer = () => {
    clearTimeout(hoverTimerRef.current);
    hoverTimerRef.current = null;
  };
  const acknowledge = () => {
    clearTimer();
    if (visibleTarget(targetRef.current)) onSeenRef.current?.();
  };
  const startDwell = () => {
    clearTimer();
    if (!active || !visibleTarget(targetRef.current)) return;
    hoverTimerRef.current = setTimeout(
      acknowledge,
      HOVER_ACKNOWLEDGEMENT_DELAY_MS,
    );
  };

  useEffect(() => {
    const target = targetRef.current;
    const clearViewTimer = () => {
      clearTimeout(viewTimerRef.current);
      viewTimerRef.current = null;
    };
    const checkView = () => {
      clearViewTimer();
      if (document.visibilityState === 'hidden') clearTimer();
      // Establish a browsing baseline only for fully visible unchanged items.
      // A new item keeps its highlight until an intentional interaction.
      if (!active && entry?.entryKey && visibleTarget(target, true)) {
        viewTimerRef.current = setTimeout(() => {
          if (visibleTarget(target, true)) onSeenRef.current?.();
        }, VIEW_DWELL_MS);
      }
    };
    const observer =
      typeof IntersectionObserver === 'function'
        ? new IntersectionObserver(checkView, { threshold: [0, 1] })
        : null;
    if (target) observer?.observe(target);
    document.addEventListener('visibilitychange', checkView);
    window.addEventListener('scroll', clearTimer, true);
    return () => {
      clearTimer();
      clearViewTimer();
      observer?.disconnect();
      document.removeEventListener('visibilitychange', checkView);
      window.removeEventListener('scroll', clearTimer, true);
    };
  }, [active, entry?.entryKey, entry?.contentVersion]);

  return {
    ref: targetRef,
    'data-review-updated': active ? 'true' : undefined,
    onPointerMove: (event) => {
      // A scroll can fire pointerenter under a stationary cursor. Only real
      // pointer movement starts hover acknowledgement; jumping to an update
      // must not immediately dismiss it.
      if (
        event.pointerType !== 'touch' &&
        (event.movementX || event.movementY) &&
        !hoverTimerRef.current
      )
        startDwell();
    },
    onPointerLeave: clearTimer,
    onFocusCapture: startDwell,
    onBlurCapture: clearTimer,
    onClick: acknowledge,
  };
}

export const _private = { HOVER_ACKNOWLEDGEMENT_DELAY_MS, VIEW_DWELL_MS };
