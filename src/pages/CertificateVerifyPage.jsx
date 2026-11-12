import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation, useSearchParams, Link } from 'react-router-dom';
import { getAdventureReturnUrl } from '../utils/navigationUtils';
import {
  ShieldCheck,
  CheckCircle2,
  Cpu,
  ArrowLeft,
  Award,
  Copy,
  Check,
  AlertTriangle,
  User,
  GraduationCap,
  Calendar,
  Building2,
  FileCheck2,
  Eye
} from 'lucide-react';
import { ARDUINO_CERTIFICATION_DOMAINS } from '../services/certification/certificateService';
import ThemeToggleSlider from '../components/ThemeToggleSlider';
import CertificateModal from '../components/certification/CertificateModal';

export default function CertificateVerifyPage() {
  const { certId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const [copied, setCopied] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [certData, setCertData] = useState(null);
  const [showModal, setShowModal] = useState(false);

  // Watch data-theme attribute
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light'
  );

  useEffect(() => {
    const observer = new MutationObserver(() => {
      setTheme(document.documentElement.getAttribute('data-theme') || localStorage.getItem('theme') || 'light');
    });
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-theme']
    });
    return () => observer.disconnect();
  }, []);

  const formattedCertId = (certId || 'OHW-ARD-2026-NODE').toUpperCase();

  // ── Fetch Verification Data from Backend Ledger ─────────────────────────────
  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    setError(null);

    fetch(`/api/certificates/verify/${encodeURIComponent(formattedCertId)}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok || !data.isValid) {
          throw new Error(data.error || 'Credential not found in public ledger');
        }
        return data.certificate;
      })
      .then((cert) => {
        if (isMounted) {
          setCertData(cert);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (isMounted) {
          console.warn('[CertificateVerify] Verification error:', err.message);
          setError(err.message);
          setLoading(false);
        }
      });

    return () => {
      isMounted = false;
    };
  }, [formattedCertId]);

  const handleCopyId = () => {
    navigator.clipboard.writeText(formattedCertId);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const formattedDate = certData?.issuedAt
    ? new Intl.DateTimeFormat('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      }).format(new Date(certData.issuedAt))
    : 'September 2026';

  const domainsToDisplay = certData?.domains && certData.domains.length > 0
    ? certData.domains
    : ARDUINO_CERTIFICATION_DOMAINS;

  return (
    <div className="verify-page-wrapper">
      <style>{`
        :root, [data-theme="light"] {
          --v-bg: #f8fafc;
          --v-bg-subtle: #f1f5f9;
          --v-surface: #ffffff;
          --v-border: #e2e8f0;
          --v-border-strong: #cbd5e1;
          --v-text-main: #0f172a;
          --v-text-sub: #334155;
          --v-text-muted: #64748b;
          --v-grid: rgba(15, 23, 42, 0.04);
          --v-emerald: #059669;
          --v-emerald-bg: #ecfdf5;
          --v-emerald-border: #a7f3d0;
          --v-blue: #0284c7;
          --v-blue-bg: #f0f9ff;
          --v-amber: #d97706;
          --v-amber-bg: #fffbeb;
          --v-amber-border: #fde68a;
          --v-card-shadow: 0 1px 3px rgba(0,0,0,0.05), 0 10px 24px -8px rgba(15, 23, 42, 0.06);
          --v-code-bg: #f1f5f9;
        }

        [data-theme="dark"] {
          --v-bg: #070a13;
          --v-bg-subtle: #0d1322;
          --v-surface: #0f172a;
          --v-border: #1e293b;
          --v-border-strong: #334155;
          --v-text-main: #f8fafc;
          --v-text-sub: #cbd5e1;
          --v-text-muted: #94a3b8;
          --v-grid: rgba(255, 255, 255, 0.035);
          --v-emerald: #10b981;
          --v-emerald-bg: rgba(16, 185, 129, 0.12);
          --v-emerald-border: rgba(16, 185, 129, 0.35);
          --v-blue: #38bdf8;
          --v-blue-bg: rgba(56, 189, 248, 0.12);
          --v-amber: #f59e0b;
          --v-amber-bg: rgba(245, 158, 11, 0.12);
          --v-amber-border: rgba(245, 158, 11, 0.35);
          --v-card-shadow: 0 8px 30px rgba(0, 0, 0, 0.4);
          --v-code-bg: #0b111e;
        }

        .verify-page-wrapper {
          min-height: 100vh;
          background-color: var(--v-bg);
          background-image:
            linear-gradient(var(--v-grid) 1px, transparent 1px),
            linear-gradient(90deg, var(--v-grid) 1px, transparent 1px);
          background-size: 32px 32px;
          color: var(--v-text-main);
          font-family: 'Space Grotesk', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          box-sizing: border-box;
          padding: 24px 20px 80px;
          transition: background-color 0.25s ease, color 0.25s ease;
        }

        .verify-container {
          max-width: 900px;
          margin: 0 auto;
        }

        .verify-nav {
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 12px;
          margin-bottom: 28px;
        }

        .verify-nav-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--v-surface);
          border: 1px solid var(--v-border);
          color: var(--v-text-sub);
          padding: 7px 14px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          text-decoration: none;
        }
        .verify-nav-btn:hover {
          color: var(--v-text-main);
          border-color: var(--v-border-strong);
        }

        .verify-card {
          background: var(--v-surface);
          border: 1px solid var(--v-border);
          border-radius: 20px;
          padding: 36px;
          box-shadow: var(--v-card-shadow);
          position: relative;
        }

        .verify-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 1px solid var(--v-border);
          padding-bottom: 24px;
          margin-bottom: 28px;
          flex-wrap: wrap;
          gap: 16px;
        }

        .verify-status-badge {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          background: var(--v-emerald-bg);
          border: 1px solid var(--v-emerald-border);
          color: var(--v-emerald);
          font-size: 11px;
          font-weight: 800;
          padding: 4px 10px;
          border-radius: 999px;
          letter-spacing: 0.04em;
        }

        /* Certificate Owner Hero Banner */
        .owner-hero-card {
          background: linear-gradient(135deg, rgba(2, 132, 199, 0.06) 0%, rgba(16, 185, 129, 0.06) 100%);
          border: 1.5px solid var(--v-blue-bg);
          border-left: 4px solid var(--v-blue);
          border-radius: 16px;
          padding: 22px 24px;
          margin-bottom: 28px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          flex-wrap: wrap;
          gap: 18px;
        }

        .owner-avatar {
          width: 56px;
          height: 56px;
          border-radius: 16px;
          background: linear-gradient(135deg, #0284c7, #0369a1);
          color: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 24px;
          font-weight: 800;
          box-shadow: 0 6px 16px rgba(2, 132, 199, 0.25);
          flex-shrink: 0;
        }

        .verify-details-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 14px;
          margin-bottom: 32px;
        }

        .verify-detail-item {
          background: var(--v-bg-subtle);
          border: 1px solid var(--v-border);
          border-radius: 12px;
          padding: 16px;
        }

        .verify-domain-item {
          background: var(--v-bg-subtle);
          border: 1px solid var(--v-border);
          border-radius: 10px;
          padding: 12px 16px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .competency-pill {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 6px 12px;
          border-radius: 8px;
          background: var(--v-bg-subtle);
          border: 1px solid var(--v-border);
          font-size: 11.5px;
          font-weight: 600;
          color: var(--v-text-sub);
        }
      `}</style>

      <div className="verify-container">

        {/* TOP NAVIGATION */}
        <div className="verify-nav">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Link to="/certifications" className="verify-nav-btn">
              <ArrowLeft size={14} />
              Certifications Catalog
            </Link>
            <button
              type="button"
              onClick={() => navigate(getAdventureReturnUrl({ location, searchParams }))}
              className="verify-nav-btn"
              style={{ background: 'transparent', cursor: 'pointer', border: '1px solid var(--v-border)' }}
            >
              Adventure Map
            </button>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <ThemeToggleSlider size="sm" />
          </div>
        </div>

        {/* LOADING STATE */}
        {loading && (
          <div className="verify-card" style={{ textAlign: 'center', padding: '60px 20px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                border: '3px solid var(--v-border)',
                borderTopColor: 'var(--v-blue)',
                borderRadius: '50%',
                animation: 'spin 1s linear infinite',
                margin: '0 auto 16px'
              }}
            />
            <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--v-text-main)' }}>
              Verifying Credential on OpenHW Ledger...
            </div>
            <div style={{ fontSize: '12px', color: 'var(--v-text-muted)', marginTop: '4px' }}>
              Querying cryptographic records for ID: {formattedCertId}
            </div>
          </div>
        )}

        {/* ERROR / NOT FOUND STATE */}
        {!loading && error && (
          <div className="verify-card" style={{ borderLeft: '4px solid #ef4444' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16 }}>
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  background: 'rgba(239, 68, 68, 0.1)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#ef4444',
                  flexShrink: 0
                }}
              >
                <AlertTriangle size={24} />
              </div>
              <div>
                <div style={{ fontSize: '18px', fontWeight: 800, color: 'var(--v-text-main)' }}>
                  Unverified Credential Record
                </div>
                <div style={{ fontSize: '13px', color: 'var(--v-text-muted)', marginTop: '4px', lineHeight: 1.5 }}>
                  The credential identifier <code style={{ color: '#ef4444', fontWeight: 700 }}>{formattedCertId}</code> could not be validated against the OpenHW Studio Academic Ledger.
                </div>
                <div style={{ marginTop: '16px' }}>
                  <Link to="/certifications" className="verify-nav-btn">
                    Browse Valid Certifications
                  </Link>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* VERIFIED SUCCESS CARD */}
        {!loading && !error && certData && (
          <div className="verify-card">

            {/* Status Header */}
            <div className="verify-header">
              <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
                <div
                  style={{
                    width: '52px',
                    height: '52px',
                    borderRadius: '14px',
                    background: 'var(--v-emerald-bg)',
                    border: '1px solid var(--v-emerald-border)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--v-emerald)',
                    flexShrink: 0
                  }}
                >
                  <ShieldCheck size={30} strokeWidth={2.2} />
                </div>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '20px', fontWeight: '800', color: 'var(--v-text-main)' }}>
                      Authentic Credential Verified
                    </span>
                    <span className="verify-status-badge">
                      <CheckCircle2 size={13} />
                      LEDGER VALIDATED
                    </span>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--v-text-muted)', marginTop: '2px' }}>
                    OpenHW Studio • FOSSEE Academic Credentialing Ledger
                  </div>
                </div>
              </div>

              {/* Credential Hash Badge */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <code
                  style={{
                    fontFamily: 'monospace',
                    fontSize: '12px',
                    fontWeight: 800,
                    color: 'var(--v-blue)',
                    background: 'var(--v-code-bg)',
                    border: '1px solid var(--v-border)',
                    padding: '8px 14px',
                    borderRadius: '10px'
                  }}
                >
                  {certData.certId}
                </code>
                <button
                  onClick={handleCopyId}
                  title="Copy Credential ID"
                  style={{
                    background: 'var(--v-bg-subtle)',
                    border: '1px solid var(--v-border)',
                    color: copied ? 'var(--v-emerald)' : 'var(--v-text-sub)',
                    borderRadius: '10px',
                    padding: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center'
                  }}
                >
                  {copied ? <Check size={14} /> : <Copy size={14} />}
                </button>
              </div>
            </div>

            {/* ── CERTIFICATE OWNER HERO CARD (Prominently displays owner name!) ── */}
            <div className="owner-hero-card">
              <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                <div className="owner-avatar">
                  <GraduationCap size={28} />
                </div>
                <div>
                  <div style={{ fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: 'var(--v-blue)' }}>
                    CERTIFIED CREDENTIAL OWNER
                  </div>
                  <div style={{ fontSize: '24px', fontWeight: 900, color: 'var(--v-text-main)', marginTop: '2px', letterSpacing: '-0.01em' }}>
                    {certData.recipientName}
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginTop: '4px', flexWrap: 'wrap', fontSize: '12px', color: 'var(--v-text-muted)' }}>
                    <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Building2 size={13} />
                      {certData.recipientSchool || 'Autonomous Engineering Laboratory'}
                    </span>
                    {certData.recipientEmailMasked && (
                      <span style={{ fontFamily: 'monospace', color: 'var(--v-text-sub)' }}>
                        • {certData.recipientEmailMasked}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* View Official Certificate Action */}
              <button
                onClick={() => setShowModal(true)}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 18px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                  border: 'none',
                  color: '#ffffff',
                  fontSize: '13px',
                  fontWeight: '700',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(5, 150, 105, 0.3)',
                  transition: 'all 0.2s'
                }}
              >
                <Eye size={16} />
                View Official Certificate
              </button>
            </div>

            {/* Details 4-Column Strip */}
            <div className="verify-details-grid">
              <div className="verify-detail-item">
                <div style={{ fontSize: '11px', color: 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                  Conferred Specification
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--v-text-main)', marginTop: '4px' }}>
                  {certData.trackTitle}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--v-blue)', marginTop: '2px', fontWeight: 600 }}>
                  Track Code: {certData.trackCode}
                </div>
              </div>

              <div className="verify-detail-item">
                <div style={{ fontSize: '11px', color: 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                  Conferring Authority
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--v-text-main)', marginTop: '4px' }}>
                  OpenHW Studio Consortium
                </div>
                <div style={{ fontSize: '12px', color: 'var(--v-text-muted)', marginTop: '2px' }}>
                  FOSSEE • IIT Bombay
                </div>
              </div>

              <div className="verify-detail-item">
                <div style={{ fontSize: '11px', color: 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                  Laboratory Scope
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--v-text-main)', marginTop: '4px' }}>
                  {certData.totalProjectsRequired} Simulation Labs
                </div>
                <div style={{ fontSize: '12px', color: 'var(--v-emerald)', marginTop: '2px', fontWeight: 700 }}>
                  100% Practical Coursework
                </div>
              </div>

              <div className="verify-detail-item">
                <div style={{ fontSize: '11px', color: 'var(--v-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: '700' }}>
                  Date of Conferral
                </div>
                <div style={{ fontSize: '15px', fontWeight: '800', color: 'var(--v-text-main)', marginTop: '4px' }}>
                  {formattedDate}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--v-text-muted)', marginTop: '2px' }}>
                  Permanently Recorded
                </div>
              </div>
            </div>

            {/* Verified Technical Competencies */}
            {certData.competencies && certData.competencies.length > 0 && (
              <div style={{ marginBottom: '28px' }}>
                <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--v-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Validated Technical Competencies
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                  {certData.competencies.map((comp) => (
                    <span key={comp} className="competency-pill">
                      <CheckCircle2 size={12} color="#059669" />
                      {comp}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Evaluated Engineering Domains */}
            <div style={{ marginBottom: '28px' }}>
              <div style={{ fontSize: '12px', fontWeight: '800', color: 'var(--v-text-muted)', marginBottom: '12px', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                Evaluated Engineering Domains
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {domainsToDisplay.map((domain, idx) => (
                  <div key={domain.domain} className="verify-domain-item">
                    <div>
                      <div style={{ fontSize: '13px', fontWeight: '700', color: 'var(--v-text-main)' }}>
                        Domain 0{idx + 1}: {domain.domain}
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--v-text-muted)', marginTop: '3px' }}>
                        {domain.skills.join(' • ')}
                      </div>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: 'var(--v-emerald)', fontSize: '11px', fontWeight: '800', flexShrink: 0 }}>
                      <CheckCircle2 size={14} />
                      <span>Verified</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Cryptographic Ledger Footer */}
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                borderTop: '1px solid var(--v-border)',
                paddingTop: '20px',
                fontSize: '11px',
                color: 'var(--v-text-muted)',
                flexWrap: 'wrap',
                gap: 8
              }}
            >
              <div>
                Verification record cryptographically generated against OpenHW interactive simulation logs.
              </div>
              <div style={{ fontFamily: 'monospace', color: 'var(--v-text-sub)', fontWeight: 700 }}>
                SHA-256 LEDGER INTEGRITY VALIDATED
              </div>
            </div>

          </div>
        )}

      </div>

      {/* ── OFFICIAL SVG CERTIFICATE MODAL PREVIEW ────────────────────── */}
      {certData && (
        <CertificateModal
          isOpen={showModal}
          onClose={() => setShowModal(false)}
          user={{
            name: certData.recipientName,
            school: certData.recipientSchool,
            email: certData.recipientEmailMasked
          }}
          track={certData.track}
          trackTitle={certData.trackTitle}
          issueDate={certData.issuedAt ? new Date(certData.issuedAt) : new Date()}
        />
      )}
    </div>
  );
}
