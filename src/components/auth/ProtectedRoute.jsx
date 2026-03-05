import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function ProtectedRoute({ children, allowedRole }) {
    const { isAuthenticated, loading, role, isAdminAuthenticated, adminRole } = useAuth();

    if (loading) {
        return <div>Loading...</div>;
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

    // Checking if route requires a specific role and it doesn't match
    if (allowedRole && role !== allowedRole) {
        return <Navigate to={`/${role}/dashboard`} replace />;
    }

    return children;
}
