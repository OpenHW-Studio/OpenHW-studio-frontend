import React from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AdminLandingPage() {
    const navigate = useNavigate();
    const { isAdminAuthenticated } = useAuth();

    return (
        <div style={{
            minHeight: '100vh',
            background: '#0f172a',
            color: '#f1f5f9',
            fontFamily: 'sans-serif',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            padding: '20px'
        }}>
            <div style={{
                background: '#1e293b',
                padding: '40px',
                borderRadius: '12px',
                maxWidth: '600px',
                width: '100%',
                textAlign: 'center',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
            }}>
                <div style={{ fontSize: '48px', marginBottom: '20px' }}>⚡</div>
                <h1 style={{ fontSize: '32px', marginBottom: '16px', color: '#fff' }}>OpenHW-Studio</h1>
                <h2 style={{ fontSize: '24px', marginBottom: '24px', color: '#94a3b8' }}>Admin Administration Portal</h2>

                <p style={{ color: '#cbd5e1', marginBottom: '32px', lineHeight: '1.6' }}>
                    Welcome to the central control panel. This secured area is intended strictly for
                    system administration. From the control panel, you can manage user roles, review
                    community component submissions, and monitor system health.
                </p>

                <div style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '16px',
                    alignItems: 'center'
                }}>
                    <div style={{
                        display: 'flex',
                        background: '#334155',
                        padding: '16px',
                        borderRadius: '8px',
                        width: '100%',
                        justifyContent: 'space-between'
                    }}>
                        <span style={{ color: '#94a3b8' }}>System Status</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>● Operational</span>
                    </div>

                    <div style={{
                        display: 'flex',
                        background: '#334155',
                        padding: '16px',
                        borderRadius: '8px',
                        width: '100%',
                        justifyContent: 'space-between'
                    }}>
                        <span style={{ color: '#94a3b8' }}>Database Connection</span>
                        <span style={{ color: '#10b981', fontWeight: 'bold' }}>● Connected</span>
                    </div>
                </div>

                <div style={{ marginTop: '40px' }}>
                    {isAdminAuthenticated ? (
                        <button
                            onClick={() => navigate('/admin/dashboard')}
                            style={{
                                background: '#3b82f6',
                                color: '#fff',
                                padding: '12px 32px',
                                fontSize: '18px',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#2563eb'}
                            onMouseOut={e => e.currentTarget.style.background = '#3b82f6'}
                        >
                            Enter Control Panel →
                        </button>
                    ) : (
                        <button
                            onClick={() => navigate('/admin/login')}
                            style={{
                                background: '#10b981',
                                color: '#fff',
                                padding: '12px 32px',
                                fontSize: '18px',
                                border: 'none',
                                borderRadius: '8px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                transition: 'background 0.2s'
                            }}
                            onMouseOver={e => e.currentTarget.style.background = '#059669'}
                            onMouseOut={e => e.currentTarget.style.background = '#10b981'}
                        >
                            Admin Login
                        </button>
                    )}
                </div>

                <div style={{ marginTop: '30px' }}>
                    <button
                        onClick={() => navigate('/')}
                        style={{
                            background: 'transparent',
                            color: '#64748b',
                            border: 'none',
                            cursor: 'pointer',
                            textDecoration: 'underline'
                        }}
                    >
                        Return to Main Site
                    </button>
                </div>
            </div>
        </div>
    );
}
