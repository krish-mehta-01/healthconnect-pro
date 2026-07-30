import { Navigate } from 'react-router-dom';
import { useAppSelector } from '../store/hooks';

interface Props {
  children: React.ReactNode;
  requiredRoles?: string[];
}

export default function ProtectedRoute({ children, requiredRoles }: Props) {
  const { isAuthenticated, user } = useAppSelector(s => s.auth);

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRoles && user && !requiredRoles.includes(user.role)) {
    return (
      <div className="access-denied">
        <h2>Access Denied</h2>
        <p>You don't have permission to view this page.</p>
      </div>
    );
  }

  return <>{children}</>;
}
