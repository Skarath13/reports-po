import { StrictMode } from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from './App';
import api from './api/client';

vi.mock('./api/client', () => ({
  default: {
    getToken: vi.fn(),
    verifyToken: vi.fn(),
    login: vi.fn(),
    logout: vi.fn(),
  },
}));
vi.mock('./components/Dashboard', () => ({
  default: ({ user }) => <h1>Dashboard for {user.username}</h1>,
}));

beforeEach(() => vi.resetAllMocks());

function enterPin(pin) {
  for (const key of pin) fireEvent.keyDown(window, { key });
}

test('renders a branded, accessible PIN keypad', () => {
  render(<App />);
  expect(
    screen.getByRole('heading', { name: 'Welcome to Reports' }),
  ).toBeInTheDocument();
  expect(
    screen.getByRole('img', { name: 'Elegant Lashes by Katie' }),
  ).toBeInTheDocument();
  expect(screen.getByText(/enter your 4-digit pin/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Clear PIN' })).toBeDisabled();
  expect(
    screen.getByRole('button', { name: 'Delete last digit' }),
  ).toBeDisabled();
  enterPin('12');
  fireEvent.click(screen.getByRole('button', { name: 'Delete last digit' }));
  expect(
    screen.getByRole('status', { name: '1 of 4 PIN digits entered' }),
  ).toBeInTheDocument();
  fireEvent.keyDown(window, { key: 'Escape' });
  expect(
    screen.getByRole('status', { name: '0 of 4 PIN digits entered' }),
  ).toBeInTheDocument();
  expect(api.login).not.toHaveBeenCalled();
});

test('keeps the keypad mounted during one pending submission and allows retry after an error', async () => {
  let rejectLogin;
  api.login.mockImplementationOnce(
    () =>
      new Promise((_resolve, reject) => {
        rejectLogin = reject;
      }),
  );
  render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
  enterPin('000000');
  expect(api.login).toHaveBeenCalledTimes(1);
  expect(api.login).toHaveBeenCalledWith('0000');
  expect(screen.getByText('Checking your PIN')).toBeInTheDocument();
  expect(screen.getByRole('group', { name: 'PIN keypad' })).toHaveAttribute(
    'aria-busy',
    'true',
  );
  expect(screen.getByRole('button', { name: '1', exact: true })).toBeDisabled();
  await act(async () => rejectLogin(new Error('Invalid PIN')));
  expect(screen.getByRole('alert')).toHaveTextContent('Invalid PIN');
  expect(
    screen.getByRole('status', { name: '0 of 4 PIN digits entered' }),
  ).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '1', exact: true })).toBeEnabled();
  api.login.mockResolvedValueOnce({ user: { username: 'Test viewer' } });
  await act(async () => enterPin('0000'));
  expect(
    screen.getByRole('heading', { name: 'Dashboard for Test viewer' }),
  ).toBeInTheDocument();
  expect(api.login).toHaveBeenCalledTimes(2);
});

test('shows the branded skeleton while restoring a session without displaying report data', async () => {
  let resolveVerify;
  api.getToken.mockReturnValue('test-session');
  api.verifyToken.mockImplementation(
    () =>
      new Promise((resolve) => {
        resolveVerify = resolve;
      }),
  );
  render(<App />);
  expect(screen.getByRole('main')).toHaveAttribute('aria-busy', 'true');
  expect(screen.getByText('Checking your session')).toBeInTheDocument();
  expect(
    screen.queryByRole('group', { name: 'PIN keypad' }),
  ).not.toBeInTheDocument();
  expect(document.querySelector('.loading-surface')).toHaveAttribute(
    'aria-hidden',
    'true',
  );
  await act(async () =>
    resolveVerify({ user: { username: 'Returning viewer' } }),
  );
  expect(
    screen.getByRole('heading', { name: 'Dashboard for Returning viewer' }),
  ).toBeInTheDocument();
});
