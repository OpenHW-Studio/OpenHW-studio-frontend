import React from 'react';
import AdminCard from './AdminCard';

const StatCard = ({ label, value, icon, color }) => {
    return (
        <AdminCard className="min-h-[200px] justify-between group relative overflow-hidden">
            {/* Background Glow */}
            <div className={`absolute -right-10 -top-10 w-24 h-24 blur-[60px] opacity-20 rounded-full ${color.replace('text-', 'bg-')}`}></div>
            
            <div className={`p-4 rounded-lg bg-slate-900/80 w-fit shadow-2xl mb-4 ${color} transition-transform group-hover:scale-110 border border-white/5`}>
                <div className="w-8 h-8">
                    {icon}
                </div>
            </div>
            
            <div className="space-y-1 w-full">
                <div className="text-4xl font-black text-white tracking-tighter leading-none">
                    {value}
                </div>
                <div className="text-slate-500 text-[10px] font-black uppercase tracking-[0.2em] opacity-80">
                    {label}
                </div>
            </div>
        </AdminCard>
    );
};

export default StatCard;
