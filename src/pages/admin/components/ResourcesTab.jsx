import React, { useState, useEffect } from 'react';
import AdminCard from './AdminCard';
import StatCard from './StatCard';
import { Cpu, RotateCw, Download, Layers, ShieldCheck, Activity, Code, Terminal } from 'lucide-react';
import { fetchResourceStatus, fetchHostStatus, triggerRecalibrate, downloadCalibrationScripts, uploadCalibrationScripts } from '../../../services/simulatorService';

export default function ResourcesTab() {
    const [status, setStatus] = useState(null);
    const [hostStatus, setHostStatus] = useState(null);
    const [loading, setLoading] = useState(true);
    const [calibrating, setCalibrating] = useState(false);

    const loadStatus = async () => {
        setLoading(true);
        try {
            const [data, hostData] = await Promise.all([
                fetchResourceStatus(),
                fetchHostStatus().catch(() => null)
            ]);
            
            if (data?.success) setStatus(data);
            if (hostData?.success) setHostStatus(hostData.host);
        } catch (e) {
            console.error('Failed to load resource status:', e);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadStatus();
        const interval = setInterval(loadStatus, 5000);
        return () => clearInterval(interval);
    }, []);

    const handleRecalibrate = async () => {
        if (!window.confirm('Warning: Triggering recalibration will execute a compilation stress test on the server. Active compilations/simulations might queue up. Do you want to continue?')) {
            return;
        }
        setCalibrating(true);
        try {
            const res = await triggerRecalibrate();
            if (res.success) {
                alert('Recalibration has been successfully started in the background. The points configuration will automatically update in 1-2 minutes.');
            } else {
                alert(`Failed to start recalibration: ${res.error || 'Unknown error'}`);
            }
        } catch (e) {
            alert(`Recalibration error: ${e.message}`);
        } finally {
            setCalibrating(false);
            loadStatus();
        }
    };

    const handleDownloadBudget = () => {
        if (!status?.budget) return;
        const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(status.budget, null, 4));
        const downloadAnchor = document.createElement('a');
        downloadAnchor.setAttribute("href", dataStr);
        downloadAnchor.setAttribute("download", "calibrated_budget.json");
        document.body.appendChild(downloadAnchor);
        downloadAnchor.click();
        downloadAnchor.remove();
    };

    const handleDownloadScripts = async () => {
        try {
            const blob = await downloadCalibrationScripts();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'calibration_scripts.json';
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
        } catch (e) {
            alert('Failed to download scripts: ' + e.message);
        }
    };

    const handleUploadScripts = async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
            const res = await uploadCalibrationScripts(file);
            if (res.success) {
                alert('Calibration scripts updated successfully!');
            } else {
                alert('Failed to upload: ' + res.error);
            }
        } catch (error) {
            alert('Error uploading scripts: ' + error.message);
        }
        e.target.value = null; // reset input
    };

    if (loading && !status) {
        return (
            <div className="flex items-center justify-center p-12 text-slate-400">
                <RotateCw className="w-8 h-8 animate-spin mr-3 text-blue-500" />
                <span>Loading resource allocation telemetry...</span>
            </div>
        );
    }

    const { totalPoints = 0, activePoints = 0, availablePoints = 0, waitingCount = 0, budget = {}, allocations = [] } = status || {};
    const usedPercentage = totalPoints > 0 ? Math.min(100, Math.round((activePoints / totalPoints) * 100)) : 0;

    const activeCompilations = allocations.filter(a => a.tag && a.tag.includes('_compile')).length;
    const activeSimulations = allocations.filter(a => a.tag && a.tag.includes('_sim')).length;

    return (
        <div className="space-y-12">
            {/* Stat Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-6 md:gap-8">
                <StatCard 
                    label="Active Points" 
                    value={`${activePoints} MB`} 
                    icon={<Activity />} 
                    color="text-blue-500"
                />
                <StatCard 
                    label="Available Points" 
                    value={`${availablePoints} MB`} 
                    icon={<Cpu />} 
                    color="text-green-500"
                />
                <StatCard 
                    label="Total Points Pool" 
                    value={`${totalPoints} MB`} 
                    icon={<Layers />} 
                    color="text-blue-500"
                />
                <StatCard 
                    label="Waiting Queue" 
                    value={waitingCount} 
                    icon={<ShieldCheck />} 
                    color={waitingCount > 0 ? "text-amber-500" : "text-blue-500"}
                />
                <StatCard 
                    label="Active Compiles" 
                    value={activeCompilations} 
                    icon={<Code />} 
                    color="text-indigo-500"
                />
                <StatCard 
                    label="Active Sims" 
                    value={activeSimulations} 
                    icon={<Terminal />} 
                    color="text-emerald-500"
                />
            </div>

            {/* Gauge Bar */}
            <AdminCard className="p-8">
                <div className="flex items-center justify-between mb-4">
                    <span className="text-lg font-black text-white">Resource Pool Consumption</span>
                    <span className="text-lg font-black text-blue-500">{usedPercentage}%</span>
                </div>
                <div className="w-full bg-slate-900/80 rounded-full h-4 overflow-hidden border border-white/5 p-[2px]">
                    <div 
                        className={`h-full rounded-full transition-all duration-500 ${
                            usedPercentage > 85 ? 'bg-red-500' : usedPercentage > 60 ? 'bg-amber-500' : 'bg-blue-500'
                        }`}
                        style={{ width: `${usedPercentage}%` }}
                    ></div>
                </div>
                <p className="text-xs text-slate-500 font-semibold mt-3">
                    System reserve (2000 MB) is excluded from this pool to guarantee host OS stability.
                </p>
            </AdminCard>

            {/* Host VM Status (Health Agent) */}
            {hostStatus && (
                <AdminCard className="p-8 border-l-4 border-l-indigo-500">
                    <div className="flex items-center justify-between mb-6">
                        <span className="text-lg font-black text-white">Host VM Status (Hardware)</span>
                        <span className="text-sm font-bold text-indigo-400 bg-indigo-500/10 px-3 py-1 rounded-full">Live via Health Agent</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                        <div>
                            <p className="text-sm font-bold text-slate-500 mb-1">CPU Load Avg</p>
                            <p className="text-2xl font-black text-white">{hostStatus.load_avg}</p>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 mb-1">True Host RAM</p>
                            <p className="text-2xl font-black text-white">
                                {hostStatus.used_mem} / {hostStatus.total_mem} MB <span className="text-sm text-slate-400">({hostStatus.mem_pct}%)</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 mb-1">Storage Usage</p>
                            <p className="text-2xl font-black text-white">
                                {(hostStatus.total_disk - hostStatus.free_disk).toFixed(1)} / {hostStatus.total_disk} GB <span className="text-sm text-slate-400">({((hostStatus.total_disk - hostStatus.free_disk) / hostStatus.total_disk * 100).toFixed(1)}%)</span>
                            </p>
                        </div>
                        <div>
                            <p className="text-sm font-bold text-slate-500 mb-1">System Uptime</p>
                            <p className="text-2xl font-black text-white">{hostStatus.uptime}</p>
                        </div>
                    </div>
                </AdminCard>
            )}

            <div className="grid grid-cols-1 xl:grid-cols-3 gap-8">
                {/* Active Allocations Column */}
                <div className="xl:col-span-2 space-y-6">
                    <div className="flex items-center justify-between">
                        <h3 className="text-2xl font-black text-white">Active Allocations</h3>
                        <button 
                            onClick={loadStatus}
                            className="p-3 text-slate-500 hover:text-white transition-all bg-slate-900/50 rounded-lg border border-white/10"
                        >
                            <RotateCw className="w-5 h-5" />
                        </button>
                    </div>

                    <AdminCard className="overflow-hidden">
                        {allocations.length === 0 ? (
                            <div className="p-12 text-center text-slate-500 font-bold">
                                No active points are currently being consumed.
                            </div>
                        ) : (
                            <div className="overflow-x-auto">
                                <table className="w-full border-collapse text-left">
                                    <thead>
                                        <tr className="border-b border-white/10 bg-slate-950/40 text-slate-400 text-xs font-black uppercase tracking-wider">
                                            <th className="p-6">Allocation ID</th>
                                            <th className="p-6">Service/Tag</th>
                                            <th className="p-6">Memory (Points)</th>
                                            <th className="p-6">Uptime</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-white/5 font-bold text-sm">
                                        {allocations.map((alloc) => {
                                            const uptimeSec = Math.round((Date.now() - alloc.timestamp) / 1000);
                                            const uptimeStr = uptimeSec > 60 ? `${Math.floor(uptimeSec / 60)}m ${uptimeSec % 60}s` : `${uptimeSec}s`;
                                            return (
                                                <tr key={alloc.id} className="hover:bg-white/[0.02] transition-all">
                                                    <td className="p-6 font-mono text-xs text-blue-400">{alloc.id}</td>
                                                    <td className="p-6 text-white">{alloc.tag}</td>
                                                    <td className="p-6 text-slate-300">{alloc.points} MB</td>
                                                    <td className="p-6 text-slate-500">{uptimeStr}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </AdminCard>
                </div>

                {/* Calibrated Costs & Calibration Actions Column */}
                <div className="space-y-6">
                    <h3 className="text-2xl font-black text-white">Calibration Configuration</h3>
                    <AdminCard className="p-8 space-y-8">
                        <div className="space-y-4">
                            <div className="flex justify-between items-center text-sm border-b border-white/5 pb-4">
                                <span className="text-slate-400 font-bold uppercase tracking-wider text-xs">Target</span>
                                <span className="text-slate-400 font-bold uppercase tracking-wider text-xs">Cost (MB)</span>
                            </div>
                            {Object.entries(budget).map(([key, val]) => (
                                <div key={key} className="flex justify-between items-center text-sm">
                                    <span className="text-slate-300 font-bold font-mono text-xs">{key}</span>
                                    <span className="text-white font-black">{val} MB</span>
                                </div>
                            ))}
                        </div>

                        <div className="pt-6 border-t border-white/10 flex flex-col gap-4">
                            <button 
                                onClick={handleRecalibrate}
                                disabled={calibrating}
                                className="w-full flex items-center justify-center gap-3 bg-blue-600 hover:bg-blue-500 disabled:bg-blue-600/40 text-white font-black py-4 px-6 rounded-xl transition-all shadow-xl shadow-blue-900/20 text-base"
                            >
                                <RotateCw className={`w-5 h-5 ${calibrating ? 'animate-spin' : ''}`} />
                                Recalibrate Budget
                            </button>
                            
                            <button 
                                onClick={handleDownloadBudget}
                                className="w-full flex items-center justify-center gap-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 text-white font-black py-4 px-6 rounded-xl transition-all text-base"
                            >
                                <Download className="w-5 h-5 text-blue-500" />
                                Download Config
                            </button>
                        </div>
                    </AdminCard>

                    <h3 className="text-2xl font-black text-white mt-8">Calibration Scripts</h3>
                    <AdminCard className="p-8 space-y-4">
                        <p className="text-sm text-slate-400 mb-4">
                            Update the JSON file containing the test C++ scripts used during the recalibration process by the Health Agent.
                        </p>
                        <button 
                            onClick={handleDownloadScripts}
                            className="w-full flex items-center justify-center gap-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 text-white font-black py-4 px-6 rounded-xl transition-all text-base"
                        >
                            <Download className="w-5 h-5 text-green-500" />
                            Download Current Scripts
                        </button>
                        
                        <label className="w-full flex items-center justify-center gap-3 bg-slate-900/80 hover:bg-slate-900 border border-white/10 text-white font-black py-4 px-6 rounded-xl transition-all text-base cursor-pointer">
                            <RotateCw className="w-5 h-5 text-amber-500" />
                            Upload New Scripts (JSON)
                            <input 
                                type="file" 
                                accept=".json" 
                                className="hidden" 
                                onChange={handleUploadScripts} 
                            />
                        </label>
                    </AdminCard>
                </div>
            </div>
        </div>
    );
}
