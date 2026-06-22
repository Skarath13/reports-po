import React, { useState, useEffect, useRef } from 'react';
import './Login.css';

function Login({ onLogin, error: authError }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);
  const containerRef = useRef(null);

  const handleDigit = (digit) => {
    if (pin.length < 4) {
      setPin(prev => prev + digit);
      setError(null);
    }
  };

  const handleDelete = () => {
    setPin(prev => prev.slice(0, -1));
  };

  const handleClear = () => {
    setPin('');
    setError(null);
  };

  const handleSubmit = async () => {
    if (pin.length !== 4) {
      setError('Please enter a 4-digit PIN');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      await onLogin(pin);
    } catch (err) {
      setError(err.message || 'Invalid PIN');
      setPin('');
    } finally {
      setLoading(false);
    }
  };

  // Keyboard support
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (loading) return;

      if (e.key >= '0' && e.key <= '9') {
        handleDigit(e.key);
      } else if (e.key === 'Backspace') {
        handleDelete();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [loading, pin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-submit when 4 digits entered
  useEffect(() => {
    if (pin.length === 4) {
      handleSubmit();
    }
  }, [pin]); // eslint-disable-line react-hooks/exhaustive-deps

  // Focus container on mount for keyboard events
  useEffect(() => {
    containerRef.current?.focus();
  }, []);

  return (
    <div className="login-container" ref={containerRef} tabIndex={-1}>
      <div className="login-card">
        <div className="login-header">
          <h1>Reports</h1>
          <p>Enter PIN</p>
        </div>

        <div className="pin-display">
          {[0, 1, 2, 3].map(i => (
            <div
              key={i}
              className={`pin-dot ${i < pin.length ? 'filled' : ''}`}
            />
          ))}
        </div>

        {(error || authError) && (
          <div className="error-message">
            {error || authError}
          </div>
        )}

        <div className="pin-pad">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(digit => (
            <button
              key={digit}
              className="pin-button"
              onClick={() => handleDigit(String(digit))}
              disabled={loading}
            >
              {digit}
            </button>
          ))}
          <button
            className="pin-button secondary"
            onClick={handleClear}
            disabled={loading}
          >
            C
          </button>
          <button
            className="pin-button"
            onClick={() => handleDigit('0')}
            disabled={loading}
          >
            0
          </button>
          <button
            className="pin-button secondary"
            onClick={handleDelete}
            disabled={loading}
          >
            ←
          </button>
        </div>

        {loading && (
          <div className="loading-indicator">
            <div className="spinner"></div>
          </div>
        )}

        <p className="keyboard-hint">or use keyboard</p>
      </div>
    </div>
  );
}

export default Login;
