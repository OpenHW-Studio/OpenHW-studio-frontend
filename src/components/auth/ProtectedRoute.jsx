import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRole }) {
    const { isAuthenticated, loading, role, isAdminAuthenticated, adminRole } = useAuth();


    if (loading) {
        return <div>Loading...</div>; // Prevent redirecting while auth state is resolving
    }

    if (!isAuthenticated) {
        return <Navigate to="/classroom/signin" replace />;
    }

    if (allowedRole === 'admin') {
        if (!isAdminAuthenticated) {
            return <Navigate to="/admin/login" replace />;
        }
        return children;
    }

    // Allow any registered user (student, teacher, user) to access the 'user' routes
    const isUserRoute = allowedRole === 'user';
    const hasAccess = isUserRoute ? ['student', 'teacher', 'user'].includes(role) : role === allowedRole;

    if (allowedRole && !hasAccess) {
        // Direct users to their appropriate dashboard based on their actual role
        return <Navigate to={`/${role || 'student'}/dashboard`} replace />;
    }

    return children;
}