import React from 'react';
import {
    LayoutDashboard,
    Globe,
    Library,
    Clock,
    Package,
    PlayCircle,
    Terminal,
    LogOut,
    Activity,
    Box,
    Cpu,
    BarChart3,
    ShieldCheck,
    AlertTriangle,
    X,
    Bug,
    MessageSquare,
    ExternalLink,
} from 'lucide-react';

const MENU_ITEMS = [
    { id: 'overview',           icon: LayoutDashboard, label: 'Overview' },
    { id: 'map',                icon: Globe,           label: 'User Map' },
    { id: 'analytics',          icon: BarChart3,        label: 'Analytics' },
    { id: 'libraries',          icon: Library,         label: 'Libraries' },
    { id: 'adventure-content',  icon: Activity,        label: 'Adventure Content' },
    { id: 'approval',           icon: Clock,           label: 'Approvals' },
    { id: 'components',         icon: Package,         label: 'Custom Components' },
    { id: 'bugs-tracker',       icon: Bug,             label: 'Bug Tracker', isExternalLink: '/bugs' },
    { id: 'feedback-hub',       icon: MessageSquare,   label: 'Reviews & Feedback', isExternalLink: '/feedback' },
    { id: 'deployments',        icon: PlayCircle,      label: 'CI/CD Workflow' },
    { id: 'docker',             icon: Box,             label: 'Docker Monitoring' },
    { id: 'resources',          icon: Cpu,             label: 'Resource Budget' },
    { id: 'history',            icon: ShieldCheck,     label: 'Security History' },
    { id: 'logs',               icon: Terminal,        label: 'System Logs' },
];

const Sidebar = ({
    isOpen,
    onClose,
    activeTab,
    setActiveTab,
    onLogout,
    maintenanceMode,
    onToggleMaintenance,
    pendingCount = 0,
}) => {
    return (
        <aside className={`ad-sidebar ${isOpen ? 'open' : 'closed'}`}>
            {/* Logo */}
            <div className="ad-sidebar-logo">
                <div className="ad-sidebar-logo-icon">OH</div>
                <span className="ad-sidebar-logo-text">
                    Admin<span>Hub</span>
                </span>

                {/* Close button (mobile only) */}
                <button
                    className="ad-btn-icon lg:hidden ml-auto"
                    onClick={onClose}
                    aria-label="Close sidebar"
                >
                    <X />
                </button>
            </div>

            {/* Navigation */}
            <nav className="ad-sidebar-nav" role="navigation" aria-label="Admin navigation">
                {MENU_ITEMS.map(({ id, icon: Icon, label, isExternalLink }) => (
                    <button
                        key={id}
                        className={`ad-nav-item ${activeTab === id ? 'active' : ''}`}
                        onClick={() => {
                            if (isExternalLink) {
                                window.open(isExternalLink, '_blank');
                                return;
                            }
                            setActiveTab(id);
                            onClose();
                        }}
                        aria-current={activeTab === id ? 'page' : undefined}
                    >
                        <Icon className="ad-nav-icon" />
                        <span style={{ flex: 1, textAlign: 'left', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                            {label}
                        </span>
                        {isExternalLink && (
                            <ExternalLink style={{ width: 12, height: 12, opacity: 0.6 }} />
                        )}
                        {id === 'approval' && pendingCount > 0 && (
                            <span className="ad-nav-badge">{pendingCount}</span>
                        )}
                    </button>
                ))}
            </nav>

            {/* Footer */}
            <div className="ad-sidebar-footer">
                {/* Maintenance Mode */}
                <div className={`ad-maintenance-card ${maintenanceMode ? 'active' : ''}`}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 4 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <AlertTriangle style={{ width: 13, height: 13, color: maintenanceMode ? 'var(--ad-amber)' : 'var(--ad-text-3)' }} />
                            <span style={{
                                fontSize: 10,
                                fontWeight: 700,
                                textTransform: 'uppercase',
                                letterSpacing: '0.07em',
                                color: maintenanceMode ? 'var(--ad-amber)' : 'var(--ad-text-3)',
                            }}>
                                Maintenance
                            </span>
                        </div>
                        <button
                            className={`ad-toggle ${maintenanceMode ? 'on' : ''}`}
                            onClick={() => onToggleMaintenance(!maintenanceMode)}
                            aria-label="Toggle maintenance mode"
                        >
                            <div className="ad-toggle-knob" />
                        </button>
                    </div>
                    <p style={{ fontSize: 10, color: 'var(--ad-text-3)', lineHeight: 1.4 }}>
                        {maintenanceMode ? 'Site restricted to admins only.' : 'Live for all public users.'}
                    </p>
                </div>

                {/* Sign Out */}
                <button
                    className="ad-nav-item"
                    onClick={onLogout}
                    style={{ color: 'var(--ad-text-3)' }}
                    onMouseEnter={e => {
                        e.currentTarget.style.color = 'var(--ad-red)';
                        e.currentTarget.style.backgroundColor = 'var(--ad-red-glow)';
                    }}
                    onMouseLeave={e => {
                        e.currentTarget.style.color = 'var(--ad-text-3)';
                        e.currentTarget.style.backgroundColor = 'transparent';
                    }}
                >
                    <LogOut className="ad-nav-icon" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
