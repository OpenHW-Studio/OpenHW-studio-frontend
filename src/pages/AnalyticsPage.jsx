import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { RefreshCw, ArrowLeft, Download } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar.jsx';
import { fetchPublicAnalytics } from '../services/simulatorService.js';
import './AnalyticsPage.css';

/**
 * AnalyticsPage — public standalone page at /analytics.
 *
 * "Lab ledger" design: a bench-notebook snapshot of community growth and
 * platform use. One ruled ledger sheet carries the headline community
 * total; everything else is quiet ink-on-paper ledger rows and hand-drawn
 * SVG figures. No admin chrome, no Leaflet map, no per-session data.
 *
 * Data: GET /api/public/analytics (no auth). The backend serves a sanitized
 * subset — visitorList (raw IPs, sessionIds, userAgents, exact coords,
 * first/last seen), regions (lat/lng + IP sets) and browserStats are
 * stripped server-side. The admin dashboard tabs ('map' + 'analytics')
 * are untouched and keep full detail.
 */

const ROLE_ORDER = [
    { key: 'student', label: 'Students' },
    { key: 'teacher', label: 'Teachers' },
    { key: 'user', label: 'General users' },
];

const TIMEFRAMES = [
    { id: 'allTime', label: 'All time', days: 30 },
    { id: 'month', label: 'Month', days: 30 },
    { id: 'week', label: 'Week', days: 7 },
    { id: 'today', label: 'Today', days: 1 },
];

const windowLabel = (id) => {
    if (id === 'today') return `for the latest day`;
    if (id === 'week') return `across the last 7 days`;
    return `across the last 30 days`;
};

const RANGE_IDS = ['allTime', 'month', 'week', 'today'];

const readRangeParam = (params, key, fallback) => {
    const v = params.get(key);
    return RANGE_IDS.includes(v) ? v : fallback;
};

