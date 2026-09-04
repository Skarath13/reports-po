import { act, fireEvent, render, screen } from '@testing-library/react';
import RiskScore from './RiskScore';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function setup() {
  render(
    <>
      <RiskScore
        score={25}
        color="#abcdef"
        description="Risk score: 25/100. Heuristic from appointment history."
      />
      <button>Outside</button>
    </>,
  );
  return screen.getByRole('button', { name: /Risk score 25/ });
}

test('opens immediately on hover and lets the pointer move into the explanation', () => {
  const trigger = setup();
  fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
  const popover = screen.getByRole('dialog', { name: 'Risk score breakdown' });
  expect(popover).toBeVisible();
  expect(trigger).toHaveAttribute('aria-expanded', 'true');
  fireEvent.pointerLeave(trigger);
  act(() => vi.advanceTimersByTime(60));
  fireEvent.pointerEnter(popover);
  act(() => vi.advanceTimersByTime(200));
  expect(popover).toBeVisible();
  fireEvent.pointerLeave(popover);
  act(() => vi.advanceTimersByTime(120));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('click activation opens immediately and outside interaction dismisses it', () => {
  const trigger = setup();
  fireEvent.click(trigger);
  expect(
    screen.getByRole('dialog', { name: 'Risk score breakdown' }),
  ).toBeVisible();
  fireEvent.pointerLeave(trigger);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole('dialog')).toBeVisible();
  act(() => vi.runOnlyPendingTimers());
  fireEvent.pointerDown(screen.getByRole('button', { name: 'Outside' }));
  fireEvent.click(screen.getByRole('button', { name: 'Outside' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  fireEvent.click(trigger);
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.keyDown(document, { key: 'Escape' });
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

test('clicking an already-hovered score pins it until it is closed', () => {
  const trigger = setup();
  fireEvent.pointerEnter(trigger, { pointerType: 'mouse' });
  fireEvent.click(trigger);
  fireEvent.pointerLeave(trigger);
  act(() => vi.advanceTimersByTime(500));
  expect(screen.getByRole('dialog')).toBeVisible();
  fireEvent.click(screen.getByRole('button', { name: 'Close risk breakdown' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});
