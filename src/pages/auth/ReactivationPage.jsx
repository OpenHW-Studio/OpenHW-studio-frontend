/**
 * ReactivationPage
 *
 * Multi-step OTP-verified account reactivation page.
 * Shown when a user with status=pending_deletion logs in within the 30-day grace period.
 *
 * Flow:
 *   Step 1 — Notice of scheduled deletion & button to send reactivation OTP.
 *   Step 2 — OTP verification (6-digit code with resend timer).
 *   Step 3 — Success screen (Account restored, redirecting to dashboard).
 */

import { useState, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext.jsx";
import { requestReactivationOtp, cancelDeletion, getToken } from "../../services/authService.js";
import { ShieldCheck, AlertTriangle, KeyRound } from "lucide-react";

export default function ReactivationPage() {
  const navigate = useNavigate();
  const { user, login, logout } = useAuth();
  const [step, setStep] = useState(1); // 1 = prompt, 2 = otp, 3 = success
  const [otpValue, setOtpValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const deletionDate = user?.permanentDeleteAt
    ? new Date(user.permanentDeleteAt).toLocaleDateString("en-GB", {
        day: "numeric", month: "long", year: "numeric",
      })
    : "within 30 days";

  const startCooldown = (secs) => {
    setResendCooldown(secs);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) {
          clearInterval(cooldownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setError("");
    try {
      await requestReactivationOtp(getToken());
      setStep(2);
      startCooldown(60);
    } catch (err) {
      setError(err.message || "Failed to send reactivation code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirmReactivate = async (e) => {
    e.preventDefault();
    if (otpValue.trim().length !== 6) {
      setError("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await cancelDeletion(getToken(), otpValue.trim());
      // Update auth context with the reactivated user
      login(getToken(), data.user);
      setStep(3);
      clearInterval(cooldownRef.current);
      // Redirect to appropriate dashboard after 2 seconds
      setTimeout(() => {
        const role = data.user?.role;
        if (role === "teacher") navigate("/teacher/dashboard");
        else if (role === "student") navigate("/student/dashboard");
        else navigate("/user/dashboard");
      }, 2000);
    } catch (err) {
      setError(err.message || "Failed to reactivate account. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtpValue(v);
    setError("");
  };

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  // ── Step 3: Success Screen ─────────────────────────────────────────────────
  if (step === 3) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', sans-serif", padding: "16px",
      }}>
        <div style={{ textAlign: "center", maxWidth: "420px" }}>
          <div style={{
            width: "64px", height: "64px", borderRadius: "50%",
            background: "linear-gradient(135deg,#059669,#065f46)",
            display: "flex", alignItems: "center", justifyContent: "center",
            margin: "0 auto 20px",
          }}>
            <ShieldCheck style={{ color: "#fff", width: "32px", height: "32px" }} />
          </div>
          <h1 style={{ color: "#f1f5f9", fontSize: "24px", fontWeight: 700, margin: "0 0 12px", fontFamily: "monospace" }}>
            WELCOME BACK!
          </h1>
          <p style={{ color: "#94a3b8", fontSize: "15px", lineHeight: 1.7, margin: 0 }}>
            Your account has been reactivated. All your simulation projects, badges, and progress are safe.
            <br />Redirecting to your dashboard...
          </p>
        </div>
      </div>
    );
  }

  // ── Step 2: OTP Verification ───────────────────────────────────────────────
  if (step === 2) {
    return (
      <div style={{
        minHeight: "100vh", background: "#0f172a",
        display: "flex", alignItems: "center", justifyContent: "center",
        fontFamily: "'Segoe UI', sans-serif", padding: "16px",
      }}>
        <div style={{
          background: "#1e293b", border: "1px solid #334155",
          borderRadius: "16px", padding: "40px 36px",
          maxWidth: "460px", width: "100%",
          boxShadow: "0 25px 60px rgba(0,0,0,0.6)",
        }}>
          <div style={{ textAlign: "center", marginBottom: "28px" }}>
            <div style={{
              width: "56px", height: "56px", borderRadius: "50%",
              background: "linear-gradient(135deg,#059669,#065f46)",
              display: "flex", alignItems: "center", justifyContent: "center",
              margin: "0 auto 16px",
            }}>
              <KeyRound style={{ color: "#fff", width: "28px", height: "28px" }} />
            </div>
            <h2 style={{ color: "#f1f5f9", fontSize: "20px", fontWeight: 700, margin: "0 0 8px", fontFamily: "monospace" }}>
              ENTER REACTIVATION CODE
            </h2>
            <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0, lineHeight: 1.6 }}>
              A 6-digit confirmation code was sent to<br />
              <strong style={{ color: "#38bdf8" }}>{user?.email || "your registered email"}</strong>
            </p>
            <p style={{ color: "#64748b", fontSize: "12px", margin: "8px 0 0", lineHeight: 1.4 }}>
              Sent from <span style={{ color: "#94a3b8" }}>openhwservice@gmail.com</span><br />
              <span style={{ fontSize: "11px" }}>(Check your Spam / Junk folder if not in inbox)</span>
            </p>
          </div>

          <form onSubmit={handleConfirmReactivate}>
            <div style={{ marginBottom: "20px" }}>
              <label style={{ display: "block", fontSize: "11px", color: "#64748b", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
                [REACTIVATION_CODE // 6 DIGITS]
              </label>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={otpValue}
                onChange={handleOtpInput}
                placeholder="• • • • • •"
                autoFocus
                style={{
                  width: "100%", boxSizing: "border-box",
                  background: "#0f172a", border: "1px solid #065f46",
                  borderRadius: "8px", padding: "14px 16px",
                  color: "#34d399", fontSize: "28px", fontFamily: "monospace",
                  letterSpacing: "16px", textAlign: "center", outline: "none",
                }}
              />
            </div>

            {error && (
              <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "14px", textAlign: "center" }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading || otpValue.length !== 6}
              style={{
                width: "100%", padding: "14px",
                background: loading || otpValue.length !== 6 ? "#334155" : "linear-gradient(135deg,#059669,#065f46)",
                border: "1px solid #065f46", borderRadius: "8px",
                color: loading || otpValue.length !== 6 ? "#94a3b8" : "#fff",
                fontWeight: 700, fontSize: "14px",
                fontFamily: "monospace", cursor: loading || otpValue.length !== 6 ? "not-allowed" : "pointer",
                marginBottom: "16px", transition: "all 0.2s",
              }}
            >
              {loading ? "Verifying..." : "Verify & Reactivate Account"}
            </button>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <button
                type="button"
                onClick={() => { setStep(1); setOtpValue(""); setError(""); }}
                style={{ background: "none", border: "none", color: "#64748b", fontSize: "13px", cursor: "pointer" }}
              >
                ← Back
              </button>
              <button
                type="button"
                onClick={async () => {
                  setLoading(true);
                  try {
                    await requestReactivationOtp(getToken());
                    startCooldown(60);
                  } catch (err) {
                    setError(err.message);
                  } finally {
                    setLoading(false);
                  }
                }}
                disabled={resendCooldown > 0 || loading}
                style={{
                  background: "none", border: "none",
                  color: resendCooldown > 0 ? "#475569" : "#38bdf8",
                  fontSize: "13px", cursor: resendCooldown > 0 ? "default" : "pointer",
                }}
              >
                {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }

  // ── Step 1: Initial Prompt ─────────────────────────────────────────────────
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

        {/* Send Reactivation OTP button */}
        <button
          onClick={handleSendOtp}
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
          {loading ? "Sending Code..." : "Send Reactivation Code"}
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
