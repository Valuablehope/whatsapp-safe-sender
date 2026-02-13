import { useState, useEffect } from 'react';
import { Plus, Trash2, Folder, Users } from 'lucide-react';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';

import './groups.css';

interface Group {
    id: number;
    name: string;
    description?: string;
}

interface GroupSidebarProps {
    selectedGroupId: number | null;
    onSelectGroup: (groupId: number | null) => void;
    activeTab: 'all' | 'groups';
    onTabChange: (tab: 'all' | 'groups') => void;
}

export function GroupSidebar({ selectedGroupId, onSelectGroup, activeTab, onTabChange }: GroupSidebarProps) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [isCreating, setIsCreating] = useState(false);
    const [newGroupName, setNewGroupName] = useState('');

    useEffect(() => {
        loadGroups();
    }, []);

    useEffect(() => {
        if (selectedGroupId !== null) {
            onTabChange('groups');
        }
    }, [selectedGroupId]);

    const loadGroups = async () => {
        if (window.electronAPI) {
            const res = await window.electronAPI.getGroups();
            setGroups(res);
        }
    };

    const handleCreateGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        const name = newGroupName.trim();
        if (!name) return;

        if (window.electronAPI) {
            console.log(`[GroupSidebar] Creating group: ${name}`);
            try {
                // Optimistic UI or just prevent double submission
                if (isCreating) {
                    // We are creating.
                }

                await window.electronAPI.createGroup(name);
                console.log('[GroupSidebar] Group created successfully');

                // Close form *after* success
                setNewGroupName('');
                setIsCreating(false);

                // Reload groups to update list
                loadGroups();
            } catch (error) {
                console.error('[GroupSidebar] Failed to create group:', error);
            }
        }
    };

    const handleDeleteGroup = async (e: React.MouseEvent, id: number) => {
        e.stopPropagation();
        if (confirm('Delete this group? Contacts will remain in "All Contacts".')) {
            if (window.electronAPI) {
                await window.electronAPI.deleteGroup(id);
                if (selectedGroupId === id) onSelectGroup(null);
                loadGroups();
            }
        }
    };

    if (activeTab === 'all' && !selectedGroupId) return null;

    return (
        <div className="group-sidebar animate-in slide-in-from-left duration-300">
            <div className="group-sidebar-header">
                <span className="text-xs font-semibold text-slate-400 uppercase tracking-wider">
                    {activeTab === 'groups' ? 'Group Management' : 'Groups'}
                </span>
                {activeTab === 'groups' && (
                    <Button variant="ghost" size="icon" onClick={() => setIsCreating(true)} className="h-6 w-6 hover:bg-emerald-500/10 hover:text-emerald-400">
                        <Plus size={16} />
                    </Button>
                )}
            </div>

            {selectedGroupId && activeTab === 'all' && (
                <div className="mb-4">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="w-full justify-start text-xs text-emerald-400 hover:text-emerald-300 hover:bg-emerald-500/5"
                        onClick={() => onSelectGroup(null)}
                    >
                        <Users size={14} className="mr-2" /> Show All Contacts
                    </Button>
                </div>
            )}

            {isCreating && activeTab === 'groups' && (
                <div className="p-3 mb-4 rounded-xl bg-slate-800/50 border border-slate-700/50 animate-in fade-in slide-in-from-top-2 duration-300">
                    <form onSubmit={handleCreateGroup}>
                        <Input
                            autoFocus
                            placeholder="Enter group name..."
                            value={newGroupName}
                            onChange={e => setNewGroupName(e.target.value)}
                            className="h-9 text-sm mb-3 bg-slate-900/50 border-slate-700 focus:border-emerald-500/50"
                        />
                        <div className="flex gap-2 justify-end">
                            <Button size="sm" variant="ghost" onClick={() => setIsCreating(false)} className="h-7 px-3 text-xs">Cancel</Button>
                            <Button size="sm" type="submit" className="h-7 px-4 text-xs bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald">Create</Button>
                        </div>
                    </form>
                </div>
            )}

            <div className="group-list">
                {groups.map(g => (
                    <div
                        key={g.id}
                        className={`group-item ${selectedGroupId === g.id ? 'active' : ''}`}
                        onClick={() => onSelectGroup(g.id)}
                    >
                        <div className="flex items-center gap-2 overflow-hidden">
                            <Folder size={16} className={selectedGroupId === g.id ? 'text-emerald-400' : 'text-slate-500'} />
                            <span className="truncate">{g.name}</span>
                        </div>
                        <div className="group-actions">
                            <button
                                className="delete-group-btn"
                                onClick={(e) => handleDeleteGroup(e, g.id)}
                            >
                                <Trash2 size={12} />
                            </button>
                        </div>
                    </div>
                ))}
                {groups.length === 0 && (activeTab === 'groups' ? !isCreating : true) && (
                    <div className="text-center py-8">
                        <Folder className="mx-auto h-8 w-8 text-slate-700 mb-2" />
                        <p className="text-xs text-slate-500">No groups yet.</p>
                    </div>
                )}
            </div>
        </div>
    );
}
