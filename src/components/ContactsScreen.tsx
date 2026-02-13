import { useState, useEffect, useRef } from 'react';
import { Users, UserPlus, Search, Edit, X, FolderPlus, Trash2, Upload, Plus } from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from './ui/Table';
import { Badge } from './ui/Badge';
import { GroupSidebar } from './contacts/GroupSidebar';
import './contacts.css';
import * as XLSX from 'xlsx';

interface Contact {
    id?: number;
    name: string;
    phone: string;
    tag?: string;
}

export function ContactsScreen() {
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [loading, setLoading] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');

    // Navigation State
    const [activeTab, setActiveTab] = useState<'all' | 'groups'>('all');
    const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);

    // Modal State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [currentContact, setCurrentContact] = useState<Contact>({ name: '', phone: '', tag: '' });
    const [isEditing, setIsEditing] = useState(false);

    // Selection state for adding to groups
    const [selectedContactIds, setSelectedContactIds] = useState<Set<number>>(new Set());
    const [isGroupSelectModalOpen, setIsGroupSelectModalOpen] = useState(false);
    const [allGroups, setAllGroups] = useState<any[]>([]);

    // File input ref for Excel import
    const fileInputRef = useRef<HTMLInputElement>(null);


    // Let's go back to the pattern where loadContacts is defined outside, 
    // but the useEffect manages the race for the *initial* load on change.
    // For manual reloads (like after delete), we mostly care about the latest call.

    const loadContacts = async () => {
        if (window.electronAPI) {
            console.log('[Contacts] Manual load requested');
            try {
                const start = Date.now();
                let result;
                if (selectedGroupId) {
                    result = await window.electronAPI.getGroupMembers(selectedGroupId);
                } else {
                    result = await window.electronAPI.getContacts();
                }

                // We can't easily cancel the *previous* manual call without an AbortController,
                // but we can ensure we don't set state if the component is unmounted (though strictly less critical here).
                // For the "tab switch" race, useEffect is the key.
                console.log(`[Contacts] Loaded ${(result as any[]).length} contacts in ${Date.now() - start}ms`);
                setContacts(result as Contact[]);
                setSelectedContactIds(new Set());
            } catch (error) {
                console.error("Failed to load contacts:", error);
            }
        }
    };

    useEffect(() => {
        let active = true;
        const fetchWithRaceProtection = async () => {
            if (window.electronAPI) {
                console.log(`[Contacts] Effect load for group: ${selectedGroupId}`);
                try {
                    const start = Date.now();
                    let result;
                    if (selectedGroupId) {
                        result = await window.electronAPI.getGroupMembers(selectedGroupId);
                    } else {
                        result = await window.electronAPI.getContacts();
                    }

                    if (active) {
                        console.log(`[Contacts] Effect loaded ${(result as any[]).length} contacts in ${Date.now() - start}ms`);
                        setContacts(result as Contact[]);
                        setSelectedContactIds(new Set());
                    } else {
                        console.warn('[Contacts] Effect result IGNORED (stale)');
                    }
                } catch (error) {
                    console.error("Failed to load contacts:", error);
                }
            }
        };

        fetchWithRaceProtection();

        return () => {
            console.log(`[Contacts] Effect cleanup for group: ${selectedGroupId}`);
            active = false;
        };
    }, [selectedGroupId]);

    const loadGroups = async () => {
        if (window.electronAPI) {
            const groups = await window.electronAPI.getGroups();
            setAllGroups(groups);
        }
    }

    useEffect(() => {
        loadGroups();
    }, [activeTab, isGroupSelectModalOpen]);

    const handleOpenAddModal = () => {
        setCurrentContact({ name: '', phone: '', tag: '' });
        setIsEditing(false);
        setIsModalOpen(true);
    };

    const handleOpenEditModal = (contact: Contact) => {
        setCurrentContact(contact);
        setIsEditing(true);
        setIsModalOpen(true);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        setCurrentContact(prev => ({ ...prev, [name]: value }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!currentContact.name || !currentContact.phone) return;

        setLoading(true);
        if (window.electronAPI) {
            try {
                const res = await window.electronAPI.saveContact(currentContact);

                // If we are in a group view, maybe add the new contact to this group automatically?
                // For now, simpler to just reload. If in group view, it might disappear if not added.
                // Let's keep it simple: just save to DB.
                // Optionally if we have an ID from save and a selectedGroupId, we could add it.
                if (selectedGroupId && res && res.lastInsertRowid) {
                    await window.electronAPI.addContactToGroup(selectedGroupId, res.lastInsertRowid);
                }

                loadContacts();
                setIsModalOpen(false);
            } catch (error) {
                console.error("Failed to save contact:", error);
                alert("Failed to save contact");
            }
        }
        setLoading(false);
    };

    const toggleContactSelection = (id: number) => {
        const newSet = new Set(selectedContactIds);
        if (newSet.has(id)) newSet.delete(id);
        else newSet.add(id);
        setSelectedContactIds(newSet);
    }

    const handleAddToGroup = async (targetGroupId: number) => {
        if (window.electronAPI) {
            console.log(`[Contacts] Adding ${selectedContactIds.size} contacts to group ${targetGroupId}`);
            const start = Date.now();
            try {
                // Parallel execution for speed
                const promises = Array.from(selectedContactIds).map(contactId =>
                    window.electronAPI.addContactToGroup(targetGroupId, contactId)
                );
                await Promise.all(promises);

                console.log(`[Contacts] Added ${selectedContactIds.size} contacts in ${Date.now() - start}ms`);
                // Use a non-blocking notification if possible, or just log
                // alert('Contacts added to group'); 
            } catch (error) {
                console.error('[Contacts] Error adding to group:', error);
            }

            setIsGroupSelectModalOpen(false);
            setSelectedContactIds(new Set());
            // If we renamed the current view to that group, reload? 
            if (selectedGroupId === targetGroupId) loadContacts();
        }
    }

    const handleRemoveFromGroup = async () => {
        if (!selectedGroupId) return;
        // Non-blocking confirmation would be better (e.g. custom modal), but window.confirm is synchronous.
        // It pauses execution. If the user feels "frozen", it might be this dialog or the sequential ops after.
        if (!confirm(`Remove ${selectedContactIds.size} contacts from this group?`)) return;

        if (window.electronAPI) {
            console.log(`[Contacts] Removing ${selectedContactIds.size} contacts from group ${selectedGroupId}`);
            const start = Date.now();
            try {
                const promises = Array.from(selectedContactIds).map(contactId =>
                    window.electronAPI.removeContactFromGroup(selectedGroupId, contactId)
                );
                await Promise.all(promises);
                console.log(`[Contacts] Removed contacts in ${Date.now() - start}ms`);
            } catch (error) {
                console.error('[Contacts] Error removing from group:', error);
            }

            loadContacts();
            setSelectedContactIds(new Set());
        }
    }

    const handleDeleteGroup = async (id: number) => {
        if (confirm('Delete this group? Contacts will remain in "All Contacts".')) {
            if (window.electronAPI) {
                await window.electronAPI.deleteGroup(id);
                if (selectedGroupId === id) setSelectedGroupId(null);
                loadGroups();
            }
        }
    };

    const handleViewGroupsMembers = (groupId: number) => {
        setSelectedGroupId(groupId);
        setActiveTab('all');
    };

    const handleImportClick = () => {
        fileInputRef.current?.click();
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        console.log(`[Contacts] Importing file: ${file.name}`);
        const reader = new FileReader();
        reader.onload = async (evt) => {
            try {
                const bstr = evt.target?.result;
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws) as any[];

                console.log(`[Contacts] Parsed ${data.length} rows from Excel`);

                if (window.electronAPI) {
                    const start = Date.now();

                    // Debug: Log the first row to see keys
                    if (data.length > 0) {
                        console.log('[Contacts] First row keys:', Object.keys(data[0]));
                    }

                    // Helper to fuzzy get property (case-insensitive)
                    const getProp = (row: any, keys: string[]) => {
                        const rowKeys = Object.keys(row);
                        for (const k of keys) {
                            const foundKey = rowKeys.find(rk => rk.toLowerCase().trim() === k.toLowerCase());
                            if (foundKey) return row[foundKey];
                        }
                        return undefined;
                    };

                    // Helper to normalize phone numbers for comparison
                    // Removes all non-digits, then removes leading '00' or '0' if it looks like a prefix issue
                    // to ensure 961... matches 00961...
                    const normalizePhone = (p: string) => {
                        let cleaned = p.replace(/\D/g, ''); // Remove non-digits
                        // Remove leading '00'
                        if (cleaned.startsWith('00')) cleaned = cleaned.substring(2);
                        // Optional: Remove leading '0' if it's not part of the country code (complex, but for now 961 vs 00961 is the main issue)
                        // If user has 03123456 vs 9613123456, that's harder.
                        // Let's assume the user's issue is specifically 00961 vs 961.
                        // We can also strip leading '+' if we didn't use \D
                        return cleaned;
                    };

                    // 1. Fetch existing contacts to check for duplicates
                    console.log('[Contacts] Fetching existing contacts for duplicate check...');
                    const existingContacts = await window.electronAPI.getContacts();
                    const existingPhones = new Set(existingContacts.map((c: any) => normalizePhone(String(c.phone))));

                    let skippedCount = 0;
                    const promises = [];

                    for (const row of data) {
                        const name = getProp(row, ['name', 'full name', 'fullname']);
                        const phoneRaw = getProp(row, ['whatsapp', 'phone', 'mobile', 'cell', 'number']);
                        const tag = getProp(row, ['tag', 'label', 'category']) || 'Imported';

                        const phone = String(phoneRaw || '').trim();

                        if (!name || !phone) continue;

                        const normalizedInput = normalizePhone(phone);

                        if (existingPhones.has(normalizedInput)) {
                            // console.log(`[Contacts] Skipping duplicate: ${phone} (norm: ${normalizedInput})`);
                            skippedCount++;
                            continue;
                        }

                        // Add to set to prevent duplicates within the file itself
                        existingPhones.add(normalizedInput);

                        const contact = { name, phone, tag };
                        promises.push(window.electronAPI.saveContact(contact));
                    }

                    await Promise.all(promises);
                    console.log(`[Contacts] Imported ${promises.length} contacts, skipped ${skippedCount} duplicates in ${Date.now() - start}ms`);
                    alert(`Import finished!\n\n✅ Imported: ${promises.length}\n⚠️ Skipped (Duplicate): ${skippedCount}`);
                    loadContacts();
                }
            } catch (error) {
                console.error('[Contacts] Error parsing Excel:', error);
                alert('Failed to parse Excel file. Ensure columns: Name, WhatsApp, Tag');
            }
            // Reset input
            if (fileInputRef.current) fileInputRef.current.value = '';
        };
        reader.readAsBinaryString(file);
    };

    const filteredContacts = contacts.filter(c =>
        c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        c.phone.includes(searchTerm) ||
        (c.tag && c.tag.toLowerCase().includes(searchTerm.toLowerCase()))
    );

    const handleResetDatabase = async () => {
        if (confirm('Are you SURE you want to DELETE ALL DATA? This cannot be undone.')) {
            if (window.electronAPI) {
                await window.electronAPI.resetDatabase();
                alert('Database reset successfully. The page will reload.');
                window.location.reload();
            }
        }
    };

    return (
        <div className="contacts-container">
            <input
                type="file"
                ref={fileInputRef}
                className="hidden"
                accept=".xlsx, .xls"
                onChange={handleFileUpload}
            />
            <header className="page-header">
                <div>
                    <h1 className="page-title">
                        <Users className="text-emerald" size={32} />
                        Contacts Manager
                    </h1>
                    <p className="page-subtitle">Manage your audience database.</p>
                </div>
                <div className="flex gap-2">
                    <Button onClick={handleResetDatabase} variant="destructive" className="gap-2 bg-red-500/10 text-red-500 hover:bg-red-500/20 border-red-500/20">
                        <Trash2 size={18} />
                        Reset DB
                    </Button>
                    {selectedContactIds.size > 0 && (
                        <>
                            {selectedGroupId ? (
                                <Button variant="destructive" onClick={handleRemoveFromGroup}>
                                    Remove ({selectedContactIds.size})
                                </Button>
                            ) : (
                                <Button variant="secondary" onClick={() => setIsGroupSelectModalOpen(true)}>
                                    <FolderPlus size={18} className="mr-2" /> Add to Group ({selectedContactIds.size})
                                </Button>
                            )}
                        </>
                    )}
                    <Button onClick={handleImportClick} variant="outline" className="gap-2 border-emerald-500/20 hover:bg-emerald-500/10 text-emerald-400">
                        <Upload size={18} />
                        Import Excel
                    </Button>
                    <Button onClick={handleOpenAddModal} className="gap-2 bg-emerald-600 hover:bg-emerald-500 shadow-lg shadow-emerald-900/20">
                        <Plus size={18} />
                        Add Contact
                    </Button>
                </div>
            </header>

            <Card className="contacts-card flex-col overflow-hidden">
                <div className="pill-navbar-container">
                    <div className="pill-navbar">
                        <div className={`pill-indicator ${activeTab === 'groups' ? 'right' : ''}`} />
                        <button
                            className={`pill-button ${activeTab === 'all' ? 'active' : ''}`}
                            onClick={() => { setActiveTab('all'); setSelectedGroupId(null); }}
                        >
                            <Users size={18} />
                            All Contacts
                        </button>
                        <button
                            className={`pill-button ${activeTab === 'groups' ? 'active' : ''}`}
                            onClick={() => setActiveTab('groups')}
                        >
                            <FolderPlus size={18} />
                            Groups
                        </button>
                    </div>
                </div>

                <div className="flex-1 flex min-w-0 min-h-0">
                    <GroupSidebar
                        selectedGroupId={selectedGroupId}
                        onSelectGroup={setSelectedGroupId}
                        activeTab={activeTab}
                        onTabChange={setActiveTab}
                    />

                    <div className="flex-1 flex flex-col min-w-0 min-h-0 border-l border-slate-700">
                        {(activeTab === 'all' || activeTab === 'groups') ? (
                            <>
                                <div className="contacts-toolbar">
                                    <h3 className="toolbar-title text-emerald">
                                        {selectedGroupId ? 'Group Contacts' : 'All Contacts'}
                                        <span className="count-badge">({contacts.length})</span>
                                    </h3>
                                    <div className="search-wrapper">
                                        <Search size={16} className="search-icon" />
                                        <Input
                                            placeholder="Search contacts..."
                                            value={searchTerm}
                                            onChange={e => setSearchTerm(e.target.value)}
                                            className="search-input"
                                        />
                                    </div>
                                </div>

                                <div className="contacts-scroll-area">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="table-header-row">
                                                <TableHead className="w-[50px]">
                                                    <input
                                                        type="checkbox"
                                                        checked={filteredContacts.length > 0 && selectedContactIds.size === filteredContacts.length}
                                                        onChange={(e) => {
                                                            if (e.target.checked) {
                                                                setSelectedContactIds(new Set(filteredContacts.map(c => c.id!)));
                                                            } else {
                                                                setSelectedContactIds(new Set());
                                                            }
                                                        }}
                                                        className="rounded border-slate-600 bg-slate-800"
                                                    />
                                                </TableHead>
                                                <TableHead className="w-30">Name</TableHead>
                                                <TableHead className="w-30">Phone</TableHead>
                                                <TableHead className="w-20">Tag</TableHead>
                                                <TableHead className="w-20 text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {filteredContacts.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={5} className="empty-cell">
                                                        {searchTerm ? 'No matching contacts found.' : 'No contacts in this view.'}
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                filteredContacts.map((c, idx) => (
                                                    <TableRow key={c.id || idx} className={selectedContactIds.has(c.id!) ? 'bg-emerald-500/5' : ''}>
                                                        <TableCell>
                                                            <input
                                                                type="checkbox"
                                                                checked={selectedContactIds.has(c.id!)}
                                                                onChange={() => toggleContactSelection(c.id!)}
                                                                className="rounded border-slate-600 bg-slate-800"
                                                            />
                                                        </TableCell>
                                                        <TableCell className="font-medium text-slate-100">{c.name}</TableCell>
                                                        <TableCell className="font-mono text-slate-400">{c.phone}</TableCell>
                                                        <TableCell>
                                                            {c.tag ? (
                                                                <Badge variant="secondary" className="text-xs">
                                                                    {c.tag}
                                                                </Badge>
                                                            ) : <span className="text-muted">-</span>}
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <Button
                                                                variant="ghost"
                                                                size="icon"
                                                                onClick={() => handleOpenEditModal(c)}
                                                                className="action-btn"
                                                                title="Edit Contact"
                                                            >
                                                                <Edit size={16} />
                                                            </Button>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        ) : (
                            <>
                                <div className="contacts-toolbar">
                                    <h3 className="toolbar-title text-emerald">
                                        Contact Groups
                                        <span className="count-badge">({allGroups.length})</span>
                                    </h3>
                                </div>

                                <div className="contacts-scroll-area">
                                    <Table>
                                        <TableHeader>
                                            <TableRow className="table-header-row">
                                                <TableHead className="w-[60%]">Group Name</TableHead>
                                                <TableHead className="w-[40%] text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {allGroups.length === 0 ? (
                                                <TableRow>
                                                    <TableCell colSpan={2} className="empty-cell">
                                                        No groups created yet.
                                                    </TableCell>
                                                </TableRow>
                                            ) : (
                                                allGroups.map((g) => (
                                                    <TableRow key={g.id}>
                                                        <TableCell className="font-medium text-slate-100">
                                                            <div className="flex items-center gap-2">
                                                                <FolderPlus size={16} className="text-emerald" />
                                                                {g.name}
                                                            </div>
                                                        </TableCell>
                                                        <TableCell className="text-right">
                                                            <div className="flex justify-end gap-2">
                                                                <Button
                                                                    variant="secondary"
                                                                    size="sm"
                                                                    onClick={() => handleViewGroupsMembers(g.id)}
                                                                    className="h-8"
                                                                >
                                                                    View Members
                                                                </Button>
                                                                <Button
                                                                    variant="ghost"
                                                                    size="icon"
                                                                    onClick={() => handleDeleteGroup(g.id)}
                                                                    className="h-8 w-8 text-slate-400 hover:text-destructive"
                                                                >
                                                                    <Trash2 size={16} />
                                                                </Button>
                                                            </div>
                                                        </TableCell>
                                                    </TableRow>
                                                ))
                                            )}
                                        </TableBody>
                                    </Table>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </Card>

            {/* Add Contact Modal */}
            {
                isModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsModalOpen(false)}>
                        <Card className="modal-card animate-in" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">
                                    {isEditing ? <Edit size={20} className="text-emerald" /> : <UserPlus size={20} className="text-emerald" />}
                                    {isEditing ? 'Edit Contact' : 'Add New Contact'}
                                </h2>
                                <Button variant="ghost" size="icon" onClick={() => setIsModalOpen(false)} className="close-btn">
                                    <X size={20} />
                                </Button>
                            </div>
                            <CardContent className="pt-6">
                                <form onSubmit={handleSubmit} className="space-y-4">
                                    <div className="form-group">
                                        <Input
                                            label="Name"
                                            name="name"
                                            value={currentContact.name}
                                            onChange={handleInputChange}
                                            placeholder="John Doe"
                                            required
                                            autoFocus
                                        />
                                    </div>

                                    <div className="form-group">
                                        <Input
                                            label="WhatsApp Number"
                                            name="phone"
                                            value={currentContact.phone}
                                            onChange={handleInputChange}
                                            placeholder="1234567890"
                                            required
                                        />
                                    </div>

                                    <div className="form-group">
                                        <Input
                                            label="Tag (Optional)"
                                            name="tag"
                                            value={currentContact.tag || ''}
                                            onChange={handleInputChange}
                                            placeholder="Client, Lead, etc."
                                        />
                                    </div>

                                    <div className="modal-actions">
                                        <Button type="button" variant="ghost" onClick={() => setIsModalOpen(false)}>
                                            Cancel
                                        </Button>
                                        <Button type="submit" disabled={loading} className="min-w-100">
                                            {loading ? 'Saving...' : isEditing ? 'Update' : 'Save'}
                                        </Button>
                                    </div>
                                </form>
                            </CardContent>
                        </Card>
                    </div>
                )
            }

            {/* Group Select Modal */}
            {
                isGroupSelectModalOpen && (
                    <div className="modal-overlay" onClick={() => setIsGroupSelectModalOpen(false)}>
                        <Card className="modal-card animate-in" onClick={e => e.stopPropagation()}>
                            <div className="modal-header">
                                <h2 className="modal-title">Add to Group</h2>
                                <Button variant="ghost" size="icon" onClick={() => setIsGroupSelectModalOpen(false)} className="close-btn"><X size={20} /></Button>
                            </div>
                            <CardContent>
                                <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto">
                                    {allGroups.map(g => (
                                        <Button key={g.id} variant="secondary" className="justify-start" onClick={() => handleAddToGroup(g.id)}>
                                            <FolderPlus size={16} className="mr-2" /> {g.name}
                                        </Button>
                                    ))}
                                    {allGroups.length === 0 && <p className="text-center text-muted p-4">No groups found. Create one first.</p>}
                                </div>
                            </CardContent>
                        </Card>
                    </div>
                )
            }
        </div >
    );
}
