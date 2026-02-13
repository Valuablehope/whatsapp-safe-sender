import { useState, useRef } from 'react';
import { useElectron } from '../hooks/useElectron';
import { Send, FileText, Users, Plus, Upload, Trash2, X, Check, Image as ImageIcon, Paperclip } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Badge } from './ui/Badge';
import './campaign.css';

interface Contact {
    id?: number;
    name: string;
    phone: string;
    tag: string;
}

export const CampaignScreen = ({ status }: { status: string }) => {
    // ... logic remains same ...
    const { createTemplate, startCampaign, saveContact, getContacts } = useElectron();
    const [templateBody, setTemplateBody] = useState('');
    const [variations, setVariations] = useState<string[]>(['']);
    const [mediaPath, setMediaPath] = useState<string | null>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);

    // Modal State
    const [showContactModal, setShowContactModal] = useState(false);
    const [dbContacts, setDbContacts] = useState<Contact[]>([]);
    const [dbGroups, setDbGroups] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');

    const { getGroups, getGroupMembers } = useElectron();

    // ... handlers ...


    const clearMedia = () => {
        setMediaPath(null);
        if (mediaInputRef.current) mediaInputRef.current.value = '';
    }

    const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const reader = new FileReader();
        reader.onload = (event) => {
            const text = event.target?.result as string;
            const lines = text.split('\n');
            const parsedContacts: Contact[] = [];

            lines.forEach(line => {
                const [name, phone, tag] = line.split(',');
                if (phone) {
                    parsedContacts.push({
                        name: name.trim(),
                        phone: phone.trim().replace(/\D/g, ''),
                        tag: (tag || '').trim()
                    });
                }
            });
            setContacts(prev => [...prev, ...parsedContacts]);
        };
        reader.readAsText(file);
    };

    const handleLoadContacts = async () => {
        try {
            const [contactsRes, groupsRes] = await Promise.all([
                getContacts(),
                getGroups()
            ]);
            setDbContacts(contactsRes);
            setDbGroups(groupsRes || []);
            setShowContactModal(true);
        } catch (error) {
            console.error(error);
            alert("Failed to load contacts");
        }
    };

    const toggleGroupSelection = async (groupId: number) => {
        console.log(`[Campaign] Toggling group ${groupId}`);
        try {
            const start = Date.now();
            const members = await getGroupMembers(groupId);
            console.log(`[Campaign] Fetched ${members.length} members for group ${groupId} in ${Date.now() - start}ms`);
            const memberIds = members.map((m: any) => m.id);

            setSelectedIds(prev => {
                const newSelected = new Set(prev);
                const allSelected = memberIds.every((id: number) => newSelected.has(id));

                if (allSelected) {
                    memberIds.forEach((id: number) => newSelected.delete(id));
                } else {
                    memberIds.forEach((id: number) => newSelected.add(id));
                }
                console.log(`[Campaign] Group selection updated. Total selected: ${newSelected.size}`);
                return newSelected;
            });
        } catch (error) {
            console.error('[Campaign] Error toggling group:', error);
        }
    };

    const toggleContactSelection = (id: number) => {
        setSelectedIds(prev => {
            const newSelected = new Set(prev);
            if (newSelected.has(id)) {
                newSelected.delete(id);
            } else {
                newSelected.add(id);
            }
            // console.log(`[Campaign] Toggled contact ${id}. Total: ${newSelected.size}`);
            return newSelected;
        });
    };

    const confirmSelection = () => {
        const selectedContacts = dbContacts.filter(c => c.id !== undefined && selectedIds.has(c.id));
        console.log(`[Campaign] Confirming selection. Adding ${selectedContacts.length} contacts.`);
        setContacts(prev => {
            const existingPhones = new Set(prev.map(c => c.phone));
            const newToAdd = selectedContacts.filter(c => !existingPhones.has(c.phone));
            console.log(`[Campaign] Actually added ${newToAdd.length} new unique contacts.`);
            return [...prev, ...newToAdd];
        });
        setShowContactModal(false);
        setSelectedIds(new Set());
    };

    const addVariation = () => setVariations([...variations, '']);
    const updateVariation = (index: number, val: string) => {
        const newVars = [...variations];
        newVars[index] = val;
        setVariations(newVars);
    };

    const handleStart = async () => {
        console.log('[Campaign] Start requested');
        if (isProcessing) {
            console.warn('[Campaign] Start ignored: already processing');
            return;
        }
        if (status !== 'ready') return alert('WhatsApp not connected!');
        if (contacts.length === 0) return alert('No contacts!');
        if (!templateBody.trim()) return alert('Template required!');

        setIsProcessing(true);
        try {
            console.log(`[Campaign] Creating template and resolving ${contacts.length} contacts...`);
            const tpl = await createTemplate({
                title: 'Auto Campaign ' + new Date().toLocaleTimeString(),
                body: templateBody,
                variations: variations.filter(v => v.trim() !== ''),
                mediaPath: mediaPath
            });

            const contactIds: number[] = [];
            for (const c of contacts) {
                if (c.id) {
                    contactIds.push(c.id);
                } else {
                    try {
                        const res = await saveContact(c);
                        if (res && res.lastInsertRowid) contactIds.push(res.lastInsertRowid as number);
                    } catch (e) {
                        console.log('Contact skip/error', e);
                    }
                }
            }

            if (contactIds.length === 0) {
                alert('Could not resolve any valid contacts.');
                setIsProcessing(false);
                return;
            }

            console.log(`[Campaign] Starting campaign ${tpl.id} with ${contactIds.length} recipients`);
            await startCampaign(tpl.id, contactIds);
            alert(`Campaign Started with ${contactIds.length} contacts!`);
            setContacts([]);
            setTemplateBody('');
            setMediaPath(null);
        } catch (err: any) {
            console.error('[Campaign] Error starting:', err);
            alert('Error: ' + err.message);
        }
        setIsProcessing(false);
    };

    const estimatedTime = () => {
        const totalMsgs = contacts.length;
        if (totalMsgs === 0) return '0 mins';
        const sendTime = totalMsgs * 16.5;
        const pauses = Math.floor(totalMsgs / 6) * 120;
        const totalSeconds = sendTime + pauses;
        const mins = Math.ceil(totalSeconds / 60);
        return `${mins} mins`;
    };

    return (
        <div className="flex flex-col gap-6 h-full w-full">
            <header className="pb-6 border-b" style={{ borderColor: 'var(--border)' }}>
                <h1 className="text-3xl font-bold flex items-center gap-3 mb-2 text-slate-100">
                    <Send className="text-emerald" size={32} />
                    Create Campaign
                </h1>
                <p className="text-slate-400">Configure and launch your bulk messaging campaign.</p>
            </header>

            <div className="campaign-grid">
                {/* Left Column: Template */}
                <Card className="flex flex-col bg-surface">
                    <CardHeader className="border-b">
                        <div className="flex items-center gap-2 text-slate-100">
                            <FileText size={20} className="text-emerald" />
                            <CardTitle>Message Template</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col pt-6 space-y-6">
                        <textarea
                            placeholder="Hello {name}, ...\n\nWrite your message here."
                            value={templateBody}
                            onChange={e => setTemplateBody(e.target.value)}
                            className="campaign-textarea"
                        />

                        <div className="space-y-2">
                            <label className="text-sm font-medium text-slate-400 flex items-center gap-2">
                                <Paperclip size={16} /> Attach Media (Image/Video)
                            </label>
                            <div className="flex items-center gap-3">
                                <input
                                    type="file"
                                    accept="image/*,video/*"
                                    onChange={async (e) => {
                                        const file = e.target.files?.[0];
                                        if (file) {
                                            try {
                                                // Use helper to get real path (Electron specific)
                                                const path = window.electronAPI.getFilePath(file);
                                                setUploadProgress(0);

                                                // Listen for progress
                                                const removeListener = window.electronAPI.onMediaUploadProgress((percent) => {
                                                    setUploadProgress(percent);
                                                });

                                                const newPath = await window.electronAPI.uploadMedia(path);
                                                setMediaPath(newPath);
                                                setUploadProgress(null); // Done
                                                // @ts-ignore
                                                if (removeListener) removeListener(); // Cleanup if possible, though IPC endpoint might not return un-sub
                                            } catch (error) {
                                                console.error("Upload failed", error);
                                                alert("Failed to upload/compress media");
                                                setUploadProgress(null);
                                            }
                                        }
                                    }}
                                    className="hidden"
                                    ref={mediaInputRef}
                                />
                                <Button
                                    variant="secondary"
                                    onClick={() => mediaInputRef.current?.click()}
                                    className="gap-2"
                                    disabled={uploadProgress !== null}
                                >
                                    <ImageIcon size={16} />
                                    {mediaPath ? 'Change Media' : 'Select Media'}
                                </Button>

                                {uploadProgress !== null && (
                                    <div className="flex-1 flex items-center gap-2">
                                        <div className="h-2 flex-1 bg-slate-700 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-emerald-500 transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                        <span className="text-xs text-slate-400">{uploadProgress}%</span>
                                    </div>
                                )}

                                {mediaPath && uploadProgress === null && (
                                    <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded text-sm text-slate-300">
                                        <span className="truncate max-w-[200px]">{mediaPath.split(/[/\\]/).pop()}</span>
                                        <button onClick={clearMedia} className="text-red-400 hover:text-red-300">
                                            <X size={14} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="space-y-4 flex-1">
                            <label className="text-sm font-medium text-slate-400 flex items-center justify-between">
                                <span>Variations (Anti-Ban)</span>
                                <span className="text-xs text-slate-400 font-normal">Optional</span>
                            </label>
                            <div className="variations-list">
                                {variations.map((v, i) => (
                                    <Input
                                        key={i}
                                        placeholder={`Variation ${i + 1}`}
                                        value={v}
                                        onChange={e => updateVariation(i, e.target.value)}
                                    />
                                ))}
                            </div>
                            <Button variant="secondary" onClick={addVariation} className="w-full gap-2">
                                <Plus size={16} /> Add Variation
                            </Button>
                        </div>

                        <div className="tip-box">
                            <p className="text-xs text-slate-400">
                                <span className="text-emerald font-bold">💡 Tip:</span> Use <code className="code-tag">{`{name}`}</code> to personalize messages.
                            </p>
                        </div>
                    </CardContent>
                </Card>

                {/* Right Column: Contacts */}
                <Card className="flex flex-col bg-surface">
                    <CardHeader className="border-b">
                        <div className="flex items-center gap-2 text-slate-100">
                            <Users size={20} className="text-emerald" />
                            <CardTitle>Recipients</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="flex-1 flex flex-col pt-6">
                        <div className="flex flex-wrap gap-3 mb-6">
                            <label className="btn btn-secondary flex-1 cursor-pointer">
                                <Upload size={16} className="mr-2" />
                                Import CSV
                                <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                            </label>
                            <Button variant="secondary" onClick={handleLoadContacts} className="flex-1 gap-2">
                                <Users size={16} /> Saved
                            </Button>
                            <Button
                                variant="destructive"
                                onClick={() => setContacts([])}
                                size="icon"
                                className="flex-none"
                                title="Clear all contacts"
                            >
                                <Trash2 size={16} />
                            </Button>
                        </div>

                        <div className="contacts-list-container">
                            {contacts.length === 0 ? (
                                <div className="empty-state">
                                    <Users size={40} className="opacity-20" />
                                    <p className="text-sm">No contacts added yet</p>
                                </div>
                            ) : (
                                <div className="space-y-1">
                                    {contacts.slice(0, 50).map((c, i) => (
                                        <div key={i} className="contact-item">
                                            <div>
                                                <p className="font-medium text-slate-100 text-sm">{c.name}</p>
                                                <p className="text-xs text-slate-400 font-mono">{c.phone}</p>
                                            </div>
                                            {c.tag && <Badge variant="secondary">{c.tag}</Badge>}
                                        </div>
                                    ))}
                                    {contacts.length > 50 && (
                                        <p className="text-center text-xs text-slate-400 mt-3 py-2">And {contacts.length - 50} more...</p>
                                    )}
                                </div>
                            )}
                        </div>

                        {contacts.length > 0 && (
                            <div className="footer-stats">
                                <span>Total: <strong className="text-slate-100 ml-1">{contacts.length}</strong></span>
                                <span>Est. Time: <strong className="text-emerald ml-1">{estimatedTime()}</strong></span>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>

            <Button
                variant="primary"
                size="lg"
                className="w-full py-6 text-lg mt-auto"
                onClick={handleStart}
                disabled={isProcessing || contacts.length === 0}
            >
                {isProcessing ? (
                    <>
                        <span className="animate-spin mr-2">⏳</span> Starting Campaign...
                    </>
                ) : (
                    <>
                        <Send size={20} className="mr-2" /> START SAFE CAMPAIGN
                    </>
                )}
            </Button>

            {/* Selection Modal */}
            {showContactModal && (
                <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
                    <Card className="modal-card" onClick={e => e.stopPropagation()}>
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Users size={20} className="text-emerald" />
                                Select Contacts
                            </CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowContactModal(false)}>
                                <X size={20} />
                            </Button>
                        </CardHeader>

                        <CardContent className="pt-0 p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
                            <div className="flex border-b border-slate-700">
                                <button
                                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'contacts' ? 'text-emerald border-b-2 border-emerald bg-emerald-500/5' : 'text-slate-400 hover:text-slate-200'}`}
                                    onClick={() => setActiveTab('contacts')}
                                >
                                    Individual Contacts
                                </button>
                                <button
                                    className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'groups' ? 'text-emerald border-b-2 border-emerald bg-emerald-500/5' : 'text-slate-400 hover:text-slate-200'}`}
                                    onClick={() => setActiveTab('groups')}
                                >
                                    Groups
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {activeTab === 'contacts' ? (
                                    dbContacts.length === 0 ? (
                                        <div className="empty-state h-full">
                                            <Users size={32} className="opacity-20 mb-2" />
                                            <p>No saved contacts found.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {dbContacts.map(c => (
                                                <div
                                                    key={c.id}
                                                    className={`contact-select-item ${selectedIds.has(c.id!) ? 'selected' : ''}`}
                                                    onClick={() => c.id && toggleContactSelection(c.id)}
                                                >
                                                    <div className={`checkbox ${selectedIds.has(c.id!) ? 'checked' : ''}`}>
                                                        {selectedIds.has(c.id!) && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`font-medium text-sm ${selectedIds.has(c.id!) ? 'text-emerald' : 'text-slate-100'}`}>{c.name}</p>
                                                        <p className="text-xs text-slate-400">{c.phone}</p>
                                                    </div>
                                                    {c.tag && <Badge variant="outline">{c.tag}</Badge>}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    dbGroups.length === 0 ? (
                                        <div className="empty-state h-full">
                                            <Users size={32} className="opacity-20 mb-2" />
                                            <p>No groups found. Create one in Contacts.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {dbGroups.map(g => (
                                                <div
                                                    key={g.id}
                                                    className="contact-select-item"
                                                    onClick={() => toggleGroupSelection(g.id)}
                                                >
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm text-slate-100">{g.name}</p>
                                                        <p className="text-xs text-slate-400">{g.description || 'No description'}</p>
                                                    </div>
                                                    <Button size="sm" variant="secondary" className="h-7 text-xs">
                                                        Select Members
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                            <div className="modal-footer">
                                <Button variant="ghost" onClick={() => setShowContactModal(false)}>Cancel</Button>
                                <Button onClick={confirmSelection} disabled={selectedIds.size === 0}>
                                    Add Selected ({selectedIds.size})
                                </Button>
                            </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
};
