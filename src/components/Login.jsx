import React, { useState } from 'react';
import { Activity, Lock, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { showError, notifyLoginSuccess, notifyRegistrationSuccess, notifyNetworkError } from '../services/toast';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [isRegistering, setIsRegistering] = useState(false);
  const [loading, setLoading] = useState(false);
  const { login, register } = useAuth();
  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      let result;

      if (isRegistering) {
        result = await register(email, password, firstName, lastName);
      } else {
        result = await login(email, password);
      }

      if (!result.success) {
        const errorMsg = result.error || 'Authentication failed';
        setError(errorMsg);
        showError(errorMsg);
        setLoading(false);
        return;
      }

      if (isRegistering) {
        notifyRegistrationSuccess();
        navigate('/dashboard');
      } else {
        notifyLoginSuccess(email);
        navigate('/dashboard');
      }
    } catch (err) {
      const errorMsg = 'Network error. Please try again.';
      setError(errorMsg);
      notifyNetworkError();
      setLoading(false);
    }
  };

  const theme = {
    background: 'radial-gradient(circle at top, #111827 0%, #020617 60%)',
    panel: 'rgba(15, 23, 42, 0.85)',
    border: 'rgba(148, 163, 184, 0.4)',
    inputBg: 'rgba(15, 23, 42, 0.65)',
    inputBorder: 'rgba(148, 163, 184, 0.35)',
    inputFocus: '#38bdf8',
    textPrimary: '#e2e8f0',
    textSecondary: '#94a3b8',
    accent: '#38bdf8',
    accentHover: '#0ea5e9',
    error: '#f87171'
  };

  return (
    <div style={{
      minHeight: '100vh',
      width: '100%',
      background: theme.background,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '48px'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '480px',
        borderRadius: '24px',
        padding: '48px',
        backgroundColor: theme.panel,
        border: `1px solid ${theme.border}`,
        boxShadow: '0 35px 70px rgba(2, 6, 23, 0.65)',
        backdropFilter: 'blur(12px)'
      }}>
        <div style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: '16px',
          marginBottom: '32px'
        }}>
          <div style={{
            width: 64,
            height: 64,
            background: 'conic-gradient(from 180deg at 50% 50%, #22d3ee 0deg, #818cf8 120deg, #38bdf8 240deg, #22d3ee 360deg)',
            borderRadius: 16,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 12px 30px rgba(8, 145, 178, 0.55)'
          }}>
            <Activity size={28} color="#fff" />
          </div>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: theme.textPrimary, letterSpacing: '0.04em' }}>
              Covenant Technology
            </div>
            <div style={{ fontSize: '14px', color: theme.textSecondary }}>
              Operational Intelligence Console
            </div>
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          {isRegistering && (
            <>
              <div style={{ marginBottom: '18px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.textSecondary,
                  marginBottom: '8px',
                  letterSpacing: '0.08em'
                }}>
                  FIRST NAME
                </label>
                <input
                  type="text"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                  autoComplete="given-name"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    borderRadius: '14px',
                    color: theme.textPrimary,
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, transform 0.15s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.inputFocus;
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.inputBorder;
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>
              <div style={{ marginBottom: '18px' }}>
                <label style={{
                  display: 'block',
                  fontSize: '13px',
                  fontWeight: 600,
                  color: theme.textSecondary,
                  marginBottom: '8px',
                  letterSpacing: '0.08em'
                }}>
                  LAST NAME
                </label>
                <input
                  type="text"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                  autoComplete="family-name"
                  style={{
                    width: '100%',
                    padding: '14px 16px',
                    background: theme.inputBg,
                    border: `1px solid ${theme.inputBorder}`,
                    borderRadius: '14px',
                    color: theme.textPrimary,
                    fontSize: '15px',
                    outline: 'none',
                    boxSizing: 'border-box',
                    transition: 'border-color 0.2s, transform 0.15s'
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = theme.inputFocus;
                    e.target.style.transform = 'translateY(-1px)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = theme.inputBorder;
                    e.target.style.transform = 'translateY(0)';
                  }}
                />
              </div>
            </>
          )}

          <div style={{ marginBottom: '18px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: theme.textSecondary,
              marginBottom: '8px',
              letterSpacing: '0.08em'
            }}>
              EMAIL
            </label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              required
              style={{
                width: '100%',
                padding: '14px 16px',
                background: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: '14px',
                color: theme.textPrimary,
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, transform 0.15s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.inputFocus;
                e.target.style.transform = 'translateY(-1px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.inputBorder;
                e.target.style.transform = 'translateY(0)';
              }}
            />
          </div>

          <div style={{ marginBottom: '24px' }}>
            <label style={{
              display: 'block',
              fontSize: '13px',
              fontWeight: 600,
              color: theme.textSecondary,
              marginBottom: '8px',
              letterSpacing: '0.08em'
            }}>
              PASSWORD
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
              minLength={8}
              style={{
                width: '100%',
                padding: '14px 16px',
                background: theme.inputBg,
                border: `1px solid ${theme.inputBorder}`,
                borderRadius: '14px',
                color: theme.textPrimary,
                fontSize: '15px',
                outline: 'none',
                boxSizing: 'border-box',
                transition: 'border-color 0.2s, transform 0.15s'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = theme.inputFocus;
                e.target.style.transform = 'translateY(-1px)';
              }}
              onBlur={(e) => {
                e.target.style.borderColor = theme.inputBorder;
                e.target.style.transform = 'translateY(0)';
              }}
            />
            {isRegistering && (
              <p style={{
                fontSize: '12px',
                color: theme.textSecondary,
                marginTop: '6px',
                marginBottom: 0
              }}>
                Password must be at least 8 characters.
              </p>
            )}
          </div>

          {error && (
            <div style={{
              padding: '12px',
              backgroundColor: 'rgba(248, 113, 113, 0.18)',
              border: `1px solid ${theme.error}`,
              borderRadius: '12px',
              color: '#fecaca',
              fontSize: '14px',
              marginBottom: '20px'
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              padding: '14px',
              background: loading
                ? 'linear-gradient(135deg, rgba(56, 189, 248, 0.45), rgba(129, 140, 248, 0.45))'
                : 'linear-gradient(135deg, #38bdf8, #6366f1)',
              color: '#ffffff',
              border: 'none',
              borderRadius: '16px',
              fontSize: '16px',
              fontWeight: 700,
              cursor: loading ? 'not-allowed' : 'pointer',
              transition: 'transform 0.15s, box-shadow 0.2s'
            }}
            onMouseEnter={(e) => {
              if (!loading) {
                e.target.style.transform = 'translateY(-2px)';
                e.target.style.boxShadow = '0 16px 30px rgba(14, 165, 233, 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              e.target.style.transform = 'translateY(0)';
              e.target.style.boxShadow = 'none';
            }}
          >
            {loading ? 'Please wait...' : (isRegistering ? 'Create Account' : 'Login')}
          </button>
        </form>

        <div style={{
          marginTop: '24px',
          textAlign: 'center',
          fontSize: '14px',
          color: theme.textSecondary
        }}>
          <button
            onClick={() => {
              setIsRegistering(!isRegistering);
              setError('');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: theme.accent,
              cursor: 'pointer',
              textDecoration: 'underline',
              fontSize: '14px'
            }}
          >
            {isRegistering ? 'Back to login' : 'Need an account? Register'}
          </button>
        </div>
      </div>
    </div>
  );
};

export default Login;
