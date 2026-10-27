import React from 'react';
import { render, screen } from '@testing-library/react';
import { AppointmentRow, formatAppointmentClipboardLine, getAppointmentSource } from './Dashboard';

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
