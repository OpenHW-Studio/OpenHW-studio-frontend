import React from 'react';
import { 
    LayoutDashboard, 
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
    ShieldCheck
} from 'lucide-react';

const Sidebar = ({ isOpen, onClose, activeTab, setActiveTab, onLogout }) => {
    const menuItems = [
        { id: 'overview', icon: LayoutDashboard, label: 'Overview' },
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

            <div className="mt-auto pt-8 border-t border-white/10 mb-6">
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
