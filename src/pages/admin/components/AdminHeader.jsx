import React from 'react';
import { RefreshCw, Menu } from 'lucide-react';

const AdminHeader = ({ activeTab, onRefresh, onToggleSidebar }) => {
    return (
        <header className="flex justify-between items-center lg:items-end mb-8 md:mb-12 lg:mb-16 gap-4">
            <div className="flex items-center gap-4">
                {/* Mobile Hamburger */}
                <button 
                    onClick={onToggleSidebar}
                    className="p-3 bg-slate-800/50 hover:bg-slate-800 rounded-xl lg:hidden text-slate-300 border border-white/5"
                >
                    <Menu className="w-6 h-6" />
                </button>
                
                <div>
                    <h1 className="text-2xl md:text-3xl lg:text-4xl font-black capitalize tracking-tight text-white mb-1 md:mb-2">
                        {activeTab.replace('-', ' ')}
                    </h1>
                    <p className="text-slate-400 text-sm md:text-base lg:text-lg font-medium line-clamp-1">Management Portal</p>
                </div>
            </div>
            
            <button 
                onClick={onRefresh}
                className="p-3 md:p-4 bg-slate-800/50 hover:bg-slate-800 rounded-xl md:rounded-2xl transition-all text-slate-300 border border-white/5 shrink-0"
                title="Refresh Data"
            >
                <RefreshCw className="w-5 h-5 md:w-6 h-6" />
            </button>
        </header>
    );
};

export default AdminHeader;
