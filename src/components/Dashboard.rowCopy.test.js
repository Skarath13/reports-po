import React from 'react';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { AppointmentRow, formatAppointmentClipboardLine } from './Dashboard';

const appointment = {
  id: 'appointment-1',
  appointmentTime: '2026-08-30T16:15:00.000Z',
  customerName: 'JANE DOE',
  serviceName: 'Natural Fill',
  daysSinceLastAppointment: 15,
  priceBadge: {
    label: '$80',
    title: 'Natural Fill price',
  },
};

describe('appointment row copy', () => {
  let writeText;

  beforeEach(() => {
    writeText = jest.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText },
    });
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: undefined,
    });
  });

  test('uses the same privacy and price-aware line format as full schedule copy', () => {
    expect(formatAppointmentClipboardLine(appointment, false, true))
      .toBe('9:15 AM - Jane Doe - Natural Fill (15d) ~ $80');
    expect(formatAppointmentClipboardLine(appointment, true, false))
      .toBe('9:15 AM - Natural Fill (15d)');
  });

  test('copies one hidden-name row and confirms success in place', async () => {
    render(
      <AppointmentRow
        appointment={appointment}
        hideNames
        showPrices
        likelihoodMap={{}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy 9:15 AM appointment' }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith('9:15 AM - Natural Fill (15d) ~ $80');
    });
    expect(await screen.findByRole('button', { name: 'Copied 9:15 AM appointment' }))
      .toHaveClass('copied');
  });

  test('shows a recoverable failure state when clipboard access is blocked', async () => {
    writeText.mockRejectedValueOnce(new Error('blocked'));
    render(
      <AppointmentRow
        appointment={appointment}
        hideNames={false}
        showPrices={false}
        likelihoodMap={{}}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: 'Copy 9:15 AM appointment' }));

    expect(await screen.findByRole('button', {
      name: 'Copy failed for 9:15 AM appointment',
    })).toHaveClass('failed');
  });
});
