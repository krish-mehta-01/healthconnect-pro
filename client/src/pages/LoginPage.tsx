import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { fetchCurrentUser, setUser, loginUser, registerUser } from '../store/authSlice';
import { useTheme } from '../context/ThemeContext';
import { Heart, Shield, Activity, BarChart3, Moon, Sun } from 'lucide-react';
import './LoginPage.css';

export default function LoginPage() {
  const { isAuthenticated, loading, error } = useAppSelector(s => s.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();

  const [isSignUp, setIsSignUp] = useState(false);

  // Form State
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [role, setRole] = useState('Facility_Staff');
  const [facilityId, setFacilityId] = useState('');

  useEffect(() => {
    if (isAuthenticated) navigate('/', { replace: true });
  }, [isAuthenticated, navigate]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (isSignUp) {
      dispatch(registerUser({ email, password, name, role, facilityId }));
    } else {
      dispatch(loginUser({ email, password }));
    }
  };

  return (
    <div className="auth-page">
      <button
        onClick={toggleTheme}
        style={{
          position: 'absolute',
          top: '1rem',
          right: '1rem',
          background: 'var(--color-bg-elevated)',
          border: '1px solid var(--color-border)',
          color: 'var(--color-text-primary)',
          width: '40px',
          height: '40px',
          borderRadius: '50%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          cursor: 'pointer',
          zIndex: 10
        }}
        aria-label="Toggle Theme"
      >
        {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
      </button>

      {/* LEFT: Branding Hero */}
      <div className="auth-hero">
        <div className="auth-hero-bg" />
        <div className="auth-hero-content">
          <Heart size={48} className="auth-hero-icon" />
          <h1>HealthConnect<span className="text-accent">Pro</span></h1>
          <p className="auth-subtitle">
            Enterprise Health Management Information System
          </p>

          <div className="auth-features">
            <div className="auth-feature">
              <Shield size={24} />
              <span>Multi-tier facility reporting & compliance</span>
            </div>
            <div className="auth-feature">
              <Activity size={24} />
              <span>AI-powered sentiment analysis & OCR extraction</span>
            </div>
            <div className="auth-feature">
              <BarChart3 size={24} />
              <span>Real-time executive KPI dashboards</span>
            </div>
          </div>
        </div>
      </div>

      {/* RIGHT: Auth Form */}
      <div className="auth-form-side">
        <div className="auth-card">
          <div className="auth-card-header">
            <h2>{isSignUp ? 'Create Account' : 'Welcome Back'}</h2>
            <p>{isSignUp ? 'Join the HealthConnect network' : 'Sign in to access your dashboard'}</p>
          </div>

          <div className="auth-toggle">
            <button
              type="button"
              className={`auth-toggle-btn ${!isSignUp ? 'active' : ''}`}
              onClick={() => setIsSignUp(false)}
            >
              Sign In
            </button>
            <button
              type="button"
              className={`auth-toggle-btn ${isSignUp ? 'active' : ''}`}
              onClick={() => setIsSignUp(true)}
            >
              Sign Up
            </button>
          </div>

          {error && <div style={{ color: '#ef4444', marginBottom: '1rem', fontSize: '0.9rem', textAlign: 'center' }}>{error}</div>}

          <form className="auth-form" onSubmit={handleSubmit}>
            {isSignUp && (
              <div className="auth-input-group">
                <label>Full Name</label>
                <input
                  type="text"
                  className="auth-input"
                  placeholder="e.g. Dr. Rajesh Thakur"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            )}

            <div className="auth-input-group">
              <label>Email Address</label>
              <input
                type="email"
                className="auth-input"
                placeholder="name@healthconnect.gov.in"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="auth-input-group">
              <label>Password</label>
              <input
                type="password"
                className="auth-input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            {isSignUp && (
              <>
                <div className="auth-input-group">
                  <label>Role</label>
                  <select
                    className="auth-select"
                    value={role}
                    onChange={(e) => setRole(e.target.value)}
                  >
                    <optgroup label="Facility Leadership">
                      <option value="Facility_Head">Facility Head</option>
                      <option value="Facility_Supervisor">Facility Supervisor</option>
                    </optgroup>
                    <optgroup label="Clinical Staff">
                      <option value="Doctor">Doctor</option>
                      <option value="Staff_Nurse">Staff Nurse</option>
                    </optgroup>
                    <optgroup label="Community Health">
                      <option value="ASHA_Worker">ASHA Worker</option>
                      <option value="ANM">ANM (Auxiliary Nurse Midwife)</option>
                    </optgroup>
                    <optgroup label="Front Desk & Admin Support">
                      <option value="Registration_Clerk">Registration Clerk</option>
                      <option value="Facility_Staff">Facility Staff</option>
                      <option value="Data_Entry_Clerk">Data Entry Clerk</option>
                    </optgroup>
                    <optgroup label="Inventory">
                      <option value="Pharmacist">Pharmacist</option>
                      <option value="Store_Keeper">Store Keeper</option>
                    </optgroup>
                    <optgroup label="Administration">
                      <option value="Block_Officer">Block Officer</option>
                      <option value="District_Officer">District Officer</option>
                      <option value="State_Admin">State Admin</option>
                      <option value="Auditor">Auditor</option>
                    </optgroup>
                  </select>
                </div>

                <div className="auth-input-group">
                  <label>Facility Code / ID</label>
                  <input
                    type="text"
                    className="auth-input"
                    placeholder="e.g. 59526000000027011"
                    value={facilityId}
                    onChange={(e) => setFacilityId(e.target.value)}
                    required
                  />
                </div>
              </>
            )}

            <button type="submit" className="auth-submit-btn" disabled={loading}>
              {loading ? 'Processing...' : (isSignUp ? 'Create Account' : 'Sign In')}
            </button>
          </form>

        </div>
      </div>
    </div>
  );
}