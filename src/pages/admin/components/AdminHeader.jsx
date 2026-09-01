import React from 'react';
import { RefreshCw, Sun, Moon, Menu } from 'lucide-react';

const TAB_LABELS = {
    overview: 'Overview',
    map: 'User Map',
    analytics: 'Analytics',
    libraries: 'Libraries',
    'adventure-content': 'Adventure Content',
    approval: 'Approvals',
    components: 'Custom Components',
    deployments: 'CI/CD Workflow',
    docker: 'Docker Monitoring',
    resources: 'Resource Budget',
    history: 'Security History',
    logs: 'System Logs',
};

const AdminHeader = ({ activeTab, onRefresh, onToggleSidebar, theme, onToggleTheme }) => {
    const [refreshing, setRefreshing] = React.useState(false);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            if (onRefresh) await onRefresh();
        } finally {
            setTimeout(() => setRefreshing(false), 600);
        }
    };

    return (
        <header className="ad-header">
            <div className="ad-header-left">
                {/* Mobile hamburger */}
                <button
                    className="ad-btn-icon lg:hidden"
                    onClick={onToggleSidebar}
                    aria-label="Open sidebar"
                >
                    <Menu />
                </button>

                <div>
                    <h1 className="ad-header-title">{TAB_LABELS[activeTab] ?? activeTab}</h1>
                    <p className="ad-header-subtitle">OpenHW Admin Console</p>
                </div>
            </div>

            <div className="ad-header-right">
                {/* Day / Night mode toggle */}
                <div className="ad-theme-toggle" role="group" aria-label="Theme">
                    <button
                        className={`ad-theme-btn ${theme === 'dark' ? 'active' : ''}`}
                        onClick={() => onToggleTheme('dark')}
                        title="Dark mode"
                    >
                        <Moon />
                        <span className="hidden sm:inline">Dark</span>
                    </button>
                    <button
                        className={`ad-theme-btn ${theme === 'light' ? 'active' : ''}`}
                        onClick={() => onToggleTheme('light')}
                        title="Light mode"
                    >
                        <Sun />
                        <span className="hidden sm:inline">Light</span>
                    </button>
                </div>

                {/* Refresh */}
                <button
                    className="ad-btn ad-btn-ghost"
                    onClick={handleRefresh}
                    title="Refresh data"
                >
                    <RefreshCw className={refreshing ? 'ad-spin' : ''} style={{ width: 13, height: 13 }} />
                    <span className="hidden sm:inline">Refresh</span>
                </button>
            </div>
        </header>
    );
};

export default AdminHeader;
