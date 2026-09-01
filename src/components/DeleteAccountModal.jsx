/**
 * DeleteAccountModal
 *
 * Multi-step modal for account deletion:
 *   Step 1 — Role-based disclosure & acknowledgement checkbox
 *   Step 2 — OTP verification
 *   Step 3 — Success (account deactivated, will redirect)
 */

import { useState, useRef } from "react";
import { ShieldAlert, Mail, Trash2, X } from "lucide-react";
import { requestDeletionOtp, confirmDeletion } from "../services/authService";
import { getToken } from "../services/authService";

// ── Role-specific disclosure text ────────────────────────────────────────────
const DISCLOSURES = {
  user: {
    title: "General Account Deletion",
    deleted: [
      "Your name, email address, and profile picture",
      "Your password and all login credentials",
      "All personal circuit simulation projects",
      "Your gamification progress (XP, coins, levels, badges, streaks)",
      "Your account settings and bio",
    ],
    retained: [
      "Anonymized aggregate usage statistics may be retained to improve OpenHW Studio. No personal identity is linked.",
    ],
  },
  student: {
    title: "Student Account Deletion",
    deleted: [
      "Your name, email address, and profile picture",
      "Your password and all login credentials",
      "Your personal simulator projects (saved outside classrooms)",
      "Your gamification progress (XP, coins, levels, badges, streaks)",
      "Your classroom enrollments (you will be removed from all classes)",
    ],
    retained: [
      "Graded classroom submissions — your grade and submitted code will remain in your teacher's gradebook, but your name will be replaced with [Deleted Student] and your email will be permanently removed. This preserves academic records without identifying you.",
    ],
    warning:
      "After deletion, your teacher cannot re-grade or update any of your past submissions. This is final after 30 days.",
  },
  teacher: {
    title: "Instructor Account Deletion",
    deleted: [
      "Your name, email address, and profile picture",
      "Your password and all login credentials",
      "Your personal simulator projects",
      "Your gamification progress (XP, coins, levels, badges)",
    ],
    retained: [
      "All classes you created will remain accessible to enrolled students. The teacher name will be shown as [Deleted Instructor].",
      "All assignments, graded submissions, and notices inside your classes will be preserved so students can access their marks and feedback.",
    ],
    warning:
      "CRITICAL: After your account is deleted, no one can manage your classes. Please transfer class ownership to another instructor or contact an administrator BEFORE deleting your account.",
  },
};

// ── Style helpers ─────────────────────────────────────────────────────────────
const overlay = {
  position: "fixed", inset: 0, zIndex: 99999,
  background: "rgba(0,0,0,0.85)", backdropFilter: "blur(10px)",
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: "16px",
};
const card = {
  background: "#0f172a", border: "1px solid #7f1d1d",
  borderRadius: "16px", padding: "36px",
  maxWidth: "520px", width: "100%",
  boxShadow: "0 25px 60px rgba(0,0,0,0.7)",
  maxHeight: "90vh", overflowY: "auto",
};
const btnRed = (disabled) => ({
  width: "100%", padding: "13px",
  background: disabled ? "#1e293b" : "linear-gradient(135deg,#b91c1c,#7f1d1d)",
  border: "1px solid #7f1d1d", borderRadius: "8px",
  color: disabled ? "#64748b" : "#fff", fontWeight: 700, fontSize: "14px",
  fontFamily: "monospace", cursor: disabled ? "not-allowed" : "pointer",
  marginBottom: "10px", transition: "all 0.2s",
});
const btnGhost = {
  background: "none", border: "none", color: "#64748b",
  fontSize: "12px", fontFamily: "monospace", cursor: "pointer", padding: 0,
};

// ─────────────────────────────────────────────────────────────────────────────

