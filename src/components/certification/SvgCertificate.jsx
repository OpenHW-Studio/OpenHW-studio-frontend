import React, { useState, useEffect, forwardRef } from 'react';
import QRCode from 'qrcode';
import { CERTIFICATE_LOGOS } from './logoDataUrls';

/**
 * SvgCertificate - Official High-Fidelity Vector Certificate Component
 * Replicates the exact demo certificate styling:
 * - Full-height left gold medal ribbon extending to the bottom edge
 * - Authentic Leaf.jpg watercolor foliage background on the left
 * - Clean sans-serif header: "Curriculum & Laboratory Mastery" and bold "Certificate"
 * - Prestigious Georgia italic serif body typography
 * - Dynamic university line (omitted if user has no school in profile)
 * - Real scannable QR code and short hash pill touching the bottom edge
 * - Official logos row and computer-generated ledger disclaimer
 */
const SvgCertificate = forwardRef(function SvgCertificate({
  recipientName = 'Shivam Jadhav',
  recipientSchool = '',
  certId = 'OHW-ARD-2026-176F516D',
  track = 'arduino',
  trackTitle = 'Certified Embedded Systems Specialist — Arduino Architecture',
  issueDate = new Date(),
  verificationUrl = '',
  totalLabs = 22,
  className = '',
  style = {}
}, ref) {
  const [qrCodeDataUrl, setQrCodeDataUrl] = useState('');

  const liveVerificationUrl = verificationUrl || 
    (typeof window !== 'undefined' 
      ? `${window.location.origin}/verify/${certId}` 
      : `https://openhw-studio.fossee.in/verify/${certId}`);

  // Short 5-character badge hash
  const shortHash = (certId.split('-').pop() || 'c6a4a').toLowerCase().slice(0, 5);

  const hasSchool = Boolean(recipientSchool && recipientSchool.trim());

  // Generate crisp QR code on mount / URL change
  useEffect(() => {
    QRCode.toDataURL(liveVerificationUrl, {
      width: 180,
      margin: 1,
      errorCorrectionLevel: 'M',
      color: {
        dark: '#000000',
        light: '#ffffff'
      }
    })
      .then(url => setQrCodeDataUrl(url))
      .catch(err => console.error('QR code generation error:', err));
  }, [liveVerificationUrl]);

  return (
    <svg
      ref={ref}
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 1000 740"
      width="100%"
      height="100%"
      className={className}
      style={{
        display: 'block',
        maxWidth: '100%',
        height: 'auto',
        borderRadius: '6px',
        background: '#ffffff',
        ...style
      }}
    >
      <defs>
        {/* Soft Parchment Background */}
        <linearGradient id="parchmentGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#fffdfa" />
          <stop offset="40%" stopColor="#fdfbf5" />
          <stop offset="100%" stopColor="#faf6ec" />
        </linearGradient>

        {/* Mask to smoothly fade the Leaf.jpg image on the right edge */}
        <mask id="leafFadeMask">
          <linearGradient id="fadeGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="60%" stopColor="#ffffff" stopOpacity="1" />
            <stop offset="85%" stopColor="#ffffff" stopOpacity="0.75" />
            <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
          </linearGradient>
          <rect x="0" y="0" width="225" height="740" fill="url(#fadeGrad)" />
        </mask>

        {/* 3D Metallic Gold Ribbon Gradients */}
        <linearGradient id="goldSashLeft" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#854d0e" />
          <stop offset="25%" stopColor="#d97706" />
          <stop offset="55%" stopColor="#fef08a" />
          <stop offset="80%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#713f12" />
        </linearGradient>

        <linearGradient id="goldSashRight" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#713f12" />
          <stop offset="30%" stopColor="#f59e0b" />
          <stop offset="60%" stopColor="#fef3c7" />
          <stop offset="85%" stopColor="#d97706" />
          <stop offset="100%" stopColor="#854d0e" />
        </linearGradient>

        <linearGradient id="goldStripGrad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#9a5b03" />
          <stop offset="18%" stopColor="#c2850a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="82%" stopColor="#c2850a" />
          <stop offset="100%" stopColor="#7c4604" />
        </linearGradient>

        {/* Realistic Medallion Multi-stop Shading */}
        <radialGradient id="medalRimGlow" cx="40%" cy="32%" r="68%">
          <stop offset="0%" stopColor="#ffffff" />
          <stop offset="20%" stopColor="#fef08a" />
          <stop offset="50%" stopColor="#eab308" />
          <stop offset="78%" stopColor="#ca8a04" />
          <stop offset="92%" stopColor="#854d0e" />
          <stop offset="100%" stopColor="#451a03" />
        </radialGradient>

        <radialGradient id="medalFaceGrad" cx="45%" cy="40%" r="60%">
          <stop offset="0%" stopColor="#fffdf0" />
          <stop offset="45%" stopColor="#fef9c3" />
          <stop offset="80%" stopColor="#fef08a" />
          <stop offset="95%" stopColor="#eab308" />
          <stop offset="100%" stopColor="#ca8a04" />
        </radialGradient>

        {/* Drop Shadows */}
        <filter id="medalDropShadow" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="3" dy="5" stdDeviation="4" floodColor="#000000" floodOpacity="0.30" />
        </filter>
        <filter id="ribbonDropShadow" x="-20%" y="-5%" width="140%" height="110%">
          <feDropShadow dx="2" dy="3.5" stdDeviation="3.5" floodColor="#000000" floodOpacity="0.22" />
        </filter>
      </defs>

      {/* ── BASE BACKGROUND ────────────────────────────────────────────── */}
      <rect width="1000" height="740" fill="url(#parchmentGrad)" />

      {/* Outer Diploma Frame Lines */}
      <rect x="12" y="12" width="976" height="716" fill="none" stroke="#d5c7a3" strokeWidth="1.5" />
      <rect x="16" y="16" width="968" height="708" fill="none" stroke="#e8debe" strokeWidth="0.8" />

      {/* ── LEFT LEAF IMAGE BACKGROUND (Leaf.jpg with soft edge mask) ─── */}
      <image
        href={CERTIFICATE_LOGOS.leaf}
        x="0"
        y="0"
        width="220"
        height="740"
        preserveAspectRatio="xMidYMid slice"
        mask="url(#leafFadeMask)"
        opacity="0.85"
      />

      {/* ── 3D GOLD RIBBON & FULL-HEIGHT VERTICAL COLUMN (TOUCHES BOTTOM) ── */}
      <g filter="url(#ribbonDropShadow)">
        {/* Top Ribbon - Left Sash */}
        <polygon
          points="68,0 114,0 138,145 102,136"
          fill="url(#goldSashLeft)"
        />
        {/* Top Ribbon - Right Sash */}
        <polygon
          points="146,0 192,0 158,136 122,145"
          fill="url(#goldSashRight)"
        />
        {/* Center Ribbon V-Point Notch */}
        <polygon
          points="102,136 130,158 158,136 130,126"
          fill="#713f12"
          opacity="0.4"
        />

        {/* Continuous Vertical Gold Column: Extends from medal ALL THE WAY TO THE BOTTOM (y = 740) */}
        <rect
          x="92"
          y="270"
          width="76"
          height="470"
          fill="url(#goldStripGrad)"
        />
        {/* Dark edge pinstripes on ribbon for 3D depth */}
        <line x1="92" y1="270" x2="92" y2="740" stroke="#713f12" strokeWidth="1.2" opacity="0.5" />
        <line x1="168" y1="270" x2="168" y2="740" stroke="#713f12" strokeWidth="1.2" opacity="0.5" />

        {/* Vertical Website Text on Ribbon */}
        <text
          x="-435"
          y="135"
          transform="rotate(-90)"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="13"
          letterSpacing="2.4"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          fontWeight="700"
          opacity="0.96"
        >
          https://fossee.in
        </text>

        {/* Bottom QR Code White Box Container (Placed near bottom, above hash tab) */}
        <rect
          x="92"
          y="600"
          width="76"
          height="76"
          fill="#ffffff"
          stroke="#cbd5e1"
          strokeWidth="1"
        />

        {/* Live Scannable QR Code */}
        {qrCodeDataUrl && (
          <image
            href={qrCodeDataUrl}
            x="96"
            y="604"
            width="68"
            height="68"
            preserveAspectRatio="xMidYMid meet"
          />
        )}

        {/* Gold Short Hash Pill touching the bottom edge (y = 676 to 740) */}
        <rect
          x="92"
          y="676"
          width="76"
          height="64"
          fill="#b48318"
        />
        <text
          x="130"
          y="708"
          textAnchor="middle"
          fill="#ffffff"
          fontSize="13"
          fontFamily="'Courier New', Courier, monospace"
          fontWeight="bold"
          letterSpacing="1.2"
        >
          {shortHash}
        </text>
      </g>

      {/* ── 3D CIRCULAR GOLD MEDALLION (Centered at x = 130, y = 205) ──── */}
      <g filter="url(#medalDropShadow)">
        {/* Outer Heavy Beveled Coin Rim */}
        <circle cx="130" cy="205" r="70" fill="url(#medalRimGlow)" />
        <circle cx="130" cy="205" r="67" fill="none" stroke="#78350f" strokeWidth="2" opacity="0.85" />
        <circle cx="130" cy="205" r="64" fill="none" stroke="#fef08a" strokeWidth="1.2" opacity="0.95" />

        {/* Beaded Edge Ring */}
        <circle
          cx="130"
          cy="205"
          r="61"
          fill="none"
          stroke="#854d0e"
          strokeWidth="1.5"
          strokeDasharray="2.5 3"
        />

        {/* Inner Coin Face */}
        <circle cx="130" cy="205" r="57.5" fill="url(#medalFaceGrad)" />
        <circle cx="130" cy="205" r="57" fill="none" stroke="#ca8a04" strokeWidth="1" opacity="0.5" />

        {/* Medallion Typography */}
        <text
          x="130"
          y="172"
          textAnchor="middle"
          fill="#3b1f07"
          fontSize="14.5"
          fontWeight="900"
          fontFamily="Georgia, 'Times New Roman', serif"
          letterSpacing="1.2"
        >
          FOSSEE
        </text>

        <text
          x="130"
          y="190"
          textAnchor="middle"
          fill="#451a03"
          fontSize="10.5"
          fontWeight="700"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          OpenHW Studio
        </text>

        <text
          x="130"
          y="206"
          textAnchor="middle"
          fill="#5c2e0b"
          fontSize="9.5"
          fontWeight="800"
          letterSpacing="0.6"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          TECHNICAL
        </text>

        <text
          x="130"
          y="221"
          textAnchor="middle"
          fill="#451a03"
          fontSize="11"
          fontWeight="700"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          Specialist
        </text>

        <text
          x="130"
          y="245"
          textAnchor="middle"
          fill="#271004"
          fontSize="17.5"
          fontWeight="900"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          2026
        </text>
      </g>

      {/* ── CERTIFICATE HEADER (Clean modern sans-serif like the demo certificate) */}
      <g transform="translate(210, 0)">
        {/* Category: Clean, medium sans-serif in olive green */}
        <text
          x="0"
          y="90"
          fill="#2d5a27"
          fontSize="38"
          fontWeight="600"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          letterSpacing="-0.2"
        >
          Curriculum &amp; Laboratory Mastery
        </text>

        {/* Big Certificate Title: Bold, iconic sans-serif in deep forest green */}
        <text
          x="0"
          y="180"
          fill="#1b4332"
          fontSize="84"
          fontWeight="900"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif"
          letterSpacing="-1.8"
        >
          Certificate
        </text>

        {/* Clean Olive Green Dividing Line */}
        <line
          x1="0"
          y1="214"
          x2="725"
          y2="214"
          stroke="#2d5a27"
          strokeWidth="2.8"
        />
      </g>

      {/* ── CERTIFICATE BODY CONTENT (Centered between x = 210 and x = 935: center x = 572) */}
      <g>
        {/* "This is to certify that" */}
        <text
          x="572"
          y={hasSchool ? 254 : 260}
          textAnchor="middle"
          fill="#111827"
          fontSize="18.5"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          This is to certify that
        </text>

        {/* Student Recipient Name: Dignified italic bold serif */}
        <text
          x="572"
          y={hasSchool ? 298 : 308}
          textAnchor="middle"
          fill="#000000"
          fontSize="32"
          fontWeight="bold"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          {recipientName}
        </text>

        {/* Institution / College (conditionally rendered only if provided) */}
        {hasSchool && (
          <text
            x="572"
            y="330"
            textAnchor="middle"
            fill="#1f2937"
            fontSize="17.5"
            fontStyle="italic"
            fontFamily="Georgia, 'Times New Roman', serif"
          >
            from {recipientSchool}
          </text>
        )}

        {/* Completion Statement */}
        <text
          x="572"
          y={hasSchool ? 366 : 355}
          textAnchor="middle"
          fill="#111827"
          fontSize="16.5"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          has successfully completed the practical engineering curriculum for
        </text>

        {/* Conferred Credential Title */}
        <text
          x="572"
          y={hasSchool ? 400 : 392}
          textAnchor="middle"
          fill="#1b4332"
          fontSize="20"
          fontWeight="bold"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          "{trackTitle}"
        </text>

        {/* Laboratory Scope & Competency Narrative */}
        <text
          x="572"
          y={hasSchool ? 436 : 430}
          textAnchor="middle"
          fill="#1f2937"
          fontSize="14.5"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          Demonstrating technical mastery over all {totalLabs} circuit simulation island laboratories
        </text>

        <text
          x="572"
          y={hasSchool ? 458 : 452}
          textAnchor="middle"
          fill="#1f2937"
          fontSize="14.5"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          spanning circuit fundamentals, real-time actuation, communication buses, and sensor kinematics.
        </text>

        {/* Public Verification Link */}
        <text
          x="572"
          y={hasSchool ? 494 : 488}
          textAnchor="middle"
          fill="#1f2937"
          fontSize="13.5"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          This credential is authenticated at{' '}
          <tspan fill="#0284c7" fontWeight="bold" fontStyle="italic">
            {liveVerificationUrl}
          </tspan>
        </text>
      </g>

      {/* ── SIGNATORY BLOCK ────────────────────────────────────────────── */}
      <g transform="translate(210, 526)">
        <text
          x="0"
          y="0"
          fill="#000000"
          fontSize="15.5"
          fontWeight="bold"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          Prof. Prabhu Ramchandran
        </text>
        <text
          x="0"
          y="17"
          fill="#334155"
          fontSize="12"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          Principal Investigator - FOSSEE
        </text>
        <text
          x="0"
          y="31"
          fill="#475569"
          fontSize="10.5"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          (Free/Libre and Open Source Software in Education)
        </text>
        <text
          x="0"
          y="46"
          fill="#334155"
          fontSize="12"
          fontStyle="italic"
          fontFamily="Georgia, 'Times New Roman', serif"
        >
          IIT Bombay
        </text>
      </g>

      {/* ── 4 OFFICIAL INSTITUTIONAL LOGOS (Enlarged prominent size) ── */}
      <g transform="translate(205, 588)">
        {/* 1. IIT Bombay Emblem */}
        <image
          href={CERTIFICATE_LOGOS.iitb}
          x="0"
          y="0"
          width="86"
          height="70"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* 2. FOSSEE Logo */}
        <image
          href={CERTIFICATE_LOGOS.fossee}
          x="135"
          y="5"
          width="155"
          height="62"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* 3. Open Hardware Logo */}
        <image
          href={CERTIFICATE_LOGOS.openHardware}
          x="330"
          y="5"
          width="160"
          height="62"
          preserveAspectRatio="xMidYMid meet"
        />

        {/* 4. NMEICT Logo */}
        <image
          href={CERTIFICATE_LOGOS.nmeict}
          x="530"
          y="7"
          width="190"
          height="58"
          preserveAspectRatio="xMidYMid meet"
        />
      </g>

      {/* ── FOOTER COMPUTER-GENERATED DISCLAIMER ───────────────────────── */}
      <g transform="translate(572, 692)">
        <text
          x="0"
          y="0"
          textAnchor="middle"
          fill="#1e3a8a"
          fontSize="10.5"
          fontFamily="-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          <tspan fontWeight="bold">* This is a computer generated certificate and requires no signature.</tspan>
          <tspan fill="#334155"> To verify, scan the QR code or Visit: </tspan>
          <tspan fill="#0284c7" fontWeight="bold">https://openhw-studio.fossee.in/verify</tspan>
        </text>
      </g>
    </svg>
  );
});

export default SvgCertificate;
