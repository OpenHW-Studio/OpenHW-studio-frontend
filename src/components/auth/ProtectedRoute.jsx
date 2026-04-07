import { Navigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';

export default function ProtectedRoute({ children, allowedRole, loginRoute }) {
    const { isAuthenticated, loading, role, isAdminAuthenticated, adminRole } = useAuth();


    if (loading) {
        return <div>Loading...</div>; // Prevent redirecting while auth state is resolving
    }

    // 1. Admin Logic: If the route requires an admin, we check the admin authentication first.
    // This needs to be prioritized because admins have a separate authentication session.
    if (allowedRole === 'admin') {
        if (!isAdminAuthenticated) {
            return <Navigate to="/admin/login" replace />;
        }
        return children;
    }

    // 2. Regular User logic: If the user is unauthenticated, redirect them to the appropriate login page.
    if (!isAuthenticated) {
        // The new general user flow uses /login, while students/teachers use /classroom/signin
        const defaultLogin = allowedRole === 'user' ? '/login' : '/classroom/signin';

        // Use custom loginRoute if provided by the component (for flexibility), otherwise use the role-based default.
        return <Navigate to={loginRoute || defaultLogin} replace />;
    }

    // 3. Authorization check: If the user is authenticated, ensure they have the required role.
    // Allow any registered user (student, teacher, user) to access the 'user' routes
    const isUserRoute = allowedRole === 'user';
    const hasAccess = isUserRoute ? ['student', 'teacher', 'user'].includes(role) : role === allowedRole;

    if (allowedRole && !hasAccess) {
        // Direct users to their appropriate dashboard if they land on a route they don't have access to
        return <Navigate to={`/${role || 'student'}/dashboard`} replace />;
    }

    return children;
}