/// <reference types="vite/client" />

interface Window {
    electronAPI: {
        sendMessage: (channel: string, data: any) => void;
        receiveMessage: (channel: string, func: (...args: any[]) => void) => void;

        getContacts: () => Promise<any[]>;
        saveContact: (contact: { id?: number; name: string; phone: string; tag?: string }) => Promise<any>;

        getCampaigns: () => Promise<any[]>;
        createCampaign: (name: string) => Promise<any>;
        resumeCampaign: (campaignId: number) => Promise<any>;
        createTemplate: (data: { title: string; type?: string; body: string; variations?: string[]; mediaPath?: string | null }) => Promise<any>;
        startCampaign: (campaignData: any) => Promise<any>;
        stopCampaign: () => Promise<any>;
        getCampaignRecipients: (campaignId: number) => Promise<any[]>;
        saveCampaignRecipients: (campaignId: number, contactIds: number[]) => Promise<any>;
        getStatus: () => Promise<{ status: string }>;
        deleteCampaign: (campaignId: number) => Promise<any>;
        archiveCampaign: (campaignId: number) => Promise<any>;

        onLogUpdate: (callback: (log: any) => void) => void;
        onStatusUpdate: (callback: (status: string) => void) => void;
        getQRCode: () => Promise<void>;

        // Group API
        getGroups: () => Promise<any[]>;
        createGroup: (name: string, description?: string) => Promise<any>;
        deleteGroup: (id: number) => Promise<any>;
        addContactToGroup: (groupId: number, contactId: number) => Promise<any>;
        removeContactFromGroup: (groupId: number, contactId: number) => Promise<any>;
        getGroupMembers: (groupId: number) => Promise<any[]>;
        resetDatabase: () => Promise<void>;
        fetchLogs: () => Promise<any[]>;
        getDailyCount: () => Promise<number>;
        clearLogs: () => Promise<void>;

        uploadMedia: (filePath: string) => Promise<string>;
        onMediaUploadProgress: (callback: (percent: number) => void) => void;
        getFilePath: (file: File) => string;
    }
}