const downloadCsv = (filename, rows) => {
    const esc = (v) => {
        const s = String(v ?? '');
        return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
    };
    const csv = rows.map((r) => r.map(esc).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
};

const fmtInt = (n) => {
    const v = Number(n);
    if (!Number.isFinite(v)) return '0';
    return v.toLocaleString('en-US');
};

const shortDate = (iso) => {
    if (!iso) return '';
    const d = new Date(`${iso}T00:00:00`);
    if (Number.isNaN(d.getTime())) return String(iso).slice(5);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

/* Ink line chart: two series over the visitor timeline. Pure SVG so the
   page stays dependency-free and prints like a notebook figure. */
function TrafficFigure({ points, rangeLabel }) {
    const W = 920;
    const H = 260;
    const PAD = { l: 44, r: 12, t: 14, b: 34 };
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;

    const max = Math.max(1, ...points.map((p) => Math.max(p.visitors, p.hits)));
    const nice = Math.max(1, Math.ceil(max / 4));
    const ticks = [0, 1, 2, 3, 4].map((i) => i * nice);

    const x = (i) => (points.length <= 1 ? PAD.l : PAD.l + (i / (points.length - 1)) * iw);
    const y = (v) => PAD.t + ih - (v / (nice * 4)) * ih;

    const line = (key) =>
        points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p[key]).toFixed(1)}`).join(' ');

    const area = (key, base) =>
        `${line(key)} L${x(points.length - 1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`;

    const step = Math.max(1, Math.ceil(points.length / 8));

    return (
        <svg className="pa-traffic-fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`Daily visitors and session hits ${rangeLabel || 'for the selected window'}`}>
            {ticks.map((t) => (
                <g key={t}>
                    <line className="pa-grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
                    <text className="pa-axis" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
                </g>
            ))}
            {points.length > 0 && (
                <g>
                    <path d={area('hits', 0)} fill="var(--pa-line-soft)" stroke="none" />
                    <path d={area('visitors', 0)} fill="var(--pa-line-2-soft)" stroke="none" />
                    <path d={line('hits')} fill="none" stroke="var(--pa-line)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    <path d={line('visitors')} fill="none" stroke="var(--pa-line-2)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    {points.map((p, i) =>
                        i % step === 0 || i === points.length - 1 ? (
                            <text key={i} className="pa-axis" x={x(i)} y={H - 12} textAnchor="middle">
                                {shortDate(p.date)}
                            </text>
                        ) : null
                    )}
                </g>
            )}
            {points.length === 0 && (
                <text className="pa-axis" x={W / 2} y={H / 2} textAnchor="middle">No traffic recorded yet</text>
            )}
        </svg>
    );
}

/* Simulations figure: single-series ink area chart. Compact by design —
   it lives in the half-width "Most-built boards" column, where the old
   30-row bar list blew out the layout. Same visual language as the
   traffic figure, one ink colour, no per-day rows. */
function SimFigure({ points }) {
    const W = 560;
    const H = 180;
    const PAD = { l: 38, r: 10, t: 12, b: 28 };
    const iw = W - PAD.l - PAD.r;
    const ih = H - PAD.t - PAD.b;

    const max = Math.max(1, ...points.map((p) => p.count));
    const nice = Math.max(1, Math.ceil(max / 4));
    const ticks = [0, 1, 2, 3, 4].map((i) => i * nice);

    const x = (i) => (points.length <= 1 ? PAD.l : PAD.l + (i / (points.length - 1)) * iw);
    const y = (v) => PAD.t + ih - (v / (nice * 4)) * ih;

    const line = points.map((p, i) => `${i === 0 ? 'M' : 'L'}${x(i).toFixed(1)},${y(p.count).toFixed(1)}`).join(' ');
    const area = points.length > 0
        ? `${line} L${x(points.length - 1).toFixed(1)},${(PAD.t + ih).toFixed(1)} L${x(0).toFixed(1)},${(PAD.t + ih).toFixed(1)} Z`
        : '';

    const step = Math.max(1, Math.ceil(points.length / 5));

    return (
        <svg className="pa-traffic-fig" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Saved simulations per day for the selected window">
            {ticks.map((t) => (
                <g key={t}>
                    <line className="pa-grid" x1={PAD.l} x2={W - PAD.r} y1={y(t)} y2={y(t)} />
                    <text className="pa-axis" x={PAD.l - 8} y={y(t) + 4} textAnchor="end">{t}</text>
                </g>
            ))}
            {points.length > 0 && (
                <g>
                    <path d={area} fill="var(--pa-line-2-soft)" stroke="none" />
                    <path d={line} fill="none" stroke="var(--pa-line-2)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
                    {points.map((p, i) =>
                        i % step === 0 || i === points.length - 1 ? (
                            <text key={i} className="pa-axis" x={x(i)} y={H - 10} textAnchor="middle">
                                {shortDate(p.date)}
                            </text>
                        ) : null
                    )}
                </g>
            )}
            {points.length === 0 && (
                <text className="pa-axis" x={W / 2} y={H / 2} textAnchor="middle">No simulation data yet</text>
            )}
        </svg>
    );
}

export default function AnalyticsPage() {
    const navigate = useNavigate();
    const [searchParams, setSearchParams] = useSearchParams();
    const [stats, setStats] = useState(null);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState('');
    // ?range= persists one shared window across all three switches so views
    // are shareable (e.g. /analytics?range=week). Individual overrides let
    // each section diverge; they sync back into the URL as range_roles,
    // range_visits, range_builds.
    const [timeframe, setTimeframe] = useState(() => readRangeParam(searchParams, 'range_roles', readRangeParam(searchParams, 'range', 'allTime')));
    const [trafficTimeframe, setTrafficTimeframe] = useState(() => readRangeParam(searchParams, 'range_visits', readRangeParam(searchParams, 'range', 'allTime')));
    const [buildTimeframe, setBuildTimeframe] = useState(() => readRangeParam(searchParams, 'range_builds', readRangeParam(searchParams, 'range', 'allTime')));
    const [updatedAt, setUpdatedAt] = useState(null);

    const loadStats = async () => {
        try {
            const data = await fetchPublicAnalytics();
            setStats(data);
            setUpdatedAt(new Date());
            setError('');
        } catch (e) {
            console.error('AnalyticsPage: failed to load public analytics:', e);
            setError(e?.response?.data?.message || e.message || 'Unable to load analytics.');
        }
    };

    useEffect(() => {
        let mounted = true;
        (async () => {
            setLoading(true);
            await loadStats();
            if (mounted) setLoading(false);
        })();
        return () => { mounted = false; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Legacy ?range=X migrates once into per-section params so shared links
    // keep working and the URL always reflects the visible state.
    useEffect(() => {
        if (!searchParams.has('range')) return;
        const legacy = readRangeParam(searchParams, 'range', null);
        if (!legacy) return;
        const next = Object.fromEntries(searchParams.entries());
        delete next.range;
        if (!searchParams.has('range_roles')) { next.range_roles = legacy; setTimeframe(legacy); }
        if (!searchParams.has('range_visits')) { next.range_visits = legacy; setTrafficTimeframe(legacy); }
        if (!searchParams.has('range_builds')) { next.range_builds = legacy; setBuildTimeframe(legacy); }
        setSearchParams(next, { replace: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleRefresh = async () => {
        setRefreshing(true);
        try {
            await loadStats();
        } finally {
            setTimeout(() => setRefreshing(false), 600);
        }
    };

    const roles = stats?.registeredUsers || {};
    const active = roles[timeframe] || roles.allTime || { student: 0, teacher: 0, user: 0, total: 0 };
    const total = active.total || 0;

    const regFullTimeline = useMemo(() => roles.timeline || [], [roles]);
    // Signup trend follows the SAME switch as the role counts: Month shows
    // the last 30 days (whatever the backend timeline holds), Week the last
    // 7, Today the latest day, All time the full 30-day series.
    const regWindowDays = TIMEFRAMES.find((t) => t.id === timeframe)?.days ?? regFullTimeline.length;
    const regTimeline = regFullTimeline.slice(-Math.min(regWindowDays, regFullTimeline.length));
    const regMax = Math.max(1, ...regTimeline.map((d) => d.total || 0));
    const regWindowTotals = useMemo(
        () => regTimeline.reduce((acc, d) => acc + (d.total || 0), 0),
        [regTimeline]
    );

    const fullTraffic = useMemo(
        () => (stats?.visitorTimeline || []).map((d) => ({ date: d.date, visitors: d.visitors || 0, hits: d.hits || 0 })),
        [stats]
    );

    // Daily-visits window mirrors the "Who is joining" switch. Backend now
    // serves a true 30-day series, so Month/All time show the full month.
    const trafficWindowDays = TIMEFRAMES.find((t) => t.id === trafficTimeframe)?.days ?? fullTraffic.length;
    const traffic = fullTraffic.slice(-Math.min(trafficWindowDays, fullTraffic.length));

    const trafficTotals = useMemo(
        () => traffic.reduce((acc, d) => ({ visitors: acc.visitors + d.visitors, hits: acc.hits + d.hits }), { visitors: 0, hits: 0 }),
        [traffic]
    );

    const compiles = useMemo(() => stats?.compilationHistory || [], [stats]);
    // Build window follows the page's window convention: Today = latest day,
    // Week = last 7, Month/All time = everything the backend timeline holds
    // (30-day series, so Month is a true 30-day month).
    const buildWindowDays = TIMEFRAMES.find((t) => t.id === buildTimeframe)?.days ?? compiles.length;
    const builds = compiles.slice(-Math.min(buildWindowDays, compiles.length));
    const buildMax = Math.max(1, ...builds.map((d) => (d.success || 0) + (d.fail || 0)));
    const compileTotals = useMemo(
        () => builds.reduce((acc, d) => ({ success: acc.success + (d.success || 0), fail: acc.fail + (d.fail || 0) }), { success: 0, fail: 0 }),
        [builds]
    );
    const successRate = compileTotals.success + compileTotals.fail > 0
        ? Math.round((compileTotals.success / (compileTotals.success + compileTotals.fail)) * 100)
        : null;

    // Simulations-over-time: daily Project.createdAt counts (new backend
    // series, 30-day). Window follows the shared convention.
    const fullSimulations = useMemo(
        () => (stats?.simulationsTimeline || []).map((d) => ({ date: d.date, count: d.count || 0 })),
        [stats]
    );
    const simWindowDays = TIMEFRAMES.find((t) => t.id === buildTimeframe)?.days ?? fullSimulations.length;
    const simulations = fullSimulations.slice(-Math.min(simWindowDays, fullSimulations.length));
    const simTotal = useMemo(() => simulations.reduce((acc, d) => acc + d.count, 0), [simulations]);

    const syncParams = (next) => {
        setSearchParams(next, { replace: true });
    };

    const pickRange = (setter, key) => (id) => {
        setter(id);
        const current = Object.fromEntries(searchParams.entries());
        delete current.range;
        syncParams({ ...current, [key]: id });
    };

    const pickRoles = pickRange(setTimeframe, 'range_roles');
    const pickVisits = pickRange(setTrafficTimeframe, 'range_visits');
    const pickBuilds = pickRange(setBuildTimeframe, 'range_builds');

    const exportWindowCsv = () => {
        const stamp = new Date().toISOString().split('T')[0];
        downloadCsv(`openhw-analytics-${timeframe}-${stamp}.csv`, [
            ['section', 'date', 'metric', 'value'],
            ...regTimeline.map((d) => ['signups', d.date, 'total', d.total || 0]),
            ...regTimeline.map((d) => ['signups', d.date, 'students', d.student || 0]),
            ...regTimeline.map((d) => ['signups', d.date, 'teachers', d.teacher || 0]),
            ...regTimeline.map((d) => ['signups', d.date, 'general_users', d.user || 0]),
            ...traffic.map((d) => ['visits', d.date, 'visitors', d.visitors]),
            ...traffic.map((d) => ['visits', d.date, 'session_hits', d.hits]),
            ...builds.map((d) => ['builds', d.date, 'success', d.success || 0]),
            ...builds.map((d) => ['builds', d.date, 'failed', d.fail || 0]),
            ...simulations.map((d) => ['simulations', d.date, 'saved', d.count]),
        ]);
    };

    const boards = useMemo(() => stats?.topLibraries || [], [stats]);
    const boardMax = Math.max(1, ...boards.map((b) => b.count || 0));

    const devices = stats?.deviceStats || { desktop: 0, mobile: 0, tablet: 0 };
    const countries = useMemo(() => stats?.topCountries || [], [stats]);
    const cities = useMemo(() => (stats?.topCities || []).slice(0, 8), [stats]);
    const countryMax = Math.max(1, ...countries.map((c) => c.count || 0));

    return (
        <div style={{ minHeight: '100vh' }}>
            <PublicNavbar />
            <div className="pa-page">
                <div className="pa-wrap">
                    {/* Masthead */}
                    <div className="pa-masthead">
                        <div>
                            <div className="pa-kicker">OpenHW Studio · Public record</div>
                            <h1 className="pa-title">How the workbench is growing</h1>
                            <p className="pa-lede">
                                A shared notebook of community signups, daily visits, and
                                compilation runs. Aggregate counts only — no maps tracking
                                individuals, no session logs.
                            </p>
                        </div>
                        <div className="pa-actions">
                            <button className="pa-btn" onClick={() => navigate(-1)} aria-label="Go back">
                                <ArrowLeft /> Back
                            </button>
                            <button className="pa-btn" onClick={exportWindowCsv} aria-label="Download visible data as CSV">
                                <Download /> CSV
                            </button>
                            <button
                                className={`pa-btn ${refreshing ? 'is-busy' : ''}`}
                                onClick={handleRefresh}
                                aria-label="Refresh analytics"
                            >
                                <RefreshCw /> Refresh
                            </button>
                        </div>
                    </div>
                    {updatedAt && !loading && (
                        <div className="pa-updated" style={{ marginTop: -18, marginBottom: 26 }}>
                            Snapshot taken {updatedAt.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                    )}

                    {loading ? (
                        <div className="pa-state" role="status" aria-label="Loading analytics">
                            <div className="pa-spin" />
                            <h2>Gathering the ledger…</h2>
                            <p>Pulling the latest community counts.</p>
                        </div>
                    ) : error && !stats ? (
                        <div className="pa-state" role="alert">
                            <h2>The ledger didn’t open</h2>
                            <p>{error} Check the connection, then try again.</p>
                            <button className="pa-btn" onClick={handleRefresh}>Try again</button>
                        </div>
                    ) : (
                        <>
                            {/* Ledger hero: one memorable number */}
                            <section className="pa-ledger" aria-label="Community total">
                                <div className="pa-ledger-row">
                                    <div>
                                        <div className="pa-ledger-label">Registered accounts</div>
                                        <div className="pa-ledger-total">{fmtInt(roles.allTime?.total || 0)}</div>
                                    </div>
                                    <p className="pa-ledger-note">
                                        Students, teachers, and general users building
                                        circuits on the shared bench.
                                    </p>
                                </div>
                                <div className="pa-ledger-foot">
                                    <span><strong>{fmtInt(roles.allTime?.student || 0)}</strong>students</span>
                                    <span><strong>{fmtInt(roles.allTime?.teacher || 0)}</strong>teachers</span>
                                    <span><strong>{fmtInt(roles.allTime?.user || 0)}</strong>general users</span>
                                    <span><strong>{fmtInt(stats?.totalSimulations || 0)}</strong>saved simulations</span>
                                </div>
                            </section>

                            {/* Reach strip */}
                            <section className="pa-reach" aria-label="Visits at a glance">
                                <div className="pa-reach-cell">
                                    <div className="pa-reach-num"><span className="pa-live-dot" aria-hidden="true" />{fmtInt(stats?.activeSessions)}</div>
                                    <div className="pa-reach-cap">Active in the last 15 minutes</div>
                                </div>
                                <div className="pa-reach-cell">
                                    <div className="pa-reach-num">{fmtInt(stats?.todayVisitors)}</div>
                                    <div className="pa-reach-cap">Unique visitors today</div>
                                </div>
                                <div className="pa-reach-cell">
                                    <div className="pa-reach-num">{fmtInt(stats?.weekVisitors)}</div>
                                    <div className="pa-reach-cap">Visitors this week</div>
                                </div>
                                <div className="pa-reach-cell">
                                    <div className="pa-reach-num">{fmtInt(stats?.monthVisitors)}</div>
                                    <div className="pa-reach-cap">Visitors this month</div>
                                </div>
                            </section>

                            {/* Community */}
                            <section className="pa-section" aria-label="Community">
                                <div className="pa-section-head">
                                    <h2 className="pa-section-title">Who is joining</h2>
                                    <div className="pa-switch" role="group" aria-label="Signup timeframe">
                                        {TIMEFRAMES.map((t) => (
                                            <button
                                                key={t.id}
                                                className={`pa-switch-btn ${timeframe === t.id ? 'is-on' : ''}`}
                                                onClick={() => pickRoles(t.id)}
                                                aria-pressed={timeframe === t.id}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="pa-section-sub">
                                    Account signups broken down by role
                                    {timeframe !== 'allTime' && (
                                        <> — showing new accounts {timeframe === 'today' ? 'for the latest day' : timeframe === 'week' ? 'from the last 7 days' : 'from the last 30 days'}</>
                                    )}.
                                </p>
                                <div className="pa-roles">
                                    <div>
                                        {ROLE_ORDER.map((r) => {
                                            const v = active[r.key] || 0;
                                            const share = total > 0 ? Math.round((v / total) * 100) : 0;
                                            return (
                                                <div className="pa-role-row" key={r.key}>
                                                    <div>
                                                        <div className="pa-role-name">{r.label}</div>
                                                        <div className="pa-role-share">{total > 0 ? `${share}% of total` : 'No signups yet'}</div>
                                                    </div>
                                                    <div className="pa-role-num">{fmtInt(v)}</div>
                                                    <div className="pa-role-bar" aria-hidden="true">
                                                        <i style={{ width: `${share}%` }} />
                                                    </div>
                                                </div>
                                            );
                                        })}
                                        <div className="pa-role-row">
                                        <div>
                                            <div className="pa-role-name">Total accounts</div>
                                            <div className="pa-role-share">
                                                {timeframe === 'allTime' ? 'All-time registered' : timeframe === 'today' ? 'New on the latest day' : timeframe === 'week' ? 'New in the last 7 days' : 'New in the last 30 days'}
                                            </div>
                                        </div>
                                            <div className="pa-role-num">{fmtInt(total)}</div>
                                        </div>
                                    </div>
                                    <div className="pa-role-side">
                                        <h3>Daily signups, {timeframe === 'today' ? 'latest day' : timeframe === 'week' ? 'last 7 days' : 'last 30 days'}</h3>
                                        {regMax > 1 ? (
                                        <>
                                        <div className="pa-trend" role="img" aria-label={`Daily signup totals for the selected window (${regTimeline.length} days, ${regWindowTotals} signups)`}>
                                            {regTimeline.length > 0 ? (
                                                regTimeline.map((d, i) => (
                                                    <i
                                                        key={d.date || i}
                                                        title={`${shortDate(d.date)}: ${d.total || 0}`}
                                                        style={{ height: `${Math.max(3, ((d.total || 0) / regMax) * 100)}%` }}
                                                    />
                                                ))
                                            ) : (
                                                <span className="pa-trend-cap pa-trend-empty">No signup data yet.</span>
                                            )}
                                        </div>
                                        <p className="pa-trend-cap">
                                            {regWindowTotals} signup{regWindowTotals === 1 ? '' : 's'} in view across every role. Hover a bar for the exact count.
                                        </p>
                                        </>
                                        ) : (
                                        <p className="pa-trend-cap pa-trend-flat">
                                            {regWindowTotals === 0
                                                ? 'No signups in this window yet — new accounts will appear here day by day.'
                                                : `Only ${regWindowTotals} signup${regWindowTotals === 1 ? '' : 's'} in this window, all on ${shortDate(regTimeline.find((d) => (d.total || 0) > 0)?.date)}. Not enough spread to draw a trend yet.`}
                                        </p>
                                        )}
                                    </div>
                                </div>
                            </section>

                            {/* Traffic */}
                            <section className="pa-section" aria-label="Visits">
                                <div className="pa-section-head">
                                    <h2 className="pa-section-title">Daily visits</h2>
                                    <div className="pa-switch" role="group" aria-label="Visits timeframe">
                                        {TIMEFRAMES.map((t) => (
                                            <button
                                                key={t.id}
                                                className={`pa-switch-btn ${trafficTimeframe === t.id ? 'is-on' : ''}`}
                                                onClick={() => pickVisits(t.id)}
                                                aria-pressed={trafficTimeframe === t.id}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="pa-section-sub">
                                    Unique visitors and session requests {windowLabel(trafficTimeframe)}
                                    {' '}({fmtInt(trafficTotals.visitors)} visitors · {fmtInt(trafficTotals.hits)} session requests in view).
                                </p>
                                <div className="pa-traffic">
                                    <TrafficFigure points={traffic} rangeLabel={windowLabel(trafficTimeframe)} />
                                    <div className="pa-traffic-legend">
                                        <span><i className="pa-swatch" style={{ background: 'var(--pa-line)' }} />Session hits</span>
                                        <span><i className="pa-swatch" style={{ background: 'var(--pa-line-2)' }} />Unique visitors</span>
                                    </div>
                                    <div className="pa-devices">
                                        <div className="pa-device">Desktop<strong>{fmtInt(devices.desktop)}</strong></div>
                                        <div className="pa-device">Mobile<strong>{fmtInt(devices.mobile)}</strong></div>
                                        <div className="pa-device">Tablet<strong>{fmtInt(devices.tablet)}</strong></div>
                                    </div>
                                </div>
                            </section>

                            {/* Builds */}
                            <section className="pa-section" aria-label="Compilations">
                                <div className="pa-section-head">
                                    <h2 className="pa-section-title">Compilation runs</h2>
                                    <div className="pa-switch" role="group" aria-label="Builds timeframe">
                                        {TIMEFRAMES.map((t) => (
                                            <button
                                                key={t.id}
                                                className={`pa-switch-btn ${buildTimeframe === t.id ? 'is-on' : ''}`}
                                                onClick={() => pickBuilds(t.id)}
                                                aria-pressed={buildTimeframe === t.id}
                                            >
                                                {t.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                                <p className="pa-section-sub">
                                    Successful versus failed firmware builds {windowLabel(buildTimeframe)}
                                    {successRate != null && (
                                        <> — <strong>{successRate}% success</strong> ({fmtInt(compileTotals.success)} succeeded · {fmtInt(compileTotals.fail)} failed · avg {stats?.avgCompileTime || '—'})</>
                                    )}
                                    {successRate == null && ' — no runs recorded yet'}.
                                </p>
                                <div className="pa-builds">
                                    {builds.length > 0 ? (
                                        builds.map((d) => {
                                            const ok = d.success || 0;
                                            const bad = d.fail || 0;
                                            const dayRate = ok + bad > 0 ? Math.round((ok / (ok + bad)) * 100) : null;
                                            return (
                                                <div className="pa-build-row" key={d.date}>
                                                    <span className="pa-build-date">{shortDate(d.date)}</span>
                                                    <span className="pa-build-track" role="img" aria-label={`${shortDate(d.date)}: ${ok} succeeded, ${bad} failed${dayRate != null ? `, ${dayRate}% success` : ''}`}>
                                                        <i style={{ width: `${(ok / buildMax) * 100}%` }} />
                                                        <b style={{ left: `${(ok / buildMax) * 100}%`, width: `${(bad / buildMax) * 100}%` }} />
                                                    </span>
                                                    <span className="pa-build-nums"><strong>{fmtInt(ok)}</strong> ok · {fmtInt(bad)} failed{dayRate != null ? ` · ${dayRate}%` : ''}</span>
                                                </div>
                                            );
                                        })
                                    ) : (
                                        <div className="pa-build-row"><span className="pa-build-date">—</span><span>No compilation data in this window yet.</span><span /></div>
                                    )}
                                </div>
                            </section>

                            {/* Boards + places: full-width symmetric ledger. Left column
                                stacks Most-built boards over Simulations saved;
                                right column stacks Geo reach over Cities. Both
                                columns share one card so neither side floats. */}
                            <section className="pa-section" aria-label="Boards and reach">
                                <div className="pa-duo">
                                    <div className="pa-duo-card">
                                        <div className="pa-section-head">
                                            <h2 className="pa-section-title">Most-built boards</h2>
                                        </div>
                                        <p className="pa-section-sub">Microcontroller boards behind saved simulations.</p>
                                        <div>
                                            {boards.length > 0 ? (
                                                boards.slice(0, 8).map((b) => (
                                                    <div className="pa-board-row" key={b.name}>
                                                        <span className="pa-board-name">{b.name}</span>
                                                        <span className="pa-board-count">{fmtInt(b.count)}</span>
                                                        <span className="pa-board-track" aria-hidden="true">
                                                            <i style={{ width: `${((b.count || 0) / boardMax) * 100}%` }} />
                                                        </span>
                                                    </div>
                                                ))
                                            ) : (
                                                <p className="pa-section-sub">No board telemetry recorded yet.</p>
                                            )}
                                        </div>
                                        <div className="pa-section-head pa-duo-gap">
                                            <h2 className="pa-section-title">Simulations saved</h2>
                                        </div>
                                        <p className="pa-section-sub">
                                            New saved simulations per day {windowLabel(buildTimeframe)} — {fmtInt(simTotal)} in view, {fmtInt(stats?.totalSimulations || 0)} all time.
                                        </p>
                                        <div className="pa-traffic pa-sims">
                                            <SimFigure points={simulations} />
                                            <div className="pa-traffic-legend">
                                                <span><i className="pa-swatch" style={{ background: 'var(--pa-line-2)' }} />Saved per day</span>
                                                <span className="pa-sims-total">{fmtInt(simTotal)} in view</span>
                                            </div>
                                        </div>
                                    </div>
                                    <div className="pa-duo-card">
                                        <div className="pa-section-head">
                                            <h2 className="pa-section-title">Where visitors come from</h2>
                                        </div>
                                        <p className="pa-section-sub">Country and city counts only — nobody is tracked individually.</p>
                                        {countries.length > 0 ? (
                                            <ul className="pa-place-list pa-country-bars">
                                                {countries.slice(0, 6).map((c, i) => (
                                                    <li key={c.name}>
                                                        <span className="pa-rank" aria-hidden="true">{i + 1}</span>
                                                        <span className="pa-place-main">
                                                            <span className="pa-place-top">
                                                                <span className="pa-place-name">{c.name || 'Unknown'}</span>
                                                                <span className="pa-place-count">{fmtInt(c.count)}{c.percentage != null ? ` · ${c.percentage}%` : ''}</span>
                                                            </span>
                                                            <span className="pa-place-track" aria-hidden="true">
                                                                <i style={{ width: `${((c.count || 0) / countryMax) * 100}%` }} />
                                                            </span>
                                                        </span>
                                                    </li>
                                                ))}
                                            </ul>
                                        ) : (
                                            <p className="pa-section-sub">No country data yet.</p>
                                        )}
                                        {cities.length > 0 && (
                                            <div className="pa-cities-label">Top cities</div>
                                        )}
                                        {cities.length > 0 && (
                                            <div className="pa-cities">
                                                {cities.map((c) => (
                                                    <span className="pa-city" key={c.name}>{c.name}<b>{fmtInt(c.count)}</b></span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </section>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
