import { contextBridge, ipcRenderer, webUtils } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
    // Example IPC implementation
    sendMessage: (channel: string, data: any) => {
        // Whitelist channels
        let validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            ipcRenderer.send(channel, data);
        }
    },
    receiveMessage: (channel: string, func: (...args: any[]) => void) => {
        let validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    // Specific API methods (safer than generic send/receive)
    getContacts: () => ipcRenderer.invoke('get-contacts'),
    saveContact: (contact: any) => ipcRenderer.invoke('save-contact', contact),
    createTemplate: (data: any) => ipcRenderer.invoke('create-template', data),
    startCampaign: (campaignId: number) => ipcRenderer.invoke('start-campaign', campaignId),
    stopCampaign: () => ipcRenderer.invoke('stop-campaign'),
    onLogUpdate: (callback: (log: any) => void) => ipcRenderer.on('log-update', (_event, log) => callback(log)),
    onStatusUpdate: (callback: (status: any) => void) => ipcRenderer.on('status-update', (_event, status) => callback(status)),
    getQRCode: () => ipcRenderer.invoke('get-qr-code'),

    // Group API
    getGroups: () => ipcRenderer.invoke('get-groups'),
    createGroup: (name: string, description?: string) => ipcRenderer.invoke('create-group', { name, description }),
    deleteGroup: (id: number) => ipcRenderer.invoke('delete-group', id),
    addContactToGroup: (groupId: number, contactId: number) => ipcRenderer.invoke('add-contact-to-group', { groupId, contactId }),
    removeContactFromGroup: (groupId: number, contactId: number) => ipcRenderer.invoke('remove-contact-from-group', { groupId, contactId }),
    getGroupMembers: (groupId: number) => ipcRenderer.invoke('get-group-members', groupId),
    resetDatabase: () => ipcRenderer.invoke('reset-database'),
    fetchLogs: () => ipcRenderer.invoke('fetch-logs'),
    getDailyCount: () => ipcRenderer.invoke('get-daily-count'),
    clearLogs: () => ipcRenderer.invoke('clear-logs'),

    // Media API
    uploadMedia: (filePath: string) => ipcRenderer.invoke('upload-media', filePath),
    onMediaUploadProgress: (callback: (percent: number) => void) => ipcRenderer.on('media-upload-progress', (_event, percent) => callback(percent)),
    getFilePath: (file: File) => webUtils.getPathForFile(file),
});
