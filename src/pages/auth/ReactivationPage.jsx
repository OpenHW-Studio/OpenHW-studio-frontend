/**
 * ReactivationPage
 *
 * Shown when a user with status=pending_deletion logs in within the 30-day grace period.
 * They can cancel the deletion and reactivate their account.
 */

import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { cancelDeletion, getToken } from "../../services/authService.js";
import { ShieldCheck, Trash2, AlertTriangle } from "lucide-react";

export default function ReactivationPage() {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [cancelled, setCancelled] = useState(false);

  const deletionDate = user?.permanentDeleteAt
    ? new Date(user.permanentDeleteAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "within 30 days";

  const handleReactivate = async () => {
    setLoading(true);
    setError("");
    try {
      const data = await cancelDeletion(getToken());
      // Update auth context with the reactivated user
      login(getToken(), data.user);
      setCancelled(true);
      // Redirect to appropriate dashboard after 2 seconds
      setTimeout(() => {
        const role = data.user?.role;
        if (role === "teacher") navigate("/teacher/dashboard");
        else if (role === "student") navigate("/student/dashboard");
        else navigate("/user/dashboard");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to cancel deletion. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  if (cancelled) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', sans-serif", padding: "16px",
      }}>
        <div style={{ textAlign: "center", maxWidth: "400px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "linear-gradient(135deg,#0ea5e9,#6366f1)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <ShieldCheck style={{ color: "#fff", width: "32px", height: "32px" }} />
          </div>
          <h1 style={{ color: "#f1f5f9", fontSize: "24px", fontWeight: 700, margin: "0 0 12px", fontFamily: "monospace" }}>
            WELCOME BACK!
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: 1.7, margin: 0 }}>
            Your account has been reactivated. All your data is safe.
            <br />Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      minHeight: "100vh", background: "#0f172a",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "'Segoe UI', sans-serif", padding: "16px",
    }}>
      <div style={{
        background: "#1e293b", border: "1px solid #334155",
        borderRadius: "16px", padding: "48px 40px",
        maxWidth: "520px", width: "100%",
        boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
      }}>
        {/* Icon */}
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "#0f172a", border: "2px solid #f59e0b",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 16px",
          }}>
            <AlertTriangle style={{ color: "#f59e0b", width: "30px", height: "30px" }} />
          </div>
          <h1 style={{ color: "#f1f5f9", fontSize: "22px", fontWeight: 700, margin: "0 0 8px", fontFamily: "monospace" }}>
            ACCOUNT SCHEDULED FOR DELETION
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0, lineHeight: 1.6 }}>
            {user?.email || "Your account"} is scheduled to be
            permanently deleted on <strong style={{ color: "#f87171" }}>{deletionDate}</strong>.
          </p>
        </div>

        {/* Info box */}
        <div style={{
          background: "#0f172a", border: "1px solid #f59e0b",
          borderRadius: "10px", padding: "18px 20px", marginBottom: "28px",
        }}>
          <p style={{ color: "#fcd34d", fontSize: "14px", margin: "0 0 10px", fontWeight: 600 }}>
            What happens if deleted:
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#94a3b8", fontSize: "13px", lineHeight: 1.8 }}>
            <li>All personal data (name, email, password) will be permanently wiped</li>
            <li>All personal simulator projects will be deleted</li>
            <li>All gamification progress (XP, badges, coins) will be deleted</li>
            <li>Academic records will be anonymized but preserved</li>
          </ul>
        </div>

        {error && (
          <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "16px", textAlign: "center" }}>
            {error}
          </div>
        )}

        {/* Reactivate button */}
        <button
          onClick={handleReactivate}
          disabled={loading}
          style={{
            width: "100%", padding: "14px",
            background: loading ? "#1e293b" : "linear-gradient(135deg,#059669,#065f46)",
            border: "1px solid #065f46", borderRadius: "8px",
            color: "#f1f5f9", fontWeight: 700, fontSize: "15px",
            fontFamily: "monospace", cursor: loading ? "not-allowed" : "pointer",
            marginBottom: "12px", transition: "all 0.2s",
          }}
        >
          {loading ? "Reactivating..." : "Yes, Reactivate My Account"}
        </button>

        {/* Keep deletion button */}
        <button
          onClick={handleLogout}
          style={{
            width: "100%", padding: "13px",
            background: "none", border: "1px solid #334155",
            borderRadius: "8px", color: "#64748b",
            fontWeight: 600, fontSize: "13px",
            fontFamily: "monospace", cursor: "pointer",
          }}
        >
          No, proceed with deletion - Log out
        </button>

        <p style={{ color: "#475569", fontSize: "12px", textAlign: "center", margin: "16px 0 0", lineHeight: 1.5 }}>
          You can return anytime before <strong>{deletionDate}</strong> to reactivate.
        </p>
      </div>
    </div>
  );
}
