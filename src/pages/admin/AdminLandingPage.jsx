import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { 
    Zap, Globe, Cpu, Database, 
    Activity, Users, ShieldCheck, 
    ChevronRight, LogOut 
} from 'lucide-react';

import { fetchPublicSystemStatus } from '../../services/simulatorService';

export default function AdminLandingPage() {
    const navigate = useNavigate();
    const { isAdminAuthenticated } = useAuth();
    const [currentTime, setCurrentTime] = useState(new Date());
    const [stats, setStats] = useState({
        frontend: 'v1.4.2',
        backend: 'Operational',
        database: 'Connected',
        load: 'Normal',
        sessions: 0,
        env: 'Production'
    });

    useEffect(() => {
        const timer = setInterval(() => setCurrentTime(new Date()), 1000);
        
        // Initial Fetch
        const loadStats = async () => {
            const data = await fetchPublicSystemStatus();
            if (data) setStats(data);
        };
        loadStats();

        // Polling every 30 seconds
        const statTimer = setInterval(loadStats, 30000);

        return () => {
            clearInterval(timer);
            clearInterval(statTimer);
        };
    }, []);

    const StatusItem = ({ label, value, status = 'success', icon: Icon }) => (
        <div className="admin-status-chip group">
            <div className="flex items-center gap-4">
                <div className="p-2.5 bg-slate-800/50 rounded-lg group-hover:bg-slate-700/50 transition-colors">
                    <Icon className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <div className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-0.5">{label}</div>
                    <div className="flex items-center gap-2">
                        <span className={`w-1.5 h-1.5 rounded-full ${status === 'success' ? 'bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.6)]' : 'bg-amber-500'}`}></span>
                        <span className="text-sm font-bold text-slate-200">{value}</span>
                    </div>
                </div>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-[#070b14] text-slate-100 font-sans selection:bg-blue-500/30 overflow-hidden relative flex flex-col items-center justify-center p-8">
            {/* Dynamic Background Elements */}
            <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[150px] rounded-full"></div>
            <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] bg-emerald-600/10 blur-[150px] rounded-full"></div>

            {/* Main Content Card */}
            <div className="admin-glass-panel max-w-3xl w-full p-12 md:p-16 rounded-[3rem] z-10 animate-admin-entry relative border border-white/5 shadow-2xl">
                <div className="absolute top-0 right-0 p-12 text-slate-500 font-mono text-sm hidden md:block opacity-50">
                    {currentTime.toLocaleTimeString()}
                </div>

                <div className="flex flex-col items-center text-center">
                    <div className="w-24 h-24 bg-blue-500/10 rounded-[2rem] flex items-center justify-center mb-10 border border-blue-500/20 shadow-xl animate-admin-float">
                        <Zap className="w-12 h-12 text-blue-400 fill-blue-400/20" />
                    </div>

                    <h1 className="text-5xl md:text-6xl font-black mb-6 tracking-tighter">
                        OpenHW<span className="text-blue-500">Studio</span>
                    </h1>
                    <div className="h-px w-24 bg-gradient-to-r from-transparent via-slate-700 to-transparent mb-8"></div>
                    <h2 className="text-xl text-slate-400 font-semibold mb-4 tracking-widest uppercase">Administration Portal</h2>
                    <p className="text-slate-500 leading-relaxed mb-12 max-w-lg text-lg">
                        Secure gateway for enterprise system management. Monitor performance, 
                        manage community integrations, and oversee global pipelines.
                    </p>

                    {/* Status Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full mb-16">
                        <StatusItem label="Frontend" value={stats.frontend} icon={Globe} />
                        <StatusItem label="Backend API" value={stats.backend} icon={Cpu} />
                        <StatusItem label="Database" value={stats.database} icon={Database} />
                        <StatusItem label="System Load" value={`${stats.load} Normal`} icon={Activity} />
                        <StatusItem label="Active Sessions" value={`${stats.sessions} Active`} icon={Users} />
                        <StatusItem label="Environment" value={stats.env} icon={ShieldCheck} />
                    </div>

                    {/* Action Buttons */}
                    <div className="flex flex-col sm:flex-row gap-6 w-full">
                        <button
                            onClick={() => navigate(isAdminAuthenticated ? '/admin/dashboard' : '/admin/login')}
                            className="admin-glow-button flex-[1.5] bg-emerald-600 hover:bg-emerald-500 text-white py-5 px-10 rounded-[1.5rem] font-bold text-xl flex items-center justify-center gap-3 group shadow-lg shadow-emerald-900/20"
                        >
                            {isAdminAuthenticated ? 'Access Control Panel' : 'Secure Login'}
                            <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" />
                        </button>
                        <button
                            onClick={() => navigate('/')}
                            className="flex-1 bg-slate-800/30 hover:bg-slate-800/60 text-slate-300 py-5 px-10 rounded-[1.5rem] font-bold text-xl border border-white/5 transition-all"
                        >
                            Back to Site
                        </button>
                    </div>
                </div>
            </div>

            {/* Footer */}
            <div className="mt-12 text-slate-700 text-sm font-bold tracking-widest uppercase z-10 flex items-center gap-6">
                <span>© 2024 OpenHW-Studio</span>
                <div className="w-2 h-2 bg-slate-800 rounded-full"></div>
                <span>Deployment v1.0.0-admin</span>
            </div>
        </div>
    );
}
