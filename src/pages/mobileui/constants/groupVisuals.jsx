import React from 'react';

export const GROUP_ICON_SVG = {
  Boards: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="2" width="20" height="20" rx="2"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="18" x2="8" y2="22"/><line x1="16" y1="18" x2="16" y2="22"/><line x1="2" y1="8" x2="6" y2="8"/><line x1="2" y1="16" x2="6" y2="16"/><line x1="18" y1="8" x2="22" y2="8"/><line x1="18" y1="16" x2="22" y2="16"/><rect x="8" y="8" width="8" height="8" rx="1" fill={c} fillOpacity="0.2"/></svg>,
  Outputs: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="10" r="5"/><path d="M12 15v4M9 19h6M8.5 7.5A5 5 0 0 1 12 5"/></svg>,
  Inputs: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="6" y="10" width="12" height="8" rx="2"/><circle cx="12" cy="10" r="2" fill={c} fillOpacity="0.3"/><line x1="12" y1="2" x2="12" y2="8"/><line x1="4" y1="18" x2="6" y2="18"/><line x1="18" y1="18" x2="20" y2="18"/></svg>,
  Passives: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="2" y1="12" x2="6" y2="12"/><rect x="6" y="8" width="12" height="8" rx="1"/><line x1="18" y1="12" x2="22" y2="12"/></svg>,
  Power: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="2" x2="12" y2="12"/><path d="M7.5 5A8 8 0 1 0 16.5 5"/></svg>,
  Actuators: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M2 12h3M19 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12"/></svg>,
  Memory: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="4" y="5" width="16" height="14" rx="2"/><line x1="8" y1="5" x2="8" y2="19"/><line x1="12" y1="5" x2="12" y2="19"/><line x1="16" y1="5" x2="16" y2="19"/></svg>,
  Displays: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="4" width="20" height="14" rx="2"/><line x1="8" y1="22" x2="16" y2="22"/><line x1="12" y1="18" x2="12" y2="22"/></svg>,
  Sensors: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5.5 5.5A11 11 0 0 0 5.5 18.5M18.5 5.5A11 11 0 0 1 18.5 18.5M8.5 8.5A6 6 0 0 0 8.5 15.5M15.5 8.5A6 6 0 0 1 15.5 15.5"/><circle cx="12" cy="12" r="1.5" fill={c}/></svg>,
  Logic: (c) => <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 8h8c3.3 0 6 2.7 6 6s-2.7 6-6 6H4z"/><line x1="4" y1="4" x2="4" y2="20"/><line x1="2" y1="11" x2="4" y2="11"/><line x1="2" y1="17" x2="4" y2="17"/><line x1="18" y1="14" x2="22" y2="14"/></svg>,
};

export const GROUP_COLORS = {
  Boards: '#6366f1',
  Outputs: '#22c55e',
  Inputs: '#3b82f6',
  Passives: '#f59e0b',
  Power: '#ef4444',
  Actuators: '#06b6d4',
  Memory: '#8b5cf6',
  Displays: '#ec4899',
  Sensors: '#14b8a6',
  Logic: '#8b5cf6',
};
