import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import { useUpdateAcknowledgement, _private } from './useUpdateAcknowledgement';

function UpdateTarget({ active = true, onSeen }) {
  const handlers = useUpdateAcknowledgement(active, onSeen);
  return <div data-testid="target" {...handlers}>Updated item</div>;
}

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
});

test('requires a brief pointer dwell before acknowledging a hover', () => {
  const onSeen = vi.fn();
  render(<UpdateTarget onSeen={onSeen} />);

  fireEvent.pointerEnter(screen.getByTestId('target'), { pointerType: 'mouse' });
  act(() => vi.advanceTimersByTime(_private.HOVER_ACKNOWLEDGEMENT_DELAY_MS - 1));
  expect(onSeen).not.toHaveBeenCalled();

  act(() => vi.advanceTimersByTime(1));
  expect(onSeen).toHaveBeenCalledTimes(1);
});

test('pointer leave cancels hover acknowledgement and touch waits for a click', () => {
  const onSeen = vi.fn();
  render(<UpdateTarget onSeen={onSeen} />);
  const target = screen.getByTestId('target');

  fireEvent.pointerEnter(target, { pointerType: 'mouse' });
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
