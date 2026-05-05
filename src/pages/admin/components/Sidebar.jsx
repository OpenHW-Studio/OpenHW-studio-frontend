import React from 'react';
import { 
    LayoutDashboard, 
    Globe,
    Library, 
    Clock, 
    Puzzle, 
    UploadCloud, 
    Terminal, 
    LogOut, 
    Activity,
    Box,
    X,
    Package,
    PlayCircle,
    ShieldCheck,
    AlertTriangle
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose, activeTab, setActiveTab, onLogout, maintenanceMode, onToggleMaintenance }) => {
    const menuItems = [
        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
        { id: 'map', icon: Globe, label: 'User Map' },
        { id: 'libraries', icon: Library, label: 'Libraries' },
        { id: 'approval', icon: Clock, label: 'Approvals' },
        { id: 'components', label: 'Custom Components', icon: Package },
        { id: 'deployments', label: 'CI/CD Workflow', icon: PlayCircle },
        { id: 'docker', label: 'Docker Monitoring', icon: Box },
        { id: 'history', label: 'Security History', icon: ShieldCheck },
        { id: 'logs', label: 'System Logs', icon: Terminal },
    ];

    return (
        <aside className={`
            fixed inset-y-0 left-0 z-50 w-80 bg-[#0d1525] border-r border-white/10 flex flex-col p-10 transition-transform duration-300 ease-in-out
            lg:relative lg:translate-x-0
            ${isOpen ? 'translate-x-0' : '-translate-x-full'}
        `}>
            <div className="flex items-center justify-between gap-4 px-2 mb-16 mt-6">
                <div className="flex items-center gap-5">
                    <span className="text-3xl font-black tracking-tighter uppercase text-white">
                        Admin<span className="text-blue-500">Hub</span>
                    </span>
                </div>
                <button 
                    onClick={onClose}
                    className="p-2 text-slate-500 hover:text-white lg:hidden"
                >
                    <X className="w-6 h-6" />
                </button>
            </div>

            <nav className="flex-1 space-y-5">
                {menuItems.map((item) => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={`w-full flex items-center gap-6 px-10 py-6 rounded-xl transition-all font-black text-xl group ${
                            activeTab === item.id 
                            ? 'bg-blue-600 text-white shadow-2xl shadow-blue-600/40' 
                            : 'text-slate-500 hover:text-slate-200 hover:bg-white/5'
                        }`}
                    >
                        <item.icon className={`w-7 h-7 transition-colors ${activeTab === item.id ? 'text-white' : 'text-slate-500 group-hover:text-slate-200'}`} />
                        <span className="truncate">{item.label}</span>
                    </button>
                ))}
            </nav>

            <div className="mt-auto space-y-4 pt-8 border-t border-white/10 mb-6">
                <div className={`p-6 rounded-2xl border transition-all ${maintenanceMode ? 'bg-amber-500/10 border-amber-500/20' : 'bg-white/5 border-white/5'}`}>
                    <div className="flex items-center justify-between gap-4 mb-4">
                        <div className="flex items-center gap-3">
                            <AlertTriangle className={`w-4 h-4 ${maintenanceMode ? 'text-amber-500' : 'text-slate-500'}`} />
                            <span className={`text-[10px] font-black uppercase tracking-widest ${maintenanceMode ? 'text-amber-500' : 'text-slate-500'}`}>
                                Maintenance
                            </span>
                        </div>
                        <button 
                            onClick={() => onToggleMaintenance(!maintenanceMode)}
                            className={`w-10 h-5 rounded-full relative transition-all ${maintenanceMode ? 'bg-amber-500' : 'bg-slate-700'}`}
                        >
                            <div className={`absolute top-1 w-3 h-3 bg-white rounded-full transition-all ${maintenanceMode ? 'left-6' : 'left-1'}`}></div>
                        </button>
                    </div>
                    <p className="text-[9px] text-slate-500 font-bold leading-tight">
                        {maintenanceMode ? 'System is currently restricted to admins.' : 'System is live for all users.'}
                    </p>
                </div>

                <button 
                    onClick={onLogout}
                    className="w-full flex items-center gap-6 px-10 py-6 rounded-xl text-slate-500 hover:text-red-400 hover:bg-red-500/10 transition-all font-black text-xl"
                >
                    <LogOut className="w-7 h-7" />
                    Sign Out
                </button>
            </div>
        </aside>
    );
};

export default Sidebar;
