import React, { useRef, useState, useEffect } from 'react';
import {
  Award,
  Download,
  Share2,
  Copy,
  Check,
  X,
  FileCode
} from 'lucide-react';
import {
  generateCertificateId,
  buildLinkedInCertUrl
} from '../../services/certification/certificateService';
import { getToken } from '../../services/authService';
import SvgCertificate from './SvgCertificate';

export default function CertificateModal({
  isOpen,
  onClose,
  user,
  track = 'arduino',
  trackTitle = 'Certified Embedded Systems Specialist — Arduino Architecture',
  completedProjects = [],
  issueDate = new Date()
}) {
  const svgRef = useRef(null);
  const [downloadingPng, setDownloadingPng] = useState(false);
  const [downloadingSvg, setDownloadingSvg] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!isOpen || !user) return;
    const token = getToken();
    const API_BASE = import.meta.env.VITE_API_BASE_URL || (import.meta.env.DEV ? 'http://localhost:5001/api' : '/api');
    fetch(`${API_BASE}/certificates/claim`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {})
      },
      body: JSON.stringify({ track })
    })
      .then(res => res.json())
      .then(data => {
        if (!data.success) {
          console.warn('Certificate ledger sync note:', data.error);
        }
      })
      .catch(err => {
        console.error('Failed to register certificate in public ledger:', err);
      });
  }, [isOpen, user, track]);

  if (!isOpen) return null;

  const recipientName = (user?.name || user?.username || 'OpenHW Studio Engineer').trim();
  const recipientSchool = (user?.school || '').trim();
  const trackCode = track === 'esp32' ? 'ESP' : 'ARD';
  const certId = generateCertificateId(user?._id || user?.id, user?.email, trackCode);
  const totalLabs = track === 'esp32' ? 12 : 22;

  const verificationUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/verify/${certId}`
    : `https://openhw-studio.fossee.in/verify/${certId}`;

  // ── Download as High-Resolution 300 DPI PNG ──────────────────────────────
  const handleDownloadPng = async () => {
    if (!svgRef.current || downloadingPng) return;
    setDownloadingPng(true);

    try {
      const svgElement = svgRef.current;
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const image = new Image();
      image.onload = () => {
        // High-resolution canvas: 2000 x 1500 (standard 300 DPI equivalent)
        const canvas = document.createElement('canvas');
        canvas.width = 2000;
        canvas.height = 1500;
        const ctx = canvas.getContext('2d');

        // Fill crisp white background
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw SVG image scaled to 2x resolution
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const pngUrl = canvas.toDataURL('image/png', 1.0);
        const link = document.createElement('a');
        link.download = `OpenHW_Studio_Certificate_${certId}.png`;
        link.href = pngUrl;
        link.click();
        URL.revokeObjectURL(blobURL);
        setDownloadingPng(false);
      };

      image.onerror = (e) => {
        console.error('Failed to rasterize certificate SVG:', e);
        setDownloadingPng(false);
      };

      image.src = blobURL;
    } catch (err) {
      console.error('Failed to download PNG certificate:', err);
      setDownloadingPng(false);
    }
  };

  // ── Download as Clean Scalable Vector SVG ─────────────────────────────────
  const handleDownloadSvg = () => {
    if (!svgRef.current || downloadingSvg) return;
    setDownloadingSvg(true);

    try {
      const svgElement = svgRef.current;
      const svgString = new XMLSerializer().serializeToString(svgElement);
      const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
      const URL = window.URL || window.webkitURL || window;
      const blobURL = URL.createObjectURL(svgBlob);

      const link = document.createElement('a');
      link.download = `OpenHW_Studio_Certificate_${certId}.svg`;
      link.href = blobURL;
      link.click();
      URL.revokeObjectURL(blobURL);
    } catch (err) {
      console.error('Failed to download SVG certificate:', err);
    } finally {
      setDownloadingSvg(false);
    }
  };

  const handleCopyLink = () => {
    navigator.clipboard.writeText(verificationUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  };

  const dateObj = issueDate instanceof Date ? issueDate : new Date(issueDate);
  const linkedInUrl = buildLinkedInCertUrl({
    certName: trackTitle || "Certified Embedded Systems Specialist - Arduino Architecture",
    certId: certId,
    issueYear: dateObj.getFullYear(),
    issueMonth: dateObj.getMonth() + 1
  });

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        backgroundColor: 'rgba(15, 23, 42, 0.82)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        overflowY: 'auto'
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '1020px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
          margin: 'auto'
        }}
      >
        {/* Top Floating Control Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'rgba(255, 255, 255, 0.98)',
            border: '1px solid #e2e8f0',
            borderRadius: '16px',
            padding: '12px 20px',
            boxShadow: '0 12px 32px rgba(0, 0, 0, 0.18)',
            backdropFilter: 'blur(10px)',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          {/* Credential Header */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #f59e0b, #d97706)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#fff',
                flexShrink: 0
              }}
            >
              <Award size={18} strokeWidth={2.5} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: '800', color: '#0f172a' }}>
                OFFICIAL HARDWARE CREDENTIAL
              </div>
              <div style={{ fontSize: '11px', color: '#64748b', fontFamily: 'monospace' }}>
                ID: <span style={{ color: '#0284c7', fontWeight: 'bold' }}>{certId}</span> • VERIFIED & SIGNED
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            {/* Copy Verification Link */}
            <button
              onClick={handleCopyLink}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                color: '#1e293b',
                fontSize: '12px',
                fontWeight: '700',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
            >
              {copied ? <Check size={14} color="#059669" /> : <Copy size={14} />}
              {copied ? 'Link Copied!' : 'Copy Verify URL'}
            </button>

            {/* Add to LinkedIn */}
            <a
              href={linkedInUrl}
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                borderRadius: '10px',
                background: '#0a66c2',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                textDecoration: 'none',
                cursor: 'pointer'
              }}
            >
              <Share2 size={14} />
              LinkedIn
            </a>

            {/* Download Vector SVG */}
            <button
              onClick={handleDownloadSvg}
              disabled={downloadingSvg}
              title="Download clean, lossless vector SVG"
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                borderRadius: '10px',
                background: '#475569',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: downloadingSvg ? 'wait' : 'pointer'
              }}
            >
              <FileCode size={14} />
              {downloadingSvg ? 'Exporting...' : 'SVG'}
            </button>

            {/* Download HD PNG */}
            <button
              onClick={handleDownloadPng}
              disabled={downloadingPng}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 16px',
                borderRadius: '10px',
                background: '#059669',
                border: 'none',
                color: '#ffffff',
                fontSize: '12px',
                fontWeight: '700',
                cursor: downloadingPng ? 'wait' : 'pointer',
                boxShadow: '0 4px 12px rgba(5, 150, 105, 0.35)'
              }}
            >
              <Download size={14} />
              {downloadingPng ? 'Rendering 300 DPI...' : 'Download HD PNG'}
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                color: '#64748b',
                cursor: 'pointer',
                padding: '6px',
                display: 'flex',
                alignItems: 'center',
                marginLeft: '4px'
              }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Certificate Display Area */}
        <div
          style={{
            position: 'relative',
            width: '100%',
            borderRadius: '10px',
            overflow: 'hidden',
            boxShadow: '0 25px 60px -12px rgba(0, 0, 0, 0.45), 0 0 0 1px rgba(0, 0, 0, 0.08)',
            background: '#ffffff'
          }}
        >
          <SvgCertificate
            ref={svgRef}
            recipientName={recipientName}
            recipientSchool={recipientSchool}
            certId={certId}
            track={track}
            trackTitle={trackTitle}
            issueDate={issueDate}
            verificationUrl={verificationUrl}
            totalLabs={totalLabs}
          />
        </div>
      </div>
    </div>
  );
}
