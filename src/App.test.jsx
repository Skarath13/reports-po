import { render, screen } from '@testing-library/react';
import App from './App';

test('renders reports PIN login', () => {
  render(<App />);
  expect(screen.getByRole('heading', { name: /reports/i })).toBeInTheDocument();
  expect(screen.getByText(/enter pin/i)).toBeInTheDocument();
});
