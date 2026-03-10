import { Navigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore.js';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRole }) {
    const { isAuthenticated, loading, role, isAdminAuthenticated, adminRole } = useAuth();


    if (loading) {
        return <div>Loading...</div>; // Prevent redirecting while auth state is resolving
    }

    if (!isAuthenticated) {
        return <Navigate to="/signin" replace />;
    }

    if (allowedRole === 'admin') {
        if (!isAdminAuthenticated) {
            return <Navigate to="/admin/login" replace />;
        }
        return children;
    }

    // If route requires a specific role and it doesn't match
    if (allowedRole && role !== allowedRole) {
        // Direct users to their appropriate dashboard based on their actual role
        return <Navigate to={`/${role || 'student'}/dashboard`} replace />;
    }

    return children;
}