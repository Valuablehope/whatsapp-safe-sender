import { Send, LayoutDashboard, Users, FileText, Wifi, WifiOff } from 'lucide-react';
import { cn } from '../../lib/utils';
import { Badge } from '../ui/Badge';
import './sidebar.css';

interface SidebarProps {
    currentView: string;
    onViewChange: (view: string) => void;
    status: string;
}

export function Sidebar({ currentView, onViewChange, status }: SidebarProps) {
    const navItems = [
        { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
        { id: 'contacts', label: 'Contacts', icon: Users },
        { id: 'campaign', label: 'Campaign', icon: FileText },
        { id: 'logs', label: 'Logs', icon: FileText },
    ];

    return (
        <aside className="sidebar">
            <div className="sidebar-header">
                <Send className="text-emerald" size={28} />
                <h1 className="sidebar-title">AntiBan Pro</h1>
            </div>

            <nav className="sidebar-nav">
                {navItems.map((item) => {
                    const Icon = item.icon;
                    return (
                        <button
                            key={item.id}
                            onClick={() => onViewChange(item.id)}
                            className={cn('nav-item', currentView === item.id && 'active')}
                        >
                            <Icon size={20} />
                            <span>{item.label}</span>
                        </button>
                    );
                })}
            </nav>

            <div className="sidebar-footer">
                <div className="status-indicator">
                    <div className="flex items-center gap-2 mb-2">
                        {status === 'ready' ? (
                            <Wifi size={16} className="text-emerald" />
                        ) : (
                            <WifiOff size={16} className="text-rose" />
                        )}
                        <span className="text-xs font-medium text-slate-400">
                            {status === 'ready' ? 'System Online' : 'Disconnected'}
                        </span>
                    </div>
                    {/* Debug: Show raw status */}
                    <div className="text-[10px] text-slate-600 mb-1 font-mono uppercase">
                        STATUS: {status}
                    </div>
                    <Badge variant={status === 'ready' ? 'default' : 'destructive'} className="justify-center">
                        {status === 'ready' ? 'ACTIVE' : 'OFFLINE'}
                    </Badge>
                </div>
            </div>
        </aside>
    );
}
