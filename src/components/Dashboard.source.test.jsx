import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import {
  AppointmentRow,
  BloomSourceWarning,
  formatAppointmentClipboardLine,
  getAppointmentSource,
  getBloomUnavailableNotice,
} from './Dashboard';

const base = {
  id: 'square-1',
  appointmentTime: '2026-10-28T21:30:00.000Z',
  customerName: 'JANE DOE',
  serviceName: 'Natural Fill',
  daysSinceLastAppointment: 15,
};

describe('appointment booking source', () => {
  test.each([
    [{ source: 'bloom' }, 'bloom'],
    [{ appointmentSource: 'bloom' }, 'bloom'],
    [{ id: 'bloom:abc' }, 'bloom'],
    [{ bloomAppointmentId: 'abc', source: 'square' }, 'bloom'],
    [{ source: 'square' }, 'square'],
    [{ source: 'SQUARE' }, 'square'],
    [{}, null],
    [{ source: 'other' }, null],
    [{ source: 'constructor' }, null],
  ])('classifies %j as %s', (fields, expected) => {
    expect(getAppointmentSource({ ...base, ...fields })?.key ?? null).toBe(expected);
  });

  test('labels Bloom and Square rows distinctly', () => {
    const { rerender } = render(
      <AppointmentRow appointment={{ ...base, id: 'bloom:1', source: 'bloom' }} likelihoodMap={{}} />
    );
    expect(screen.getByText('Bloom')).toHaveAttribute('title', 'Booked in Bloom');

    rerender(<AppointmentRow appointment={{ ...base, source: 'square' }} likelihoodMap={{}} />);
    expect(screen.getByText('Square')).toHaveAttribute('title', 'Booked in Square');
    expect(screen.queryByText('Bloom')).not.toBeInTheDocument();
  });

  test('omits the badge when the source is unknown', () => {
    render(<AppointmentRow appointment={base} likelihoodMap={{}} />);
    expect(screen.queryByText('Square')).not.toBeInTheDocument();
    expect(screen.queryByText('Bloom')).not.toBeInTheDocument();
  });

  test('keeps the copied line unchanged for staff messages', () => {
    expect(formatAppointmentClipboardLine({ ...base, source: 'bloom' }, true, false))
      .toBe('2:30 PM - Natural Fill (15d)');
  });
});

describe('Bloom availability notice', () => {
  const date = '2026-10-28';
  const ok = { bloom: { status: 'ok' } };
  const down = { bloom: { status: 'unavailable' } };

  test.each([
    [{ sources: ok }, { date, sources: ok }, null],
    [{}, null, null],
    [{ sources: down }, { date, sources: ok }, 'report'],
    [{ sources: down }, { date, sources: down }, 'report'],
    [{ sources: ok }, { date, sources: down }, 'duplicates'],
    [{ sources: ok }, { date: '2026-10-27', sources: down }, null],
    [{ sources: { ...ok, bloomHistory: { status: 'unavailable' } } }, null, 'history'],
    [{ sources: { ...ok, bloomLookahead: { status: 'unavailable' } } }, { date, sources: ok }, 'history'],
    [{ sources: { ...down, bloomHistory: { status: 'unavailable' } } }, null, 'report'],
  ])('report %j with all-locations %j gives %s', (report, allLocations, expected) => {
    const notice = getBloomUnavailableNotice(report, allLocations, date);
    expect(notice?.scope ?? null).toBe(expected);
  });

  test('says the schedule may be missing Bloom bookings', () => {
    expect(getBloomUnavailableNotice({ sources: down }, null, date).message)
      .toMatch(/Bloom bookings could not be loaded/);
  });
});

describe('Bloom source warning banner', () => {
  test('announces the gap and retries both report sources', () => {
    const onRetry = vi.fn();
    const notice = getBloomUnavailableNotice({ sources: { bloom: { status: 'unavailable' } } }, null, '2026-10-28');
    render(<BloomSourceWarning notice={notice} onRetry={onRetry} />);
    expect(screen.getByRole('alert')).toHaveTextContent('Bloom bookings could not be loaded');
    fireEvent.click(screen.getByRole('button', { name: 'Try again' }));
    expect(onRetry).toHaveBeenCalledTimes(1);
  });

  test('renders nothing when Bloom loaded', () => {
    const { container } = render(<BloomSourceWarning notice={null} onRetry={() => {}} />);
    expect(container).toBeEmptyDOMElement();
  });
});
