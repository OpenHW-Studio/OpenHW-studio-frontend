import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

export default function ProtectedRoute({ children, allowedRole }) {
  
    const { isAuthenticated, role } = useAuthStore();

  
    if (!isAuthenticated) {
        return <Navigate to="/signin" replace />;
    }

    // Ensures students can't access teacher routes and vice-versa
    if (allowedRole && role !== allowedRole) {
        return <Navigate to={role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />;
    }

    return children;
}