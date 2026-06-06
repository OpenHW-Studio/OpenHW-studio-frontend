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
      console.log("[AuthSuccess] Starting auth handler");
      try {
        // Extract token from URL hash (e.g. #token=XYZ)
        const hash = location.hash;
        console.log("[AuthSuccess] Location hash:", hash ? "present" : "missing");
        if (!hash) throw new Error("No token found in URL");

        const params = new URLSearchParams(hash.substring(1));
        const token = params.get("token");

        if (!token) throw new Error("Invalid token format");
        console.log("[AuthSuccess] Token extracted successfully");

        // Save token immediately so fetchProfile can use it
        saveToken(token);
        console.log("[AuthSuccess] Token saved to localStorage");

        // Fetch user profile from backend
        console.log("[AuthSuccess] Fetching user profile...");
        const data = await fetchProfile();
        console.log("[AuthSuccess] Profile fetch response:", data);
        
        if (data && data.user) {
          // Check if there was a saved redirect destination
          const redirectPath = localStorage.getItem("authRedirectPath") || "/user/dashboard";
          // Delay removal so StrictMode's second execution can still read it
          setTimeout(() => localStorage.removeItem("authRedirectPath"), 1000);
          console.log("[AuthSuccess] Redirect path set to:", redirectPath);
          
          const isAdminPortal = redirectPath.startsWith("/admin");
          
          if (isAdminPortal) {
            saveAdminUser(data.user);
          } else {
            saveUser(data.user);
          }
          
          login(token, data.user, isAdminPortal);
          localStorage.setItem("lastUsedLogin", "google");
          console.log("[AuthSuccess] Login successful, navigating to dashboard");
          
          navigate(redirectPath, { replace: true });
        } else {
          throw new Error("Failed to fetch user profile: No user data in response");
        }
      } catch (err) {
        console.error("[AuthSuccess] OAuth Success Handling Error:", err);
        console.error("[AuthSuccess] Error Message:", err.message);
        navigate("/user/login", { replace: true, state: { error: `Google authentication failed: ${err.message}` } });
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
