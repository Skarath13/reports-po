import React from 'react';
import { render, screen } from '@testing-library/react';
import ReportNoteContent from './ReportNoteContent';

test('shows persistent profile notes alongside appointment-specific notes', () => {
  render(
    <ReportNoteContent
      profileNote="Prefers sensitive adhesive."
      customerNote="Please use a quiet room."
      sellerNote="Confirm styling before service."
    />
  );

  expect(screen.getByText('Client profile')).toBeInTheDocument();
  expect(screen.getByText('Prefers sensitive adhesive.')).toBeInTheDocument();
  expect(screen.getByText('Customer')).toBeInTheDocument();
  expect(screen.getByText('Please use a quiet room.')).toBeInTheDocument();
  expect(screen.getByText('Business')).toBeInTheDocument();
  expect(screen.getByText('Confirm styling before service.')).toBeInTheDocument();
});

test('omits empty note types', () => {
  render(<ReportNoteContent profileNote="Persistent preference" />);

  expect(screen.getByText('Client profile')).toBeInTheDocument();
  expect(screen.queryByText('Customer')).not.toBeInTheDocument();
  expect(screen.queryByText('Business')).not.toBeInTheDocument();
});
