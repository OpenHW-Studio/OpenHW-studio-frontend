import { useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { fetchProfile, saveToken, saveUser, saveAdminUser } from "../../services/authService.js";

export default function AuthSuccess() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login } = useAuth();

  useEffect(() => {
    const handleAuth = async () => {
      try {
        // Extract token from URL hash (e.g. #token=XYZ)
        const hash = location.hash;
        if (!hash) throw new Error("No token found in URL");

        const params = new URLSearchParams(hash.substring(1));
        const token = params.get("token");

        if (!token) throw new Error("Invalid token format");

        // Save token immediately so fetchProfile can use it
        saveToken(token);

        // Fetch user profile from backend
        const data = await fetchProfile();

        let defaultRedirect = "/user/dashboard";
        if (data.user?.role === "student") {
          defaultRedirect = "/student/dashboard";
        } else if (data.user?.role === "teacher") {
          defaultRedirect = "/teacher/dashboard";
        }
        
        if (data && data.user) {
          if (data.user.status === 'pending_deletion') {
            login(token, data.user, false);
            navigate('/reactivate', { replace: true });
            return;
          }

          // Check if there was a saved redirect destination
          const redirectPath = localStorage.getItem("authRedirectPath") || defaultRedirect;
          // Delay removal so StrictMode's second execution can still read it
          setTimeout(() => localStorage.removeItem("authRedirectPath"), 1000);
          
          const isAdminPortal = redirectPath.startsWith("/admin");
          
          if (isAdminPortal) {
            saveAdminUser(data.user);
          } else {
            saveUser(data.user);
          }
          
          login(token, data.user, isAdminPortal);
          localStorage.setItem("lastUsedLogin", "google");
          
          navigate(redirectPath, { replace: true });
        } else {
          throw new Error("Failed to fetch user profile");
        }
      } catch (err) {
        console.error("OAuth Success Handling Error:", err);
        navigate("/user/login", { replace: true, state: { error: "Google authentication failed. Please try again." } });
      }
    };

    handleAuth();
  }, [location, navigate, login]);

  return (
    <div className="flex items-center justify-center h-screen bg-slate-900 text-white">
      <div className="flex flex-col items-center gap-4">
        <div className="w-8 h-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></div>
        <p className="text-lg font-medium animate-pulse">Completing sign in...</p>
      </div>
    </div>
  );
}
