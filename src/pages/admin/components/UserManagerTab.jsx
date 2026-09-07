import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Users,
    Search,
    Shield,
    ShieldAlert,
    ShieldCheck,
    Clock,
    Trash2,
    Copy,
    Check,
    AlertTriangle,
    RefreshCw,
    GraduationCap,
    BookOpen,
    UserX,
    ChevronLeft,
    ChevronRight,
    Ban,
    X,
    UserCheck,
    AlertCircle,
    UserCog,
} from 'lucide-react';
import AdminCard from './AdminCard';
import {
    fetchAdminUsers,
    updateAdminUserRole,
    suspendAdminUser,
    unsuspendAdminUser,
    blockAdminUser,
    unblockAdminEmail,
    fetchAdminBlockedEmails,
    deleteAdminUserPermanently,
} from '../../../services/simulatorService';

export default function UserManagerTab({ showToast }) {
    // ─── State ──────────────────────────────────────────────────────────
    const [subTab, setSubTab] = useState('users'); // 'users' | 'blocked'
    const [users, setUsers] = useState([]);
    const [stats, setStats] = useState({
        total: 0,
        students: 0,
        teachers: 0,
        admins: 0,
        generalUsers: 0,
        suspended: 0,
        blocked: 0,
    });
    const [pagination, setPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
    const [loading, setLoading] = useState(false);

    // Filters
    const [search, setSearch] = useState('');
    const [debouncedSearch, setDebouncedSearch] = useState('');
    const [roleFilter, setRoleFilter] = useState('all');
    const [statusFilter, setStatusFilter] = useState('all');
    const [page, setPage] = useState(1);

    // Blocked list state
    const [blockedEmails, setBlockedEmails] = useState([]);
    const [blockedPagination, setBlockedPagination] = useState({ page: 1, limit: 10, total: 0, pages: 1 });
    const [blockedLoading, setBlockedLoading] = useState(false);
    const [blockedSearch, setBlockedSearch] = useState('');
    const [debouncedBlockedSearch, setDebouncedBlockedSearch] = useState('');
    const [blockedPage, setBlockedPage] = useState(1);

    // Copied feedback
    const [copiedEmail, setCopiedEmail] = useState(null);

    // Active modals
    const [roleModalUser, setRoleModalUser] = useState(null);
    const [suspendModalUser, setSuspendModalUser] = useState(null);
    const [blockModalUser, setBlockModalUser] = useState(null);
    const [unblockModalTarget, setUnblockModalTarget] = useState(null);
    const [deleteModalUser, setDeleteModalUser] = useState(null);

    // Operation in-progress
    const [actionLoading, setActionLoading] = useState(false);

    // Stable showToast ref to prevent re-render cascades
    const showToastRef = useRef(showToast);
    useEffect(() => {
        showToastRef.current = showToast;
    }, [showToast]);

    const notify = useCallback((type, message) => {
        if (typeof showToastRef.current === 'function') {
            showToastRef.current(message, type);
        }
    }, []);

    // Concurrency guards
    const isFetchingUsersRef = useRef(false);
    const isFetchingBlockedRef = useRef(false);

    // ─── Load Users ─────────────────────────────────────────────────────
    const loadUsers = useCallback(async () => {
        if (isFetchingUsersRef.current) return;
        isFetchingUsersRef.current = true;
        setLoading(true);
        try {
            const data = await fetchAdminUsers({
                page,
                limit: 10,
                search: debouncedSearch.trim() || undefined,
                role: roleFilter !== 'all' ? roleFilter : undefined,
                status: statusFilter !== 'all' ? statusFilter : undefined,
            });
            if (data?.success) {
                setUsers(data.users || []);
                setPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
                if (data.stats) {
                    setStats(data.stats);
                }
            }
        } catch (err) {
            console.error('[UserManagerTab] Error loading users:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to load users list.';
            notify('error', msg);
        } finally {
            setLoading(false);
            isFetchingUsersRef.current = false;
        }
    }, [page, debouncedSearch, roleFilter, statusFilter, notify]);

    // ─── Load Blocked Emails ────────────────────────────────────────────
    const loadBlockedEmails = useCallback(async () => {
        if (isFetchingBlockedRef.current) return;
        isFetchingBlockedRef.current = true;
        setBlockedLoading(true);
        try {
            const data = await fetchAdminBlockedEmails({
                page: blockedPage,
                limit: 10,
                search: debouncedBlockedSearch.trim() || undefined,
            });
            if (data?.success) {
                setBlockedEmails(data.blockedEmails || []);
                setBlockedPagination(data.pagination || { page: 1, limit: 10, total: 0, pages: 1 });
            }
        } catch (err) {
            console.error('[UserManagerTab] Error loading blocked list:', err);
            const msg = err.response?.data?.error || err.response?.data?.message || 'Failed to load blocked list.';
            notify('error', msg);
        } finally {
            setBlockedLoading(false);
            isFetchingBlockedRef.current = false;
        }
    }, [blockedPage, debouncedBlockedSearch, notify]);

    // Debounce search changes cleanly
    const searchTimeoutRef = useRef(null);
    const handleSearchChange = (val) => {
        setSearch(val);
        if (searchTimeoutRef.current) clearTimeout(searchTimeoutRef.current);
        searchTimeoutRef.current = setTimeout(() => {
            setDebouncedSearch(val);
            setPage(1);
        }, 400);
    };

    const blockedSearchTimeoutRef = useRef(null);
    const handleBlockedSearchChange = (val) => {
        setBlockedSearch(val);
        if (blockedSearchTimeoutRef.current) clearTimeout(blockedSearchTimeoutRef.current);
        blockedSearchTimeoutRef.current = setTimeout(() => {
            setDebouncedBlockedSearch(val);
            setBlockedPage(1);
        }, 400);
    };

    useEffect(() => {
        if (subTab === 'users') {
            loadUsers();
        }
    }, [subTab, loadUsers]);

    useEffect(() => {
        if (subTab === 'blocked') {
            loadBlockedEmails();
        }
    }, [subTab, loadBlockedEmails]);

    // ─── Copy Email Helper ──────────────────────────────────────────────
    const handleCopyEmail = (email) => {
        if (!email) return;
        navigator.clipboard.writeText(email);
        setCopiedEmail(email);
        setTimeout(() => setCopiedEmail(null), 1500);
    };

    // ─── Role Change ────────────────────────────────────────────────────
    const handleRoleSubmit = async (newRole) => {
        if (!roleModalUser) return;
        setActionLoading(true);
        try {
            const res = await updateAdminUserRole(roleModalUser._id, newRole);
            notify('success', res.message || `Role updated to ${newRole}.`);
            setRoleModalUser(null);
            loadUsers();
        } catch (err) {
            console.error('[UserManagerTab] Role update error:', err);
            notify('error', err.response?.data?.error || 'Failed to update user role.');
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Suspend / Unsuspend ────────────────────────────────────────────
    const handleSuspendSubmit = async (durationHours, untilDate, reason) => {
        if (!suspendModalUser) return;
        setActionLoading(true);
        try {
            const res = await suspendAdminUser(suspendModalUser._id, {
                durationHours,
                untilDate,
                reason,
            });
            notify('warning', res.message || 'User suspended successfully.');
            setSuspendModalUser(null);
            loadUsers();
        } catch (err) {
            console.error('[UserManagerTab] Suspend error:', err);
            notify('error', err.response?.data?.error || 'Failed to suspend user.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleQuickUnsuspend = async (user) => {
        setActionLoading(true);
        try {
            const res = await unsuspendAdminUser(user._id);
            notify('success', res.message || 'Suspension lifted successfully.');
            loadUsers();
        } catch (err) {
            console.error('[UserManagerTab] Unsuspend error:', err);
            notify('error', err.response?.data?.error || 'Failed to lift suspension.');
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Block / Unblock ────────────────────────────────────────────────
    const handleBlockSubmit = async (reason) => {
        if (!blockModalUser) return;
        setActionLoading(true);
        try {
            const res = await blockAdminUser(blockModalUser._id, { reason });
            notify('error', res.message || 'User and email address have been blocked.');
            setBlockModalUser(null);
            loadUsers();
            if (subTab === 'blocked') loadBlockedEmails();
        } catch (err) {
            console.error('[UserManagerTab] Block error:', err);
            notify('error', err.response?.data?.error || 'Failed to block user.');
        } finally {
            setActionLoading(false);
        }
    };

    const handleUnblockSubmit = async () => {
        if (!unblockModalTarget) return;
        setActionLoading(true);
        try {
            const res = await unblockAdminEmail({
                email: unblockModalTarget.email,
                userId: unblockModalTarget.userId,
            });
            notify('success', res.message || 'Email unblocked successfully.');
            setUnblockModalTarget(null);
            loadUsers();
            loadBlockedEmails();
        } catch (err) {
            console.error('[UserManagerTab] Unblock error:', err);
            notify('error', err.response?.data?.error || 'Failed to unblock email.');
        } finally {
            setActionLoading(false);
        }
    };

    // ─── Permanent Deletion ─────────────────────────────────────────────
    const handleDeleteSubmit = async () => {
        if (!deleteModalUser) return;
        setActionLoading(true);
        try {
            const res = await deleteAdminUserPermanently(deleteModalUser._id);
            const extraNote = res.emailRemainsBlocked ? ' (Email remains blocked)' : '';
            notify('success', (res.message || 'User permanently deleted.') + extraNote);
            setDeleteModalUser(null);
            loadUsers();
            if (subTab === 'blocked') loadBlockedEmails();
        } catch (err) {
            console.error('[UserManagerTab] Delete error:', err);
            notify('error', err.response?.data?.error || 'Failed to delete user.');
        } finally {
            setActionLoading(false);
        }
    };

    // Format helpers
    const getInitials = (name = '') => {
        if (!name) return 'U';
        const parts = name.trim().split(' ');
        return parts.length > 1
            ? (parts[0][0] + parts[1][0]).toUpperCase()
            : parts[0].slice(0, 2).toUpperCase();
    };

    const formatDate = (dateStr) => {
        if (!dateStr) return '—';
        const d = new Date(dateStr);
        if (isNaN(d.getTime())) return '—';
        return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
    };

    return (
        <div className="ad-space-y-6 ad-fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
            {/* ── 1. Summary Stat Cards ────────────────────────────────────── */}
            <div className="ad-grid-3" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))' }}>
                {[
                    { label: 'Total Registered', value: stats.total, icon: Users, color: 'blue' },
                    { label: 'Students', value: stats.students, icon: GraduationCap, color: 'cyan' },
                    { label: 'Teachers', value: stats.teachers, icon: BookOpen, color: 'emerald' },
                    { label: 'Administrators', value: stats.admins, icon: ShieldCheck, color: 'purple' },
                    { label: 'Suspended', value: stats.suspended, icon: Clock, color: 'amber' },
                    { label: 'Blocked Emails', value: stats.blocked, icon: Ban, color: 'red' },
                ].map((s, i) => (
                    <div key={i} className={`ad-stat-card ${s.color}`}>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                            <span className="ad-stat-label">{s.label}</span>
                            <div className={`ad-stat-icon ${s.color}`}><s.icon /></div>
                        </div>
                        <div className="ad-stat-value" style={{ marginTop: 8 }}>{s.value}</div>
                    </div>
                ))}
            </div>

            {/* ── 2. Navigation & Controls Bar ─────────────────────────────── */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
                {/* Sub-tabs */}
                <div className="ad-segmented">
                    <button
                        className={`ad-segment-btn ${subTab === 'users' ? 'active' : ''}`}
                        onClick={() => { setSubTab('users'); setPage(1); }}
                    >
                        <Users style={{ width: 13, height: 13, display: 'inline', marginRight: 5 }} />
                        All Users
                    </button>
                    <button
                        className={`ad-segment-btn ${subTab === 'blocked' ? 'active' : ''}`}
                        onClick={() => { setSubTab('blocked'); setBlockedPage(1); }}
                    >
                        <Ban style={{ width: 13, height: 13, display: 'inline', marginRight: 5 }} />
                        Blocked List ({stats.blocked})
                    </button>
                </div>

                {/* Right controls: Refresh */}
                <button
                    className="ad-btn ad-btn-ghost"
                    onClick={() => {
                        if (subTab === 'users') loadUsers();
                        else loadBlockedEmails();
                    }}
                    title="Refresh data"
                >
                    <RefreshCw className={loading || blockedLoading ? 'animate-spin' : ''} />
                    Refresh
                </button>
            </div>

            {/* ── 3. Sub-View: All Users ───────────────────────────────────── */}
            {subTab === 'users' && (
                <AdminCard className="p-0">
                    {/* Search & Filters Header */}
                    <div className="ad-card-header" style={{ flexWrap: 'wrap', gap: 12, padding: '12px 16px' }}>
                        <div className="ad-input-icon" style={{ flex: 1, minWidth: 220 }}>
                            <Search />
                            <input
                                type="text"
                                className="ad-input"
                                placeholder="Search by name, email, or username..."
                                value={search}
                                onChange={(e) => handleSearchChange(e.target.value)}
                            />
                        </div>

                        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                            {/* Role Filter */}
                            <select
                                className="ad-input"
                                style={{ width: 'auto', minWidth: 120, cursor: 'pointer' }}
                                value={roleFilter}
                                onChange={(e) => { setRoleFilter(e.target.value); setPage(1); }}
                            >
                                <option value="all">All Roles</option>
                                <option value="student">Students</option>
                                <option value="teacher">Teachers</option>
                                <option value="admin">Admins</option>
                                <option value="user">General Users</option>
                            </select>

                            {/* Status Filter */}
                            <select
                                className="ad-input"
                                style={{ width: 'auto', minWidth: 130, cursor: 'pointer' }}
                                value={statusFilter}
                                onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
                            >
                                <option value="all">All Status</option>
                                <option value="active">Active</option>
                                <option value="suspended">Suspended</option>
                                <option value="blocked">Blocked</option>
                                <option value="pending_deletion">Pending Deletion</option>
                            </select>
                        </div>
                    </div>

                    {/* Table Area */}
                    <div className="ad-table-wrap">
                        <table className="ad-table">
                            <thead>
                                <tr>
                                    <th>User</th>
                                    <th>Email Address</th>
                                    <th>Role</th>
                                    <th>Status</th>
                                    <th>Joined</th>
                                    <th style={{ textAlign: 'right' }}>Actions</th>
                                </tr>
                            </thead>
                            <tbody>
                                {loading ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ad-text-3)' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <RefreshCw className="animate-spin" style={{ width: 16, height: 16 }} />
                                                Loading user records...
                                            </div>
                                        </td>
                                    </tr>
                                ) : users.length === 0 ? (
                                    <tr>
                                        <td colSpan="6" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--ad-text-3)' }}>
                                            <UserX style={{ width: 32, height: 32, margin: '0 auto 10px', opacity: 0.5 }} />
                                            <div style={{ fontWeight: 600, color: 'var(--ad-text-2)' }}>No matching users found</div>
                                            <div style={{ fontSize: 11, marginTop: 4 }}>Try clearing search or filters to see more results.</div>
                                        </td>
                                    </tr>
                                ) : (
                                    users.map((u) => {
                                        const isBlocked = u.isBlocked || u.status === 'blocked';
                                        const isSuspended = u.status === 'suspended';
                                        const isPendingDeletion = u.status === 'pending_deletion';

                                        return (
                                            <tr key={u._id}>
                                                {/* User Info */}
                                                <td className="primary">
                                                    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                                                        <div
                                                            style={{
                                                                width: 32,
                                                                height: 32,
                                                                borderRadius: '50%',
                                                                background: 'var(--ad-surface-3)',
                                                                border: '1px solid var(--ad-border-2)',
                                                                display: 'flex',
                                                                alignItems: 'center',
                                                                justifyContent: 'center',
                                                                fontWeight: 700,
                                                                fontSize: 11,
                                                                color: 'var(--ad-text)',
                                                                flexShrink: 0,
                                                            }}
                                                        >
                                                            {getInitials(u.name)}
                                                        </div>
                                                        <div style={{ minWidth: 0 }}>
                                                            <div style={{ fontWeight: 600, color: 'var(--ad-text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                                {u.name || 'Anonymous User'}
                                                            </div>
                                                            {u.username && (
                                                                <div style={{ fontSize: 11, color: 'var(--ad-text-3)' }}>
                                                                    @{u.username}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </td>

                                                {/* Email Address with Copy */}
                                                <td>
                                                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                        <span style={{ fontFamily: 'monospace', fontSize: 12, color: 'var(--ad-text-2)' }}>
                                                            {u.email || '—'}
                                                        </span>
                                                        {u.email && (
                                                            <button
                                                                className="ad-btn-icon"
                                                                style={{ padding: 4, width: 22, height: 22 }}
                                                                onClick={() => handleCopyEmail(u.email)}
                                                                title="Copy email"
                                                            >
                                                                {copiedEmail === u.email ? (
                                                                    <Check style={{ width: 12, height: 12, color: 'var(--ad-emerald)' }} />
                                                                ) : (
                                                                    <Copy style={{ width: 12, height: 12 }} />
                                                                )}
                                                            </button>
                                                        )}
                                                    </div>
                                                </td>

                                                {/* Role Badge */}
                                                <td>
                                                    <span className={`ad-badge ${
                                                        u.role === 'admin' ? 'purple' :
                                                        u.role === 'teacher' ? 'success' :
                                                        u.role === 'student' ? 'blue' : 'offline'
                                                    }`}>
                                                        {u.role ? u.role.toUpperCase() : 'USER'}
                                                    </span>
                                                </td>

                                                {/* Status Badge */}
                                                <td>
                                                    {isBlocked ? (
                                                        <span className="ad-badge error" title={u.blockReason ? `Reason: ${u.blockReason}` : 'Blocked by admin'}>
                                                            <span className="ad-badge-dot" />
                                                            BLOCKED
                                                        </span>
                                                    ) : isSuspended ? (
                                                        <span
                                                            className="ad-badge warning"
                                                            title={u.suspendedUntil ? `Suspended until: ${new Date(u.suspendedUntil).toLocaleString()}` : 'Suspended'}
                                                        >
                                                            <span className="ad-badge-dot pulse" />
                                                            SUSPENDED
                                                        </span>
                                                    ) : isPendingDeletion ? (
                                                        <span className="ad-badge offline" title="Scheduled for permanent purge">
                                                            <span className="ad-badge-dot" />
                                                            PENDING DELETION
                                                        </span>
                                                    ) : (
                                                        <span className="ad-badge success">
                                                            <span className="ad-badge-dot" />
                                                            ACTIVE
                                                        </span>
                                                    )}
                                                </td>

                                                {/* Joined Date */}
                                                <td style={{ fontSize: 11, color: 'var(--ad-text-3)', whiteSpace: 'nowrap' }}>
                                                    {formatDate(u.createdAt)}
                                                </td>

                                                {/* Actions */}
                                                <td>
                                                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 6 }}>
                                                        {/* Role Change */}
                                                        <button
                                                            className="ad-btn ad-btn-ghost"
                                                            style={{ padding: '5px 8px', fontSize: 11 }}
                                                            onClick={() => setRoleModalUser(u)}
                                                            title="Change user role"
                                                        >
                                                            <UserCog style={{ width: 12, height: 12 }} />
                                                            Role
                                                        </button>

                                                        {/* Suspend / Unsuspend */}
                                                        {isSuspended ? (
                                                            <button
                                                                className="ad-btn"
                                                                style={{ padding: '5px 8px', fontSize: 11, background: 'var(--ad-emerald-glow)', color: 'var(--ad-emerald)', borderColor: 'var(--ad-emerald)' }}
                                                                onClick={() => handleQuickUnsuspend(u)}
                                                                title="Lift suspension immediately"
                                                            >
                                                                <UserCheck style={{ width: 12, height: 12 }} />
                                                                Restore
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="ad-btn ad-btn-ghost"
                                                                style={{ padding: '5px 8px', fontSize: 11 }}
                                                                onClick={() => setSuspendModalUser(u)}
                                                                title="Temporarily suspend user account"
                                                                disabled={isBlocked}
                                                            >
                                                                <Clock style={{ width: 12, height: 12 }} />
                                                                Suspend
                                                            </button>
                                                        )}

                                                        {/* Block / Unblock */}
                                                        {isBlocked ? (
                                                            <button
                                                                className="ad-btn"
                                                                style={{ padding: '5px 8px', fontSize: 11, background: 'var(--ad-cyan-glow)', color: 'var(--ad-cyan)', borderColor: 'var(--ad-cyan)' }}
                                                                onClick={() => setUnblockModalTarget({ email: u.email, userId: u._id, name: u.name })}
                                                                title="Unblock user and email"
                                                            >
                                                                <ShieldCheck style={{ width: 12, height: 12 }} />
                                                                Unblock
                                                            </button>
                                                        ) : (
                                                            <button
                                                                className="ad-btn ad-btn-ghost"
                                                                style={{ padding: '5px 8px', fontSize: 11, color: 'var(--ad-red)' }}
                                                                onClick={() => setBlockModalUser(u)}
                                                                title="Block email and prevent sign in / re-registration"
                                                            >
                                                                <Ban style={{ width: 12, height: 12 }} />
                                                                Block
                                                            </button>
                                                        )}

                                                        {/* Delete Permanently */}
                                                        <button
                                                            className="ad-btn-icon"
                                                            style={{ width: 28, height: 28, color: 'var(--ad-red)' }}
                                                            onClick={() => setDeleteModalUser(u)}
                                                            title="Permanently delete user"
                                                        >
                                                            <Trash2 style={{ width: 13, height: 13 }} />
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })
                                )}
                            </tbody>
                        </table>
                    </div>

                    {/* Pagination Footer */}
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--ad-border)', fontSize: 11, color: 'var(--ad-text-3)' }}>
                        <div>
                            Showing {users.length > 0 ? (pagination.page - 1) * pagination.limit + 1 : 0} to{' '}
                            {Math.min(pagination.page * pagination.limit, pagination.total)} of {pagination.total} users
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                                className="ad-btn-icon"
                                disabled={pagination.page <= 1}
                                onClick={() => setPage(p => Math.max(1, p - 1))}
                            >
                                <ChevronLeft />
                            </button>
                            <span>Page {pagination.page} of {pagination.pages}</span>
                            <button
                                className="ad-btn-icon"
                                disabled={pagination.page >= pagination.pages}
                                onClick={() => setPage(p => Math.min(pagination.pages, p + 1))}
                            >
                                <ChevronRight />
                            </button>
                        </div>
                    </div>
                </AdminCard>
            )}

            {/* ── 4. Sub-View: Persistent Blocked List ─────────────────────── */}
            {subTab === 'blocked' && (
                <AdminCard className="p-0">
                    <div className="ad-card-header" style={{ padding: '12px 16px' }}>
                        <div className="ad-input-icon" style={{ flex: 1, minWidth: 240 }}>
                            <Search />
                            <input
                                type="text"
                                className="ad-input"
                                placeholder="Search blocked emails, reasons, or user names..."
                                value={blockedSearch}
                                onChange={(e) => handleBlockedSearchChange(e.target.value)}
                            />
                        </div>
                    </div>

                    <div className="ad-table-wrap">
                        <table className="ad-table">
                            <thead>
                                <tr>
                                    <th>Blocked Email</th>
                                    <th>Original User</th>
                                    <th>Account Status</th>
                                    <th>Block Reason</th>
                                    <th>Blocked Date</th>
                                    <th>Blocked By</th>
                                    <th style={{ textAlign: 'right' }}>Action</th>
                                </tr>
                            </thead>
                            <tbody>
                                {blockedLoading ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '40px 16px', color: 'var(--ad-text-3)' }}>
                                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                                                <RefreshCw className="animate-spin" style={{ width: 16, height: 16 }} />
                                                Loading blocked list...
                                            </div>
                                        </td>
                                    </tr>
                                ) : blockedEmails.length === 0 ? (
                                    <tr>
                                        <td colSpan="7" style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--ad-text-3)' }}>
                                            <ShieldCheck style={{ width: 32, height: 32, margin: '0 auto 10px', color: 'var(--ad-emerald)' }} />
                                            <div style={{ fontWeight: 600, color: 'var(--ad-text)' }}>No blocked emails</div>
                                            <div style={{ fontSize: 11, color: 'var(--ad-text-3)', marginTop: 4 }}>
                                                No email addresses are currently restricted on the platform.
                                            </div>
                                        </td>
                                    </tr>
                                ) : (
                                    blockedEmails.map((item) => (
                                        <tr key={item._id}>
                                            <td className="primary">
                                                <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                                                    <span style={{ fontFamily: 'monospace', fontWeight: 700, color: 'var(--ad-red)' }}>
                                                        {item.email}
                                                    </span>
                                                    <button
                                                        className="ad-btn-icon"
                                                        style={{ padding: 4, width: 22, height: 22 }}
                                                        onClick={() => handleCopyEmail(item.email)}
                                                        title="Copy email"
                                                    >
                                                        {copiedEmail === item.email ? (
                                                            <Check style={{ width: 12, height: 12, color: 'var(--ad-emerald)' }} />
                                                        ) : (
                                                            <Copy style={{ width: 12, height: 12 }} />
                                                        )}
                                                    </button>
                                                </div>
                                            </td>
                                            <td>
                                                <span style={{ fontWeight: 600, color: 'var(--ad-text-2)' }}>
                                                    {item.originalUserName || '—'}
                                                </span>
                                            </td>
                                            <td>
                                                {item.accountExists ? (
                                                    <span className="ad-badge warning">
                                                        <span className="ad-badge-dot" />
                                                        Account Exists (Blocked)
                                                    </span>
                                                ) : (
                                                    <span className="ad-badge offline" title="User account document was deleted; email remains blocked">
                                                        <span className="ad-badge-dot" />
                                                        Account Deleted
                                                    </span>
                                                )}
                                            </td>
                                            <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                <span title={item.reason} style={{ color: 'var(--ad-text-2)' }}>
                                                    {item.reason || 'Violation of terms'}
                                                </span>
                                            </td>
                                            <td style={{ fontSize: 11, color: 'var(--ad-text-3)', whiteSpace: 'nowrap' }}>
                                                {formatDate(item.blockedAt)}
                                            </td>
                                            <td style={{ fontSize: 11, color: 'var(--ad-text-3)' }}>
                                                {item.blockedByName || 'Admin'}
                                            </td>
                                            <td style={{ textAlign: 'right' }}>
                                                <button
                                                    className="ad-btn ad-btn-primary"
                                                    style={{ padding: '5px 10px', fontSize: 11 }}
                                                    onClick={() => setUnblockModalTarget({ email: item.email, userId: item.currentUserId, name: item.originalUserName })}
                                                    title="Remove restriction and allow access or new registration"
                                                >
                                                    <ShieldCheck style={{ width: 12, height: 12 }} />
                                                    Unblock
                                                </button>
                                            </td>
                                        </tr>
                                    ))
                                )}
                            </tbody>
                        </table>
                    </div>

                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderTop: '1px solid var(--ad-border)', fontSize: 11, color: 'var(--ad-text-3)' }}>
                        <div>
                            Showing {blockedEmails.length > 0 ? (blockedPagination.page - 1) * blockedPagination.limit + 1 : 0} to{' '}
                            {Math.min(blockedPagination.page * blockedPagination.limit, blockedPagination.total)} of {blockedPagination.total} blocked records
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                            <button
                                className="ad-btn-icon"
                                disabled={blockedPagination.page <= 1}
                                onClick={() => setBlockedPage(p => Math.max(1, p - 1))}
                            >
                                <ChevronLeft />
                            </button>
                            <span>Page {blockedPagination.page} of {blockedPagination.pages}</span>
                            <button
                                className="ad-btn-icon"
                                disabled={blockedPagination.page >= blockedPagination.pages}
                                onClick={() => setBlockedPage(p => Math.min(blockedPagination.pages, p + 1))}
                            >
                                <ChevronRight />
                            </button>
                        </div>
                    </div>
                </AdminCard>
            )}

            {/* ═══════════════════════════════════════════════════════════════
                 MODALS
               ═══════════════════════════════════════════════════════════════ */}

            {/* ── Modal 1: Role Change ─────────────────────────────────────── */}
            {roleModalUser && (
                <div className="ad-modal-overlay">
                    <div className="ad-modal-box">
                        <div className="ad-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <UserCog style={{ width: 18, height: 18, color: 'var(--ad-accent)' }} />
                                <span className="ad-modal-title">Change User Role</span>
                            </div>
                            <button className="ad-btn-icon" onClick={() => setRoleModalUser(null)}>
                                <X />
                            </button>
                        </div>
                        <div className="ad-modal-body">
                            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ad-text-2)' }}>
                                Updating role for <strong style={{ color: 'var(--ad-text)' }}>{roleModalUser.name}</strong> ({roleModalUser.email}).
                            </p>

                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ad-text-3)', marginBottom: 6, textTransform: 'uppercase' }}>
                                Select New Assigned Role
                            </label>
                            <select
                                id="new-role-select"
                                className="ad-input"
                                defaultValue={roleModalUser.role || 'user'}
                                style={{ marginBottom: 16 }}
                            >
                                <option value="student">Student (Classroom access & assignments)</option>
                                <option value="teacher">Teacher (Class creation & grading)</option>
                                <option value="admin">Administrator (Full console privileges)</option>
                                <option value="user">General User (Simulator & profile access)</option>
                            </select>

                            <div style={{ background: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)', borderRadius: 9, padding: '12px 14px', display: 'flex', gap: 10 }}>
                                <AlertCircle style={{ width: 16, height: 16, color: 'var(--ad-cyan)', flexShrink: 0, marginTop: 2 }} />
                                <div style={{ fontSize: 12, color: 'var(--ad-text-2)', lineHeight: 1.5 }}>
                                    An automated notification email will be dispatched informing the user that their role and platform permissions have been updated.
                                </div>
                            </div>
                        </div>
                        <div className="ad-modal-footer">
                            <button className="ad-btn ad-btn-ghost" onClick={() => setRoleModalUser(null)} disabled={actionLoading}>
                                Cancel
                            </button>
                            <button
                                className="ad-btn ad-btn-primary"
                                disabled={actionLoading}
                                onClick={() => {
                                    const select = document.getElementById('new-role-select');
                                    if (select) handleRoleSubmit(select.value);
                                }}
                            >
                                {actionLoading ? 'Updating...' : 'Save Role'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal 2: Suspend Account ─────────────────────────────────── */}
            {suspendModalUser && (
                <SuspendUserModal
                    user={suspendModalUser}
                    loading={actionLoading}
                    onClose={() => setSuspendModalUser(null)}
                    onSubmit={handleSuspendSubmit}
                />
            )}

            {/* ── Modal 3: Block User & Email ──────────────────────────────── */}
            {blockModalUser && (
                <div className="ad-modal-overlay">
                    <div className="ad-modal-box">
                        <div className="ad-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Ban style={{ width: 18, height: 18, color: 'var(--ad-red)' }} />
                                <span className="ad-modal-title" style={{ color: 'var(--ad-red)' }}>Block User & Email</span>
                            </div>
                            <button className="ad-btn-icon" onClick={() => setBlockModalUser(null)}>
                                <X />
                            </button>
                        </div>
                        <div className="ad-modal-body">
                            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ad-text-2)' }}>
                                You are about to block <strong style={{ color: 'var(--ad-text)' }}>{blockModalUser.name}</strong> ({blockModalUser.email}).
                            </p>

                            <div style={{ background: 'var(--ad-red-glow)', border: '1px solid var(--ad-red)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ad-red)', marginBottom: 4, display: 'flex', alignItems: 'center', gap: 6 }}>
                                    <AlertTriangle style={{ width: 14, height: 14 }} />
                                    Important Block Policy:
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--ad-text-2)', lineHeight: 1.6 }}>
                                    <li><strong>Account is not deleted:</strong> User records remain intact for administrative inspection.</li>
                                    <li><strong>Sign-in is blocked:</strong> Existing sessions and future logins will be rejected immediately.</li>
                                    <li><strong>Persistent blocklist:</strong> If this account is deleted in the future, the email <strong>will remain permanently blocked</strong> from registering on this platform until an administrator unblocks it.</li>
                                </ul>
                            </div>

                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ad-text-3)', marginBottom: 6, textTransform: 'uppercase' }}>
                                Reason for Block
                            </label>
                            <input
                                id="block-reason-input"
                                type="text"
                                className="ad-input"
                                defaultValue="Violation of platform terms of service"
                                placeholder="Enter specific reason for blocking..."
                            />
                        </div>
                        <div className="ad-modal-footer">
                            <button className="ad-btn ad-btn-ghost" onClick={() => setBlockModalUser(null)} disabled={actionLoading}>
                                Cancel
                            </button>
                            <button
                                className="ad-btn ad-btn-danger"
                                disabled={actionLoading}
                                onClick={() => {
                                    const input = document.getElementById('block-reason-input');
                                    handleBlockSubmit(input ? input.value : undefined);
                                }}
                            >
                                {actionLoading ? 'Blocking...' : 'Block Account & Email'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal 4: Unblock Email ───────────────────────────────────── */}
            {unblockModalTarget && (
                <div className="ad-modal-overlay">
                    <div className="ad-modal-box">
                        <div className="ad-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <ShieldCheck style={{ width: 18, height: 18, color: 'var(--ad-emerald)' }} />
                                <span className="ad-modal-title">Unblock Email Address</span>
                            </div>
                            <button className="ad-btn-icon" onClick={() => setUnblockModalTarget(null)}>
                                <X />
                            </button>
                        </div>
                        <div className="ad-modal-body">
                            <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ad-text-2)' }}>
                                Are you sure you want to lift the block on:
                            </p>
                            <div style={{ background: 'var(--ad-surface-2)', border: '1px solid var(--ad-border)', borderRadius: 8, padding: '12px 14px', marginBottom: 16 }}>
                                <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: 14, color: 'var(--ad-accent)' }}>
                                    {unblockModalTarget.email}
                                </div>
                                {unblockModalTarget.name && (
                                    <div style={{ fontSize: 11, color: 'var(--ad-text-3)', marginTop: 4 }}>
                                        Registered to: {unblockModalTarget.name}
                                    </div>
                                )}
                            </div>
                            <p style={{ margin: 0, fontSize: 12, color: 'var(--ad-text-3)', lineHeight: 1.5 }}>
                                Lifting the block will allow this email to sign in (if an account exists) or register a new account on OpenHW Studio. An unblock confirmation email will be sent.
                            </p>
                        </div>
                        <div className="ad-modal-footer">
                            <button className="ad-btn ad-btn-ghost" onClick={() => setUnblockModalTarget(null)} disabled={actionLoading}>
                                Cancel
                            </button>
                            <button
                                className="ad-btn ad-btn-primary"
                                disabled={actionLoading}
                                onClick={handleUnblockSubmit}
                            >
                                {actionLoading ? 'Unblocking...' : 'Confirm Unblock'}
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Modal 5: Permanent Deletion ──────────────────────────────── */}
            {deleteModalUser && (
                <div className="ad-modal-overlay">
                    <div className="ad-modal-box">
                        <div className="ad-modal-header">
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <Trash2 style={{ width: 18, height: 18, color: 'var(--ad-red)' }} />
                                <span className="ad-modal-title" style={{ color: 'var(--ad-red)' }}>Permanently Delete User</span>
                            </div>
                            <button className="ad-btn-icon" onClick={() => setDeleteModalUser(null)}>
                                <X />
                            </button>
                        </div>
                        <div className="ad-modal-body">
                            <p style={{ margin: '0 0 12px', fontSize: 13, color: 'var(--ad-text-2)' }}>
                                You are about to permanently delete <strong style={{ color: 'var(--ad-text)' }}>{deleteModalUser.name}</strong> ({deleteModalUser.email}).
                            </p>

                            <div style={{ background: 'var(--ad-red-glow)', border: '1px solid var(--ad-red)', borderRadius: 9, padding: '12px 14px', marginBottom: 16 }}>
                                <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--ad-red)', marginBottom: 4 }}>
                                    Warning: This action cannot be undone!
                                </div>
                                <ul style={{ margin: 0, paddingLeft: 18, fontSize: 11, color: 'var(--ad-text-2)', lineHeight: 1.6 }}>
                                    <li>User account profile and credentials will be purged immediately.</li>
                                    <li>Classroom enrollments, student submissions, and progress records will be deleted.</li>
                                    {deleteModalUser.isBlocked || deleteModalUser.status === 'blocked' ? (
                                        <li style={{ color: 'var(--ad-amber)', fontWeight: 700 }}>
                                            Note: This account is BLOCKED. Even after deletion, this email will REMAIN in the blocklist and cannot re-register unless unblocked.
                                        </li>
                                    ) : (
                                        <li>Since this account is not blocked, this email address will be free to create a new account in the future.</li>
                                    )}
                                </ul>
                            </div>
                        </div>
                        <div className="ad-modal-footer">
                            <button className="ad-btn ad-btn-ghost" onClick={() => setDeleteModalUser(null)} disabled={actionLoading}>
                                Cancel
                            </button>
                            <button
                                className="ad-btn ad-btn-danger"
                                disabled={actionLoading}
                                onClick={handleDeleteSubmit}
                            >
                                {actionLoading ? 'Deleting...' : 'Permanently Purge Account'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

// ─── Sub-Component: Suspend Modal with Duration Presets ───────────────────────
function SuspendUserModal({ user, loading, onClose, onSubmit }) {
    const [preset, setPreset] = useState('24h');
    const [customDate, setCustomDate] = useState('');
    const [reason, setReason] = useState('Violation of community standards');

    const handleConfirm = () => {
        let durationHours = null;
        let untilDate = null;

        if (preset === '24h') durationHours = 24;
        else if (preset === '3d') durationHours = 72;
        else if (preset === '7d') durationHours = 168;
        else if (preset === '30d') durationHours = 720;
        else if (preset === 'custom') untilDate = customDate;
        else if (preset === 'indefinite') durationHours = null;

        onSubmit(durationHours, untilDate, reason);
    };

    return (
        <div className="ad-modal-overlay">
            <div className="ad-modal-box">
                <div className="ad-modal-header">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <Clock style={{ width: 18, height: 18, color: 'var(--ad-amber)' }} />
                        <span className="ad-modal-title">Suspend User Account</span>
                    </div>
                    <button className="ad-btn-icon" onClick={onClose}>
                        <X />
                    </button>
                </div>
                <div className="ad-modal-body">
                    <p style={{ margin: '0 0 14px', fontSize: 13, color: 'var(--ad-text-2)' }}>
                        Suspend access for <strong style={{ color: 'var(--ad-text)' }}>{user.name}</strong> ({user.email}).
                    </p>

                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ad-text-3)', marginBottom: 6, textTransform: 'uppercase' }}>
                        Suspension Duration
                    </label>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 6, marginBottom: 14 }}>
                        {[
                            { id: '24h', label: '24 Hours' },
                            { id: '3d', label: '3 Days' },
                            { id: '7d', label: '7 Days' },
                            { id: '30d', label: '30 Days' },
                            { id: 'custom', label: 'Custom Date' },
                            { id: 'indefinite', label: 'Indefinite' },
                        ].map((p) => (
                            <button
                                key={p.id}
                                type="button"
                                className={`ad-btn ${preset === p.id ? 'ad-btn-primary' : 'ad-btn-ghost'}`}
                                style={{ justifyContent: 'center', fontSize: 11, padding: '7px 4px' }}
                                onClick={() => setPreset(p.id)}
                            >
                                {p.label}
                            </button>
                        ))}
                    </div>

                    {preset === 'custom' && (
                        <div style={{ marginBottom: 14 }}>
                            <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ad-text-3)', marginBottom: 4, textTransform: 'uppercase' }}>
                                Resume Date & Time
                            </label>
                            <input
                                type="datetime-local"
                                className="ad-input"
                                value={customDate}
                                onChange={(e) => setCustomDate(e.target.value)}
                            />
                        </div>
                    )}

                    <label style={{ display: 'block', fontSize: 11, fontWeight: 700, color: 'var(--ad-text-3)', marginBottom: 6, textTransform: 'uppercase' }}>
                        Reason for Suspension
                    </label>
                    <textarea
                        className="ad-input"
                        style={{ minHeight: 60, resize: 'vertical' }}
                        value={reason}
                        onChange={(e) => setReason(e.target.value)}
                        placeholder="Provide details regarding the suspension..."
                    />

                    <div style={{ marginTop: 12, fontSize: 11, color: 'var(--ad-text-3)' }}>
                        A suspension notice email with details and expected reactivation date will be dispatched automatically.
                    </div>
                </div>
                <div className="ad-modal-footer">
                    <button className="ad-btn ad-btn-ghost" onClick={onClose} disabled={loading}>
                        Cancel
                    </button>
                    <button className="ad-btn ad-btn-primary" onClick={handleConfirm} disabled={loading}>
                        {loading ? 'Suspending...' : 'Confirm Suspension'}
                    </button>
                </div>
            </div>
        </div>
    );
}