export default function DeleteAccountModal({ userRole = "user", userEmail = "", onClose, onDeleted }) {
  const [step, setStep] = useState(1); // 1 = disclosure, 2 = otp, 3 = success
  const [agreed, setAgreed] = useState(false);
  const [otpValue, setOtpValue] = useState("");
  const [otpError, setOtpError] = useState("");
  const [loading, setLoading] = useState(false);
  const [successDate, setSuccessDate] = useState("");
  const [resendCooldown, setResendCooldown] = useState(0);
  const cooldownRef = useRef(null);

  const disclosure = DISCLOSURES[userRole] || DISCLOSURES.user;

  const startCooldown = (secs) => {
    setResendCooldown(secs);
    clearInterval(cooldownRef.current);
    cooldownRef.current = setInterval(() => {
      setResendCooldown((prev) => {
        if (prev <= 1) { clearInterval(cooldownRef.current); return 0; }
        return prev - 1;
      });
    }, 1000);
  };

  const handleSendOtp = async () => {
    setLoading(true);
    setOtpError("");
    try {
      await requestDeletionOtp(getToken());
      setStep(2);
      startCooldown(60);
    } catch (err) {
      setOtpError(err.message || "Failed to send code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleConfirm = async (e) => {
    e.preventDefault();
    if (otpValue.trim().length !== 6) {
      setOtpError("Please enter the full 6-digit code.");
      return;
    }
    setLoading(true);
    setOtpError("");
    try {
      const data = await confirmDeletion(getToken(), otpValue.trim());
      // Format the date nicely
      const dateStr = data.permanentDeleteAt
        ? new Date(data.permanentDeleteAt).toLocaleDateString("en-GB", {
            day: "numeric", month: "long", year: "numeric",
          })
        : "30 days from now";
      setSuccessDate(dateStr);
      setStep(3);
      clearInterval(cooldownRef.current);
      // Notify parent after 4 seconds
      setTimeout(() => onDeleted?.(), 4000);
    } catch (err) {
      setOtpError(err.message || "Incorrect code. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleOtpInput = (e) => {
    const v = e.target.value.replace(/\D/g, "").slice(0, 6);
    setOtpValue(v);
    setOtpError("");
  };

  // ── Step 1: Disclosure ─────────────────────────────────────────────────────
  if (step === 1) return (
    <div style={overlay}>
      <div style={card}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "20px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <ShieldAlert style={{ color: "#ef4444", width: "28px", height: "28px", flexShrink: 0 }} />
            <div>
              <h2 style={{ color: "#f1f5f9", fontSize: "18px", fontWeight: 700, margin: 0, fontFamily: "monospace" }}>
                DELETE ACCOUNT
              </h2>
              <p style={{ color: "#94a3b8", fontSize: "12px", margin: "2px 0 0" }}>{disclosure.title}</p>
            </div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}>
            <X style={{ width: "20px", height: "20px" }} />
          </button>
        </div>

        {/* What will be DELETED */}
        <div style={{ marginBottom: "16px" }}>
          <p style={{ color: "#f87171", fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
            Permanently Deleted After 30 Days
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#94a3b8", fontSize: "13px", lineHeight: 1.7 }}>
            {disclosure.deleted.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>

        {/* What will be RETAINED */}
        <div style={{ background: "#0d2231", border: "1px solid #1e40af", borderRadius: "8px", padding: "14px 16px", marginBottom: "16px" }}>
          <p style={{ color: "#60a5fa", fontSize: "11px", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", margin: "0 0 8px" }}>
            Retained (Anonymized)
          </p>
          <ul style={{ margin: 0, padding: "0 0 0 18px", color: "#94a3b8", fontSize: "13px", lineHeight: 1.7 }}>
            {disclosure.retained.map((item, i) => <li key={i}>{item}</li>)}
          </ul>
        </div>

        {/* Role-specific warning */}
        {disclosure.warning && (
          <div style={{ background: "#1c0a0a", border: "1px solid #7f1d1d", borderRadius: "8px", padding: "12px 16px", marginBottom: "16px" }}>
            <p style={{ color: "#fca5a5", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>{disclosure.warning}</p>
          </div>
        )}

        {/* Grace period info */}
        <div style={{ background: "#111827", border: "1px solid #334155", borderRadius: "8px", padding: "12px 16px", marginBottom: "20px" }}>
          <p style={{ color: "#94a3b8", fontSize: "13px", margin: 0, lineHeight: 1.6 }}>
            Your account will be <strong style={{ color: "#f1f5f9" }}>deactivated immediately</strong> and
            permanently wiped after <strong style={{ color: "#f1f5f9" }}>30 days</strong>.
            You can <strong style={{ color: "#34d399" }}>cancel anytime within 30 days</strong> by logging back in.
          </p>
        </div>

        {/* Acknowledgement checkbox */}
        <label style={{ display: "flex", alignItems: "flex-start", gap: "10px", cursor: "pointer", marginBottom: "20px" }}>
          <input
            type="checkbox"
            checked={agreed}
            onChange={(e) => setAgreed(e.target.checked)}
            style={{ width: "16px", height: "16px", marginTop: "2px", flexShrink: 0, accentColor: "#ef4444" }}
          />
          <span style={{ color: "#cbd5e1", fontSize: "13px", lineHeight: 1.5 }}>
            I have read and understand what will be deleted and what will be retained. I wish to permanently delete my account.
          </span>
        </label>

        <button
          onClick={handleSendOtp}
          disabled={!agreed || loading}
          style={btnRed(!agreed || loading)}
        >
          {loading ? "Sending code..." : "Send Verification Code"}
        </button>
        <button onClick={onClose} style={{ ...btnGhost, display: "block", margin: "0 auto", fontSize: "13px" }}>
          Cancel - Keep My Account
        </button>
      </div>
    </div>
  );

  // ── Step 2: OTP Verification ───────────────────────────────────────────────
  if (step === 2) return (
    <div style={overlay}>
      <div style={{ ...card, maxWidth: "440px" }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "56px", height: "56px", borderRadius: "50%",
            background: "linear-gradient(135deg,#b91c1c,#7f1d1d)",
            display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px",
          }}>
            <Trash2 style={{ color: "#fff", width: "28px", height: "28px" }} />
          </div>
          <h2 style={{ color: "#f1f5f9", fontSize: "20px", fontWeight: 700, margin: "0 0 8px", fontFamily: "monospace" }}>
            CONFIRM DELETION
          </h2>
          <p style={{ color: "#94a3b8", fontSize: "14px", margin: 0, lineHeight: 1.6 }}>
            A 6-digit confirmation code was sent to<br />
            <strong style={{ color: "#38bdf8" }}>{userEmail}</strong>
          </p>
          <p style={{ color: "#64748b", fontSize: "12px", margin: "8px 0 0", lineHeight: 1.4 }}>
            Sent from <span style={{ color: "#94a3b8" }}>openhwservice@gmail.com</span><br />
            <span style={{ fontSize: "11px" }}>(Check your Spam / Junk folder if not in inbox)</span>
          </p>
        </div>

        <form onSubmit={handleConfirm}>
          <div style={{ marginBottom: "20px" }}>
            <label style={{ display: "block", fontSize: "11px", color: "#64748b", fontFamily: "monospace", letterSpacing: "2px", textTransform: "uppercase", marginBottom: "8px" }}>
              [CONFIRM_CODE // 6 DIGITS]
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
                background: "#1e293b", border: "1px solid #7f1d1d",
                borderRadius: "8px", padding: "14px 16px",
                color: "#f87171", fontSize: "28px", fontFamily: "monospace",
                letterSpacing: "16px", textAlign: "center", outline: "none",
              }}
            />
          </div>

          {otpError && <div style={{ color: "#f87171", fontSize: "13px", marginBottom: "12px", textAlign: "center" }}>{otpError}</div>}

          <button
            type="submit"
            disabled={loading || otpValue.length !== 6}
            style={btnRed(loading || otpValue.length !== 6)}
          >
            {loading ? "Verifying..." : "Confirm Permanent Deletion"}
          </button>

          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <button type="button" onClick={() => { setStep(1); setOtpValue(""); setOtpError(""); }} style={btnGhost}>
              ← Back
            </button>
            <button
              type="button"
              onClick={async () => {
                setLoading(true);
                try { await requestDeletionOtp(getToken()); startCooldown(60); }
                catch (err) { setOtpError(err.message); }
                finally { setLoading(false); }
              }}
              disabled={resendCooldown > 0 || loading}
              style={{ ...btnGhost, color: resendCooldown > 0 ? "#475569" : "#38bdf8" }}
            >
              {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Resend code"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  // ── Step 3: Success ────────────────────────────────────────────────────────
  return (
    <div style={overlay}>
      <div style={{ ...card, maxWidth: "440px", textAlign: "center", border: "1px solid #334155" }}>
        <div style={{
          width: "56px", height: "56px", borderRadius: "50%",
          background: "#1e293b", border: "1px solid #334155",
          display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 20px",
        }}>
          <Trash2 style={{ color: "#94a3b8", width: "28px", height: "28px" }} />
        </div>
        <h2 style={{ color: "#f1f5f9", fontSize: "20px", fontWeight: 700, margin: "0 0 12px", fontFamily: "monospace" }}>
          ACCOUNT DEACTIVATED
        </h2>
        <p style={{ color: "#94a3b8", fontSize: "14px", lineHeight: 1.7, margin: "0 0 16px" }}>
          Your account has been deactivated and will be permanently deleted on
          <strong style={{ color: "#f1f5f9" }}> {successDate}</strong>.
        </p>
        <p style={{ color: "#64748b", fontSize: "13px", lineHeight: 1.6, margin: 0 }}>
          You can cancel this at any time within 30 days by logging back in.<br />
          Redirecting you now...
        </p>
      </div>
    </div>
  );
}
