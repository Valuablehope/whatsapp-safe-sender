import { useState, useRef, useEffect } from 'react';
import { useElectron } from '../hooks/useElectron';
import { FileText, Users, Plus, Upload, Trash2, X, Check, Image as ImageIcon, Paperclip, Play, ArrowLeft, Sparkles, Archive, MoreVertical } from 'lucide-react';
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
    queue_status?: 'pending' | 'sent' | 'failed';
}

export const CampaignScreen = ({ status }: { status: string }) => {
    const { getCampaigns, createCampaign, resumeCampaign, startCampaign, getContacts, getGroups, getGroupMembers, saveContact, getCampaignRecipients, saveCampaignRecipients, deleteCampaign, archiveCampaign } = useElectron();

    // View State
    const [view, setView] = useState<'list' | 'detail'>('list');
    const [campaigns, setCampaigns] = useState<any[]>([]);
    const [selectedCampaign, setSelectedCampaign] = useState<any | null>(null);
    const [openMenuId, setOpenMenuId] = useState<number | null>(null);
    const [showArchived, setShowArchived] = useState(false);

    // Create Modal State
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newCampaignName, setNewCampaignName] = useState('');

    // Detail Configuration State
    const [templateBody, setTemplateBody] = useState('');
    const [variations, setVariations] = useState<string[]>(['']);
    const [mediaPath, setMediaPath] = useState<string | null>(null);
    const mediaInputRef = useRef<HTMLInputElement>(null);
    const [contacts, setContacts] = useState<Contact[]>([]);
    const [isProcessing, setIsProcessing] = useState(false);
    const [uploadProgress, setUploadProgress] = useState<number | null>(null);
    // Refs to gate auto-save: block saves until the first DB load has finished
    const isLoadingRef = useRef(false);
    const hasLoadedRef = useRef(false);

    // Contact Modal State
    const [showContactModal, setShowContactModal] = useState(false);
    const [dbContacts, setDbContacts] = useState<Contact[]>([]);
    const [dbGroups, setDbGroups] = useState<any[]>([]);
    const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
    const [activeTab, setActiveTab] = useState<'contacts' | 'groups'>('contacts');

    useEffect(() => {
        if (view === 'list') loadCampaigns();
    }, [view]);

    // Live-poll recipient statuses when a campaign is active
    useEffect(() => {
        if (view !== 'detail' || !selectedCampaign?.id || selectedCampaign.status !== 'active') return;
        const interval = setInterval(() => {
            getCampaignRecipients(selectedCampaign.id)
                .then(saved => { if (saved) setContacts(saved as Contact[]); })
                .catch(() => { });
        }, 5000);
        return () => clearInterval(interval);
    }, [view, selectedCampaign?.id, selectedCampaign?.status]);

    // Load persisted recipients whenever a campaign is opened in detail view
    useEffect(() => {
        if (view === 'detail' && selectedCampaign?.id) {
            isLoadingRef.current = true;
            hasLoadedRef.current = false;
            setContacts([]);
            getCampaignRecipients(selectedCampaign.id)
                .then(saved => {
                    if (saved && saved.length > 0) setContacts(saved as Contact[]);
                })
                .catch(e => console.error('Failed to load recipients:', e))
                .finally(() => {
                    isLoadingRef.current = false;
                    hasLoadedRef.current = true;
                });
        } else if (view === 'detail') {
            isLoadingRef.current = false;
            hasLoadedRef.current = true;
            setContacts([]);
        }
    }, [selectedCampaign?.id, view]);

    // Auto-save recipients to DB whenever the contacts list changes (debounced)
    // Guard: only runs after the initial load has completed
    useEffect(() => {
        if (!selectedCampaign?.id || isLoadingRef.current || !hasLoadedRef.current || view !== 'detail') return;
        // Never auto-save when campaign is already running/done — would overwrite sent statuses back to pending
        if (selectedCampaign?.status === 'active' || selectedCampaign?.status === 'completed') return;
        const timer = setTimeout(async () => {
            // Double-check guard inside async callback too
            if (isLoadingRef.current || !hasLoadedRef.current) return;
            const contactIds: number[] = [];
            for (const c of contacts) {
                if (c.id) {
                    contactIds.push(c.id);
                } else {
                    try {
                        const res = await saveContact(c);
                        if (res?.lastInsertRowid) {
                            c.id = res.lastInsertRowid as number;
                            contactIds.push(c.id);
                        }
                    } catch { /* ignore */ }
                }
            }
            saveCampaignRecipients(selectedCampaign.id, contactIds)
                .catch(e => console.error('Auto-save failed:', e));
        }, 600);
        return () => clearTimeout(timer);
    }, [contacts, selectedCampaign?.id, view]);

    const loadCampaigns = async () => {
        try {
            const data = await getCampaigns();
            // Keep all campaigns in state; filter in render
            setCampaigns(data || []);
        } catch (e) {
            console.error('Failed to load campaigns:', e);
        }
    };

    const handleDeleteCampaign = async (campaignId: number) => {
        if (!confirm('Permanently delete this campaign and all its data? This cannot be undone.')) return;
        await deleteCampaign(campaignId);
        loadCampaigns();
    };

    const handleArchiveCampaign = async (campaignId: number) => {
        await archiveCampaign(campaignId);
        loadCampaigns();
    };

    const handleCreateCampaign = async () => {
        if (!newCampaignName.trim()) return;
        try {
            const res = await createCampaign(newCampaignName);
            if (res && res.id) {
                setShowCreateModal(false);
                setNewCampaignName('');
                const newCampaign = { id: res.id, name: newCampaignName, status: 'draft' };
                setSelectedCampaign(newCampaign);
                setView('detail');
            }
        } catch (e) {
            console.error(e);
            alert('Failed to create campaign');
        }
    };

    const handleResume = async (campaignId: number) => {
        if (status !== 'ready') return alert('WhatsApp not connected!');
        try {
            await resumeCampaign(campaignId);
            loadCampaigns();
            alert('Campaign resumed');
        } catch (error) {
            console.error(error);
            alert('Failed to resume');
        }
    };

    // --- Detail Config Logic ---
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
        try {
            const members = await getGroupMembers(groupId);
            const memberIds = members.map((m: any) => m.id);

            setSelectedIds(prev => {
                const newSelected = new Set(prev);
                const allSelected = memberIds.every((id: number) => newSelected.has(id));

                if (allSelected) {
                    memberIds.forEach((id: number) => newSelected.delete(id));
                } else {
                    memberIds.forEach((id: number) => newSelected.add(id));
                }
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
            return newSelected;
        });
    };

    const confirmSelection = () => {
        const selectedContacts = dbContacts.filter(c => c.id !== undefined && selectedIds.has(c.id));
        setContacts(prev => {
            const existingPhones = new Set(prev.map(c => c.phone));
            const newToAdd = selectedContacts.filter(c => !existingPhones.has(c.phone));
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
        if (isProcessing) return;
        if (status !== 'ready') return alert('WhatsApp not connected!');
        if (contacts.length === 0) return alert('No contacts!');
        if (!templateBody.trim()) return alert('Template required!');

        setIsProcessing(true);
        try {
            const contactIds: number[] = [];
            for (const c of contacts) {
                if (c.id) {
                    contactIds.push(c.id);
                } else {
                    try {
                        const res = await saveContact(c);
                        if (res && res.lastInsertRowid) contactIds.push(res.lastInsertRowid as number);
                    } catch (e) {
                        console.log('Contact error', e);
                    }
                }
            }

            if (contactIds.length === 0) {
                alert('Could not resolve any valid contacts.');
                setIsProcessing(false);
                return;
            }

            await startCampaign({
                campaignId: selectedCampaign.id,
                title: selectedCampaign.name,
                body: templateBody,
                variations: variations.filter(v => v.trim() !== ''),
                mediaPath: mediaPath,
                contactIds
            });

            // Update local campaign status and stay in detail view
            setSelectedCampaign((prev: any) => ({ ...prev, status: 'active' }));
            alert('Campaign started! You can track progress below.');
        } catch (e: any) {
            console.error(e);
            alert('Error starting campaign: ' + e.message);
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
        <div className="flex flex-col h-full w-full relative">
            {view === 'list' && (
                <div className="flex flex-col h-full overflow-hidden">
                    <header className="pb-6 border-b flex justify-between items-center mb-6" style={{ borderColor: 'var(--border)' }}>
                        <div>
                            <h1 className="text-3xl font-bold flex items-center gap-3 mb-2 text-slate-100">
                                Campaigns
                            </h1>
                            <p className="text-slate-400">Manage and track your message campaigns.</p>
                        </div>
                        <Button onClick={() => setShowCreateModal(true)} className="gap-2 shrink-0">
                            <Plus size={16} /> New Campaign
                        </Button>

                    </header>

                    <div className="overflow-y-auto flex-1 pr-2">
                        <div className="grid gap-4">
                            {campaigns.filter((c: any) => showArchived ? c.status === 'archived' : c.status !== 'archived').length === 0 ? (
                                <div className="text-center py-12 text-slate-400">{showArchived ? 'No archived campaigns.' : 'No campaigns yet. Click New Campaign to start!'}</div>
                            ) : campaigns.filter((c: any) => showArchived ? c.status === 'archived' : c.status !== 'archived').map(camp => (
                                <Card key={camp.id} className="bg-surface p-4 flex flex-row items-center">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2 flex-wrap mb-1">
                                            <h3 className="font-bold text-lg text-slate-100">{camp.name}</h3>
                                            <Badge variant={camp.status === 'active' ? 'default' : camp.status === 'completed' ? 'secondary' : 'outline'}>
                                                {camp.status.toUpperCase()}
                                            </Badge>
                                            {camp.total_queue === 0 ? (
                                                <Badge variant="outline" className="text-slate-400 border-slate-400">Not Configured</Badge>
                                            ) : (
                                                <Badge variant="secondary">{camp.sent_count || 0} / {camp.total_queue} Sent{camp.failed_count > 0 ? ` · ${camp.failed_count} Failed` : ''}</Badge>
                                            )}
                                        </div>
                                        <p className="text-sm text-slate-400">Created: {new Date(camp.created_at).toLocaleDateString()}</p>
                                    </div>
                                    <div className="flex gap-2 shrink-0 items-center">
                                        {camp.status === 'draft' && (
                                            <Button size="sm" onClick={() => { setSelectedCampaign(camp); setView('detail'); }}>Configure</Button>
                                        )}
                                        {(camp.status === 'active' || camp.status === 'completed') && (
                                            <Button size="sm" variant="secondary" onClick={() => { setSelectedCampaign(camp); setView('detail'); }}>View</Button>
                                        )}
                                        {camp.status === 'paused' && (
                                            <>
                                                <Button size="sm" variant="secondary" onClick={() => { setSelectedCampaign(camp); setView('detail'); }}>View</Button>
                                                <Button size="sm" onClick={() => handleResume(camp.id)}>
                                                    <Play size={16} className="mr-1" /> Resume
                                                </Button>
                                            </>
                                        )}
                                        {/* 3-dot menu */}
                                        <div className="relative">
                                            <Button
                                                size="sm" variant="ghost"
                                                className="text-slate-400 hover:text-slate-200 px-1"
                                                onClick={(e) => { e.stopPropagation(); setOpenMenuId(openMenuId === camp.id ? null : camp.id); }}
                                            >
                                                <MoreVertical size={16} />
                                            </Button>
                                            {openMenuId === camp.id && (
                                                <div
                                                    className="absolute right-0 top-8 z-50 bg-slate-800 border border-slate-700 rounded-lg shadow-xl min-w-[140px] py-1 text-sm"
                                                    onClick={(e) => e.stopPropagation()}
                                                >
                                                    <button
                                                        className="flex items-center gap-2 w-full px-4 py-2 text-slate-300 hover:bg-slate-700 hover:text-white transition-colors"
                                                        onClick={() => { handleArchiveCampaign(camp.id); setOpenMenuId(null); }}
                                                    >
                                                        <Archive size={14} /> Archive
                                                    </button>
                                                    <button
                                                        className="flex items-center gap-2 w-full px-4 py-2 text-red-400 hover:bg-red-500/10 hover:text-red-300 transition-colors"
                                                        onClick={() => { handleDeleteCampaign(camp.id); setOpenMenuId(null); }}
                                                    >
                                                        <Trash2 size={14} /> Delete
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                </Card>
                            ))}
                        </div>
                    </div>
                    <div className="pt-4 flex justify-center">
                        <button
                            onClick={() => setShowArchived(v => !v)}
                            className={`flex items-center gap-2 text-xs px-4 py-2 rounded-full border transition-colors ${showArchived
                                    ? 'border-emerald-500/40 text-emerald-400 bg-emerald-500/10'
                                    : 'border-slate-700 text-slate-500 hover:text-slate-300 hover:border-slate-500'
                                }`}
                        >
                            <Archive size={13} />{showArchived ? 'Hide Archived' : 'View Archived Campaigns'}
                        </button>
                    </div>
                </div>
            )}

            {view === 'detail' && (
                <div className="flex flex-col gap-6 h-full w-full pb-6">
                    <header className="pb-4 border-b flex items-center gap-4" style={{ borderColor: 'var(--border)' }}>
                        <Button variant="ghost" size="icon" onClick={() => setView('list')}><ArrowLeft size={20} /></Button>
                        <div>
                            <h1 className="text-2xl font-bold text-slate-100 flex items-center gap-2">
                                Configure: {selectedCampaign?.name}
                            </h1>
                            <p className="text-sm text-slate-400">Set up your message and recipients</p>
                        </div>
                    </header>

                    <div className="campaign-grid min-h-0 flex-1">
                        <Card className="flex flex-col bg-surface overflow-hidden">
                            <CardHeader className="border-b shrink-0">
                                <div className="flex items-center gap-2 text-slate-100">
                                    <FileText size={20} className="text-emerald" />
                                    <CardTitle>Message Template</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col pt-6 space-y-6 overflow-y-auto">
                                <textarea
                                    placeholder="Hello {name}, ...\n\nWrite your message here."
                                    value={templateBody}
                                    onChange={e => setTemplateBody(e.target.value)}
                                    className="campaign-textarea flex-none min-h-[120px]"
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
                                                        const path = window.electronAPI.getFilePath(file);
                                                        setUploadProgress(0);
                                                        window.electronAPI.onMediaUploadProgress((percent) => setUploadProgress(percent));
                                                        const newPath = await window.electronAPI.uploadMedia(path);
                                                        setMediaPath(newPath);
                                                        setUploadProgress(null);
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
                                        <Button variant="secondary" onClick={() => mediaInputRef.current?.click()} className="gap-2" disabled={uploadProgress !== null}>
                                            <ImageIcon size={16} />
                                            {mediaPath ? 'Change Media' : 'Select Media'}
                                        </Button>
                                        {uploadProgress !== null && (
                                            <div className="flex-1 flex items-center gap-2">
                                                <div className="h-2 flex-1 bg-slate-700 rounded-full overflow-hidden">
                                                    <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                                                </div>
                                                <span className="text-xs text-slate-400">{uploadProgress}%</span>
                                            </div>
                                        )}
                                        {mediaPath && uploadProgress === null && (
                                            <div className="flex items-center gap-2 bg-slate-800 px-3 py-2 rounded text-sm text-slate-300">
                                                <span className="truncate max-w-[200px]">{mediaPath.split(/[/\\]/).pop()}</span>
                                                <button onClick={clearMedia} className="text-red-400 hover:text-red-300"><X size={14} /></button>
                                            </div>
                                        )}
                                    </div>
                                </div>
                                <div className="space-y-4">
                                    <label className="text-sm font-medium text-slate-400 flex items-center justify-between">
                                        <span>Variations (Anti-Ban)</span>
                                        <span className="text-xs text-slate-400 font-normal">Optional</span>
                                    </label>
                                    <div className="variations-list max-h-48 overflow-y-auto pr-2">
                                        {variations.map((v, i) => (
                                            <Input key={i} placeholder={`Variation ${i + 1}`} value={v} onChange={e => updateVariation(i, e.target.value)} className="mb-2" />
                                        ))}
                                    </div>
                                    <Button variant="secondary" onClick={addVariation} className="w-full gap-2"><Plus size={16} /> Add Variation</Button>
                                </div>
                            </CardContent>
                        </Card>

                        <Card className="flex flex-col bg-surface overflow-hidden">
                            <CardHeader className="border-b shrink-0">
                                <div className="flex items-center gap-2 text-slate-100">
                                    <Users size={20} className="text-emerald" />
                                    <CardTitle>Recipients</CardTitle>
                                </div>
                            </CardHeader>
                            <CardContent className="flex-1 flex flex-col pt-6 overflow-hidden">
                                <div className="flex flex-wrap gap-3 mb-6 shrink-0">
                                    <label className="btn btn-secondary flex-1 cursor-pointer">
                                        <Upload size={16} className="mr-2" /> Import CSV
                                        <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
                                    </label>
                                    <Button variant="secondary" onClick={handleLoadContacts} className="flex-1 gap-2"><Users size={16} /> Saved</Button>
                                    <Button variant="destructive" onClick={() => setContacts([])} size="icon" className="flex-none"><Trash2 size={16} /></Button>
                                </div>
                                <div className="contacts-list-container flex-1 overflow-y-auto pr-2 min-h-[150px]">
                                    {contacts.length === 0 ? (
                                        <div className="empty-state h-full flex flex-col items-center justify-center">
                                            <Users size={40} className="opacity-20 mb-2" />
                                            <p className="text-sm">No contacts added yet</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {contacts.slice(0, 100).map((c, i) => {
                                                const statusMap: Record<string, { label: string; cls: string }> = {
                                                    sent: { label: 'Sent', cls: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
                                                    failed: { label: 'Failed', cls: 'bg-red-500/20 text-red-400 border-red-500/30' },
                                                    pending: { label: 'Pending', cls: 'bg-slate-500/20 text-slate-400 border-slate-500/30' },
                                                };
                                                const st = statusMap[c.queue_status ?? 'pending'];
                                                return (
                                                    <div key={c.id ?? i} className="contact-item p-2 mb-1 bg-slate-800/50 rounded flex justify-between items-center">
                                                        <div>
                                                            <p className="font-medium text-slate-100 text-sm">{c.name}</p>
                                                            <p className="text-xs text-slate-400 font-mono">{c.phone}</p>
                                                        </div>
                                                        <div className="flex items-center gap-2">
                                                            {c.tag && <Badge variant="secondary">{c.tag}</Badge>}
                                                            <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${st.cls}`}>{st.label}</span>
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                            {contacts.length > 100 && <p className="text-center text-xs text-slate-400 mt-3 py-2">And {contacts.length - 100} more...</p>}
                                        </div>
                                    )}
                                </div>
                                {contacts.length > 0 && (
                                    <div className="footer-stats shrink-0 mt-4 border-t border-slate-700 pt-4 flex justify-between text-sm">
                                        <span>Total: <strong className="text-slate-100">{contacts.length}</strong></span>
                                        <span className="text-emerald-400 font-medium">{contacts.filter(c => c.queue_status === 'sent').length} Sent</span>
                                        <span>Est. Time: <strong className="text-emerald">{estimatedTime()}</strong></span>
                                    </div>
                                )}
                            </CardContent>
                        </Card>
                    </div>

                    <Button variant="primary" size="lg" className="w-full py-6 text-lg shrink-0" onClick={handleStart} disabled={isProcessing || contacts.length === 0}>
                        {isProcessing ? <><span className="animate-spin mr-2">⏳</span> Starting Campaign...</> : <>START CAMPAIGN <Sparkles size={20} className="ml-2" /></>}
                    </Button>
                </div>
            )}

            {/* Create Campaign Modal */}
            {showCreateModal && (
                <div className="modal-overlay" onClick={() => setShowCreateModal(false)}>
                    <Card className="w-96 p-6" onClick={e => e.stopPropagation()}>
                        <h2 className="text-xl font-bold mb-4 flex items-center gap-2"><Plus className="text-emerald" /> New Campaign</h2>
                        <Input
                            autoFocus
                            placeholder="Campaign Name (e.g., Summer Promo)"
                            value={newCampaignName}
                            onChange={e => setNewCampaignName(e.target.value)}
                            className="mb-6"
                            onKeyDown={e => e.key === 'Enter' && handleCreateCampaign()}
                        />
                        <div className="flex gap-3 justify-end">
                            <Button variant="ghost" onClick={() => setShowCreateModal(false)}>Cancel</Button>
                            <Button onClick={handleCreateCampaign} disabled={!newCampaignName.trim()}>Create & Configure</Button>
                        </div>
                    </Card>
                </div>
            )}

            {/* Contact Selection Modal */}
            {showContactModal && (
                <div className="modal-overlay" onClick={() => setShowContactModal(false)}>
                    <Card className="modal-card w-full max-w-2xl max-h-[80vh] flex flex-col" onClick={e => e.stopPropagation()}>
                        <CardHeader className="flex flex-row items-center justify-between border-b pb-4 shrink-0">
                            <CardTitle className="text-xl flex items-center gap-2">
                                <Users size={20} className="text-emerald" />
                                Select Contacts
                            </CardTitle>
                            <Button variant="ghost" size="icon" onClick={() => setShowContactModal(false)}>
                                <X size={20} />
                            </Button>
                        </CardHeader>

                        <CardContent className="pt-0 p-0 flex flex-col flex-1 min-h-0 overflow-hidden">
                            <div className="flex border-b border-slate-700 shrink-0">
                                <button className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'contacts' ? 'text-emerald border-b-2 border-emerald bg-emerald-500/5' : 'text-slate-400 hover:text-slate-200'}`} onClick={() => setActiveTab('contacts')}>
                                    Individual Contacts
                                </button>
                                <button className={`flex-1 py-3 text-sm font-medium transition-colors ${activeTab === 'groups' ? 'text-emerald border-b-2 border-emerald bg-emerald-500/5' : 'text-slate-400 hover:text-slate-200'}`} onClick={() => setActiveTab('groups')}>
                                    Groups
                                </button>
                            </div>

                            <div className="flex-1 overflow-y-auto p-4">
                                {activeTab === 'contacts' ? (
                                    dbContacts.length === 0 ? (
                                        <div className="empty-state h-full flex flex-col justify-center items-center">
                                            <Users size={32} className="opacity-20 mb-2" />
                                            <p>No saved contacts found.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-1">
                                            {dbContacts.map(c => (
                                                <div key={c.id} className={`contact-select-item p-3 flex items-center cursor-pointer hover:bg-slate-800/50 rounded ${selectedIds.has(c.id!) ? 'bg-emerald-500/10' : ''}`} onClick={() => c.id && toggleContactSelection(c.id)}>
                                                    <div className={`w-5 h-5 rounded border mr-3 flex items-center justify-center ${selectedIds.has(c.id!) ? 'bg-emerald-500 border-emerald-500' : 'border-slate-600'}`}>
                                                        {selectedIds.has(c.id!) && <Check size={12} className="text-white" />}
                                                    </div>
                                                    <div className="flex-1">
                                                        <p className={`font-medium text-sm ${selectedIds.has(c.id!) ? 'text-emerald-400' : 'text-slate-100'}`}>{c.name}</p>
                                                        <p className="text-xs text-slate-400">{c.phone}</p>
                                                    </div>
                                                    {c.tag && <Badge variant="outline">{c.tag}</Badge>}
                                                </div>
                                            ))}
                                        </div>
                                    )
                                ) : (
                                    dbGroups.length === 0 ? (
                                        <div className="empty-state h-full flex flex-col items-center justify-center">
                                            <Users size={32} className="opacity-20 mb-2" />
                                            <p>No groups found. Create one in Contacts.</p>
                                        </div>
                                    ) : (
                                        <div className="space-y-2">
                                            {dbGroups.map(g => (
                                                <div key={g.id} className="p-4 bg-slate-800/40 rounded flex justify-between items-center cursor-pointer hover:bg-slate-800/60 transition-colors" onClick={() => toggleGroupSelection(g.id)}>
                                                    <div className="flex-1">
                                                        <p className="font-medium text-sm text-slate-100">{g.name}</p>
                                                        <p className="text-xs text-slate-400">{g.description || 'No description'}</p>
                                                    </div>
                                                    <Button size="sm" variant="secondary" className="h-8 text-xs shrink-0" onClick={(e) => { e.stopPropagation(); toggleGroupSelection(g.id); }}>
                                                        Toggle All Members
                                                    </Button>
                                                </div>
                                            ))}
                                        </div>
                                    )
                                )}
                            </div>
                            <div className="modal-footer shrink-0 p-4 border-t border-slate-700 flex justify-end gap-3 bg-surface/50">
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
