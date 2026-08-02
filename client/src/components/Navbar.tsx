import { NavLink, useNavigate } from 'react-router-dom';
import { useAppSelector, useAppDispatch } from '../store/hooks';
import { logout } from '../store/authSlice';
import {
  LayoutDashboard, Building2, FileText, Package,
  MessageSquare, LogOut, Menu, X, Heart, Sun, Moon, Settings, Users
} from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { useState } from 'react';
import {
  hasFullNetworkView as checkFullNetworkView, canSeeReportsNav, canSeeInventoryNav,
  canSeeFeedbackNav, canSeePatientsNav, canSeeAdminNav,
} from '../utils/permissions';

export default function Navbar() {
  const { user } = useAppSelector(s => s.auth);
  const dispatch = useAppDispatch();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = () => {
    dispatch(logout());
    navigate('/login');
  };

  const role = user?.role;

  // Page-visibility role lists live in utils/permissions.ts (single source of truth,
  // shared with any other place that needs the same role-gating decision).
  const links = [
    { to: '/', icon: <LayoutDashboard size={20} />, label: 'Dashboard' },
    ...(checkFullNetworkView(role) ? [{ to: '/facilities', icon: <Building2 size={20} />, label: 'Facilities' }] : []),
    ...(canSeeReportsNav(role) ? [{ to: '/reports', icon: <FileText size={20} />, label: 'Reports' }] : []),
    ...(canSeePatientsNav(role) ? [{ to: '/patients', icon: <Users size={20} />, label: 'Patients' }] : []),
    ...(canSeeInventoryNav(role) ? [{ to: '/inventory', icon: <Package size={20} />, label: 'Inventory' }] : []),
    ...(canSeeFeedbackNav(role) ? [{ to: '/feedback', icon: <MessageSquare size={20} />, label: 'Feedback' }] : []),
    ...(canSeeAdminNav(role) ? [{ to: '/admin', icon: <Settings size={20} />, label: 'Admin' }] : []),
  ];

  return (
    <>
      <nav className="navbar">
        <div className="navbar-brand">
          <Heart size={24} className="brand-icon" />
          <span className="brand-text">HealthConnect<span className="brand-pro">Pro</span></span>
        </div>

        <button className="mobile-toggle" onClick={() => setMobileOpen(!mobileOpen)}>
          {mobileOpen ? <X size={24} /> : <Menu size={24} />}
        </button>

        <div className={`navbar-links ${mobileOpen ? 'open' : ''}`}>
          {links.map(link => (
            <NavLink
              key={link.to}
              to={link.to}
              end={link.to === '/'}
              className={({ isActive }) => `nav-link ${isActive ? 'active' : ''}`}
              onClick={() => setMobileOpen(false)}
            >
              {link.icon}
              <span>{link.label}</span>
            </NavLink>
          ))}
        </div>

        <div className="navbar-user">
          {user && (
            <div className="user-info">
              <div className="user-avatar">
                {user.name?.charAt(0)?.toUpperCase() || 'U'}
              </div>
              <div className="user-details">
                <span className="user-name">{user.name}</span>
                <span className="user-role">{user.role?.replace(/_/g, ' ')}</span>
              </div>
            </div>
          )}
          <button className="theme-toggle-btn" onClick={toggleTheme} title="Toggle Theme" style={{ background: 'none', border: 'none', color: 'var(--color-text-secondary)', cursor: 'pointer', marginRight: '0.5rem', display: 'flex', alignItems: 'center' }}>
            {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
          </button>
          <button className="logout-btn" onClick={handleLogout} title="Logout">
            <LogOut size={18} />
          </button>
        </div>
      </nav>

      {mobileOpen && <div className="navbar-overlay" onClick={() => setMobileOpen(false)} />}
    </>
  );
}
