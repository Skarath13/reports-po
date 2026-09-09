import { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, CircleAlert, LockKeyhole, Keyboard } from 'lucide-react';
import BrandLogo from './BrandLogo';
import InterfaceSwitcher from './InterfaceSwitcher';
import { LoadingStatus } from './LoadingState';
import './Login.css';

function Login({ onLogin, error: authError }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(authError || null);
  const [loading, setLoading] = useState(false);
  // No explicit choice means restore this user's saved interface after authentication.
  const [interfaceMode, setInterfaceMode] = useState(null);
  const pinRef = useRef('');
  const submittingRef = useRef(false);
  const containerRef = useRef(null);

  useEffect(() => {
    setError(authError || null);
  }, [authError]);

  const submit = useCallback(
    async (candidate) => {
      if (submittingRef.current) return;
      submittingRef.current = true;
      setLoading(true);
      setError(null);
      try {
        await onLogin(candidate, interfaceMode);
      } catch (err) {
        setError(err.message || 'Unable to sign in. Please try again.');
        containerRef.current?.focus({ preventScroll: true });
      } finally {
        pinRef.current = '';
        setPin('');
        submittingRef.current = false;
        setLoading(false);
      }
    },
    [interfaceMode, onLogin],
  );

  const handleDigit = useCallback(
    (digit) => {
      if (submittingRef.current || pinRef.current.length >= 4) return;
      const next = pinRef.current + digit;
      pinRef.current = next;
      setPin(next);
      setError(null);
      if (next.length === 4) void submit(next);
    },
    [submit],
  );

  const handleDelete = useCallback(() => {
    if (submittingRef.current) return;
    pinRef.current = pinRef.current.slice(0, -1);
    setPin(pinRef.current);
    setError(null);
  }, []);

  const handleClear = useCallback(() => {
    if (submittingRef.current) return;
    pinRef.current = '';
    setPin('');
    setError(null);
  }, []);

  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.metaKey || event.ctrlKey || event.altKey || event.repeat)
        return;
      if (/^[0-9]$/.test(event.key)) {
        event.preventDefault();
        handleDigit(event.key);
      } else if (event.key === 'Backspace' || event.key === 'Delete') {
        event.preventDefault();
        handleDelete();
      } else if (event.key === 'Escape') {
        handleClear();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleClear, handleDelete, handleDigit]);

  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <main className="login-container" ref={containerRef} tabIndex={-1}>
      <div className="login-card">
        <div className="login-identity">
          <BrandLogo className="login-logo" />
          <div className="login-heading">
            <span className="login-eyebrow">
              <LockKeyhole size={13} /> Your daily workspace
            </span>
            <h1>Welcome to Reports</h1>
            <p>Enter your 4-digit PIN to get started.</p>
          </div>
        </div>
        <div className="login-interface-choice">
          <InterfaceSwitcher
            value={interfaceMode}
            onChange={setInterfaceMode}
            disabled={loading}
          />
          <p>
            {interfaceMode
              ? `${interfaceMode === 'old' ? 'Old' : 'New'} interface will open after sign-in.`
              : 'Choose an interface, or use your saved choice. Default: Old.'}
          </p>
        </div>
        <div className="login-entry">
          <div
            className={`pin-display ${error ? 'has-error' : ''} ${loading ? 'is-checking' : ''}`}
            aria-label={`${pin.length} of 4 PIN digits entered`}
            role="status"
            aria-live="polite"
          >
            {[0, 1, 2, 3].map((index) => (
              <span
                key={index}
                className={`pin-slot ${index < pin.length ? 'filled' : ''} ${index === pin.length && !loading ? 'current' : ''}`}
                aria-hidden="true"
              >
                <span />
              </span>
            ))}
          </div>
          <div className="login-feedback">
            {loading ? (
              <LoadingStatus
                compact
                title="Checking your PIN"
                detail="Opening your workspace securely."
              />
            ) : error ? (
              <div className="login-error" role="alert">
                <CircleAlert size={18} />
                <span>{error}</span>
              </div>
            ) : (
              <p>We’ll sign you in after the fourth digit.</p>
            )}
          </div>
          <div
            className="pin-pad"
            role="group"
            aria-label="PIN keypad"
            aria-busy={loading}
          >
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((digit) => (
              <button
                type="button"
                key={digit}
                className="pin-button"
                onClick={() => handleDigit(String(digit))}
                disabled={loading}
              >
                {digit}
              </button>
            ))}
            <button
              type="button"
              className="pin-button secondary"
              onClick={handleClear}
              aria-label="Clear PIN"
              disabled={loading || (!pin && !error)}
            >
              Clear
            </button>
            <button
              type="button"
              className="pin-button"
              onClick={() => handleDigit('0')}
              disabled={loading}
            >
              0
            </button>
            <button
              type="button"
              className="pin-button secondary"
              onClick={handleDelete}
              aria-label="Delete last digit"
              disabled={loading || !pin}
            >
              <ArrowLeft size={22} />
            </button>
          </div>
          <p className="keyboard-hint">
            <Keyboard size={16} /> You can also use your keyboard
          </p>
        </div>
      </div>
      <p className="login-footer">A clear view of your day.</p>
    </main>
  );
}

export default Login;
