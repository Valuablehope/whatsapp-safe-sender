import { useState, useEffect } from 'react';



export const useElectron = () => {
    const [status, setStatus] = useState<string>('disconnected');
    const [logs, setLogs] = useState<any[]>([]);
    const [queueLength, setQueueLength] = useState<number>(0);
    const [qrCode, setQrCode] = useState<string | null>(null);

    useEffect(() => {
        if (window.electronAPI) {
            window.electronAPI.onStatusUpdate((s: string) => {
                setStatus(s);
                if (s === 'ready') setQrCode(null);
            });

            window.electronAPI.onLogUpdate((log: any) => {
                setLogs(prev => [log, ...prev].slice(0, 100)); // Keep last 100 logs
            });

            // Listen for Queue Update (need to add to preload if missing, or use generic receive)
            window.electronAPI.receiveMessage('queue-update', (length: number) => {
                setQueueLength(length);
            });

            window.electronAPI.receiveMessage('qr-code', (qr: string) => {
                setQrCode(qr);
            });
        }
    }, []);

    const getContacts = async () => window.electronAPI?.getContacts();
    const saveContact = async (c: any) => window.electronAPI?.saveContact(c);

    const createTemplate = async (data: { title: string, body: string, variations: string[], mediaPath?: string | null }) => {
        // Assuming preload exposes createTemplate via invoke('create-template', data)
        // I need to add this to preload.ts as well!
        // Or use generic sendMessage if no return needed, but we need ID.
        // So I MUST update preload.ts to expose `createTemplate`.
        return window.electronAPI?.createTemplate(data);
    };

    const startCampaign = async (templateId: number, contactIds: number[]) => {
        return window.electronAPI?.startCampaign({ templateId, contactIds });
    };

    const stopCampaign = async () => window.electronAPI?.stopCampaign();
    const getQR = async () => window.electronAPI?.getQRCode();

    const getGroups = async () => window.electronAPI?.getGroups();
    const getGroupMembers = async (groupId: number) => window.electronAPI?.getGroupMembers(groupId);

    return {
        status,
        logs,
        queueLength,
        qrCode,
        getContacts,
        saveContact,
        createTemplate,
        startCampaign,
        stopCampaign,
        getQR,
        getGroups,
        getGroupMembers,
        uploadMedia: window.electronAPI?.uploadMedia
    };
};
