import React from 'react';
import { Settings, RefreshCw, AlertTriangle, Hammer, Zap } from 'lucide-react';

const MaintenancePage = () => {
    return (
        <div className="fixed inset-0 z-[9999] bg-[#030712] flex items-center justify-center overflow-hidden">
            {/* Background Effects */}
            <div className="absolute inset-0">
                <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-[128px] animate-pulse"></div>
                <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-indigo-600/10 rounded-full blur-[128px] animate-pulse delay-700"></div>
                <div className="absolute inset-0 bg-[url('https://grainy-gradients.vercel.app/noise.svg')] opacity-20 brightness-100 contrast-150"></div>
            </div>

            <div className="relative z-10 max-w-2xl w-full px-6 text-center">
                <div className="flex justify-center mb-12">
                    <div className="relative">
                        <div className="w-24 h-24 bg-blue-600/20 rounded-3xl flex items-center justify-center border border-blue-500/30 shadow-[0_0_50px_rgba(37,99,235,0.2)] animate-bounce duration-[3000ms]">
                            <Hammer className="w-12 h-12 text-blue-400" />
                        </div>
                        <div className="absolute -top-4 -right-4 w-12 h-12 bg-amber-500/20 rounded-2xl flex items-center justify-center border border-amber-500/30 animate-spin duration-[10000ms]">
                            <Settings className="w-6 h-6 text-amber-500" />
                        </div>
                        <div className="absolute -bottom-2 -left-6 w-10 h-10 bg-indigo-500/20 rounded-xl flex items-center justify-center border border-indigo-500/30 animate-pulse">
                            <Zap className="w-5 h-5 text-indigo-400" />
                        </div>
                    </div>
                </div>

                <h1 className="text-5xl md:text-6xl font-black text-white italic tracking-tighter mb-6 bg-clip-text text-transparent bg-gradient-to-b from-white to-white/50">
                    System Maintenance
                </h1>
                
                <p className="text-slate-400 text-lg md:text-xl font-medium leading-relaxed mb-12">
                    We're currently fine-tuning the simulator infrastructure to bring you a smoother experience. 
                    Hang tight, we'll be back online shortly.
                </p>

                <div className="flex flex-col items-center gap-6">
                    <div className="flex items-center gap-4 px-6 py-3 bg-white/5 rounded-2xl border border-white/5">
                        <RefreshCw className="w-5 h-5 text-blue-500 animate-spin" />
                        <span className="text-xs font-black uppercase tracking-[0.2em] text-slate-300">
                            Automatic reconnection in progress
                        </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-600">
                        <AlertTriangle className="w-3 h-3 text-amber-500" />
                        Authorized Admins can still bypass via direct login
                    </div>
                </div>

                {/* Technical status indicator */}
                <div className="mt-20 pt-8 border-t border-white/5 flex justify-center gap-12">
                    <div className="text-center">
                        <p className="text-[10px] font-black text-slate-600 uppercase mb-2">Backend</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500 animate-pulse"></div>
                            <span className="text-xs font-bold text-slate-400">Restarting</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black text-slate-600 uppercase mb-2">Frontend</p>
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-emerald-500"></div>
                            <span className="text-xs font-bold text-slate-400">Operational</span>
                        </div>
                    </div>
                    <div className="text-center">
                        <p className="text-[10px] font-black text-slate-600 uppercase mb-2">Environment</p>
                        <span className="text-xs font-bold text-slate-400">Production</span>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MaintenancePage;
