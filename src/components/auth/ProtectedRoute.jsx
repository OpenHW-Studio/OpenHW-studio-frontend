import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';

export default function ProtectedRoute({ children, allowedRole }) {
    const { isAuthenticated, loading, role, isAdminAuthenticated, adminRole } = useAuth();


    if (!isAuthenticated) {
        return <Navigate to="/signin" replace />;
    }

    if (allowedRole === 'admin') {
        if (!isAdminAuthenticated) {
            return <Navigate to="/admin/login" replace />;
        }
        return children;
    }

    if (!isAuthenticated) {
        return <Navigate to="/login" replace />;
    }

    // Ensures students can't access teacher routes and vice-versa
    if (allowedRole && role !== allowedRole) {
        return <Navigate to={role === 'teacher' ? '/teacher/dashboard' : '/student/dashboard'} replace />;
    }

    // Checking if route requires a specific role and it doesn't match
    if (allowedRole && role !== allowedRole) {
        return <Navigate to={`/${role}/dashboard`} replace />;
    }

    return children;
}