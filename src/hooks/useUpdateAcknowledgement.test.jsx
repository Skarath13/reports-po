import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useUpdateAcknowledgement, _private } from './useUpdateAcknowledgement';

function UpdateTarget({ active = true, onSeen, version = 'v1' }) {
  const handlers = useUpdateAcknowledgement(active, onSeen, {
    entryKey: 'a',
    contentVersion: version,
  });
  return (
    <div data-testid="target" {...handlers}>
      Updated item
    </div>
  );
}

function movePointer(target) {
  const event = new Event('pointermove', { bubbles: true });
  Object.defineProperties(event, {
    pointerType: { value: 'mouse' },
    movementX: { value: 1 },
    movementY: { value: 0 },
  });
  fireEvent(target, event);
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.spyOn(Element.prototype, 'getBoundingClientRect').mockReturnValue({
    top: 100,
    left: 50,
    bottom: 150,
    right: 250,
    width: 200,
    height: 50,
  });
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

test('requires a brief pointer dwell before acknowledging a hover', () => {
  const onSeen = vi.fn();
  render(<UpdateTarget onSeen={onSeen} />);

  movePointer(screen.getByTestId('target'));
  act(() =>
    vi.advanceTimersByTime(_private.HOVER_ACKNOWLEDGEMENT_DELAY_MS - 1),
  );
  expect(onSeen).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(1));
  expect(onSeen).toHaveBeenCalledTimes(1);
});

test('pointer leave cancels hover acknowledgement and touch waits for a click', () => {
  const onSeen = vi.fn();
  render(<UpdateTarget onSeen={onSeen} />);
  const target = screen.getByTestId('target');

  movePointer(target);
  fireEvent.pointerLeave(target);
  act(() => vi.advanceTimersByTime(_private.HOVER_ACKNOWLEDGEMENT_DELAY_MS));
  expect(onSeen).not.toHaveBeenCalled();

  const touchPointerEvent = new Event('pointerover', { bubbles: true });
  Object.defineProperty(touchPointerEvent, 'pointerType', { value: 'touch' });
  fireEvent(target, touchPointerEvent);
  act(() => vi.advanceTimersByTime(_private.HOVER_ACKNOWLEDGEMENT_DELAY_MS));
  expect(onSeen).not.toHaveBeenCalled();

  fireEvent.click(target);
  expect(onSeen).toHaveBeenCalledTimes(1);
});

function observe() {
  const callbacks = [];
  vi.stubGlobal(
    'IntersectionObserver',
    class {
      constructor(callback) {
        callbacks.push(callback);
      }
      observe() {}
      disconnect() {}
    },
  );
  return () => act(() => callbacks.at(-1)([]));
}

test('records only fully visible unchanged items after a dwell, leaving new highlights untouched', () => {
  const intersect = observe();
  const onSeen = vi.fn();
  const { rerender } = render(<UpdateTarget active={false} onSeen={onSeen} />);
  intersect();
  act(() => vi.advanceTimersByTime(_private.VIEW_DWELL_MS - 1));
  expect(onSeen).not.toHaveBeenCalled();
  act(() => vi.advanceTimersByTime(1));
  expect(onSeen).toHaveBeenCalledTimes(1);
  rerender(<UpdateTarget active onSeen={onSeen} version="v2" />);
  intersect();
  act(() => vi.advanceTimersByTime(2000));
  expect(onSeen).toHaveBeenCalledTimes(1);
});

test('offscreen and partly clipped items never get a viewing baseline', () => {
  const intersect = observe();
  const onSeen = vi.fn();
  render(<UpdateTarget active={false} onSeen={onSeen} />);
  for (const top of [-10, 900]) {
    Element.prototype.getBoundingClientRect.mockReturnValue({
      top,
      bottom: top + 50,
      left: 50,
      right: 250,
      width: 200,
      height: 50,
    });
    intersect();
    act(() => vi.advanceTimersByTime(2000));
  }
  fireEvent.click(screen.getByTestId('target'));
  expect(onSeen).not.toHaveBeenCalled();
});

test('scrolling out, hiding the tab, or an overlay cancels an in-flight acknowledgement', () => {
  const onSeen = vi.fn();
  render(<UpdateTarget onSeen={onSeen} />);
  const target = screen.getByTestId('target');
  movePointer(target);
  Element.prototype.getBoundingClientRect.mockReturnValue({
    top: 900,
    bottom: 950,
    left: 50,
    right: 250,
    width: 200,
    height: 50,
  });
  act(() => vi.advanceTimersByTime(1000));
  expect(onSeen).not.toHaveBeenCalled();
  Element.prototype.getBoundingClientRect.mockReturnValue({
    top: 100,
    bottom: 150,
    left: 50,
    right: 250,
    width: 200,
    height: 50,
  });
  movePointer(target);
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('hidden');
  fireEvent(document, new Event('visibilitychange'));
  act(() => vi.advanceTimersByTime(1000));
  expect(onSeen).not.toHaveBeenCalled();
  vi.spyOn(document, 'visibilityState', 'get').mockReturnValue('visible');
  target.setAttribute('aria-hidden', 'true');
  fireEvent.click(target);
  expect(onSeen).not.toHaveBeenCalled();
});

test('a content change cancels hover from the previous version and unmount removes timers', () => {
  const onSeen = vi.fn();
  const { rerender, unmount } = render(<UpdateTarget onSeen={onSeen} />);
  movePointer(screen.getByTestId('target'));
  rerender(<UpdateTarget onSeen={onSeen} version="v2" />);
  act(() => vi.advanceTimersByTime(1000));
  expect(onSeen).not.toHaveBeenCalled();
  fireEvent.focus(screen.getByTestId('target'));
  act(() => vi.advanceTimersByTime(_private.HOVER_ACKNOWLEDGEMENT_DELAY_MS));
  expect(onSeen).toHaveBeenCalledTimes(1);
  unmount();
  expect(vi.getTimerCount()).toBe(0);
});

test('scrolling an updated item under a stationary pointer never acknowledges it', () => {
  const onSeen = vi.fn();
  render(<UpdateTarget onSeen={onSeen} />);
  const target = screen.getByTestId('target');
  fireEvent.pointerEnter(target, { pointerType: 'mouse' });
  const event = new Event('pointermove', { bubbles: true });
  Object.defineProperties(event, {
    pointerType: { value: 'mouse' },
    movementX: { value: 0 },
    movementY: { value: 0 },
  });
  fireEvent(target, event);
  act(() => vi.advanceTimersByTime(2000));
  expect(onSeen).not.toHaveBeenCalled();
  movePointer(target);
  fireEvent.scroll(window);
  act(() => vi.advanceTimersByTime(2000));
  expect(onSeen).not.toHaveBeenCalled();
  movePointer(target);
  act(() => vi.advanceTimersByTime(_private.HOVER_ACKNOWLEDGEMENT_DELAY_MS));
  expect(onSeen).toHaveBeenCalledTimes(1);
});
