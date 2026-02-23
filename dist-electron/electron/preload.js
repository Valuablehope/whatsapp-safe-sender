"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('electronAPI', {
    // Example IPC implementation
    sendMessage: (channel, data) => {
        // Whitelist channels
        let validChannels = ['toMain'];
        if (validChannels.includes(channel)) {
            electron_1.ipcRenderer.send(channel, data);
        }
    },
    receiveMessage: (channel, func) => {
        let validChannels = ['fromMain'];
        if (validChannels.includes(channel)) {
            // Deliberately strip event as it includes `sender` 
            electron_1.ipcRenderer.on(channel, (event, ...args) => func(...args));
        }
    },
    // Specific API methods (safer than generic send/receive)
    getContacts: () => electron_1.ipcRenderer.invoke('get-contacts'),
    saveContact: (contact) => electron_1.ipcRenderer.invoke('save-contact', contact),
    getCampaigns: () => electron_1.ipcRenderer.invoke('get-campaigns'),
    createCampaign: (name) => electron_1.ipcRenderer.invoke('create-campaign', name),
    createTemplate: (data) => electron_1.ipcRenderer.invoke('create-template', data),
    startCampaign: (data) => electron_1.ipcRenderer.invoke('start-campaign', data),
    resumeCampaign: (campaignId) => electron_1.ipcRenderer.invoke('resume-campaign', campaignId),
    stopCampaign: () => electron_1.ipcRenderer.invoke('stop-campaign'),
    onLogUpdate: (callback) => electron_1.ipcRenderer.on('log-update', (_event, log) => callback(log)),
    onStatusUpdate: (callback) => electron_1.ipcRenderer.on('status-update', (_event, status) => callback(status)),
    getQRCode: () => electron_1.ipcRenderer.invoke('get-qr-code'),
    // Group API
    getGroups: () => electron_1.ipcRenderer.invoke('get-groups'),
    createGroup: (name, description) => electron_1.ipcRenderer.invoke('create-group', { name, description }),
    deleteGroup: (id) => electron_1.ipcRenderer.invoke('delete-group', id),
    addContactToGroup: (groupId, contactId) => electron_1.ipcRenderer.invoke('add-contact-to-group', { groupId, contactId }),
    removeContactFromGroup: (groupId, contactId) => electron_1.ipcRenderer.invoke('remove-contact-from-group', { groupId, contactId }),
    getGroupMembers: (groupId) => electron_1.ipcRenderer.invoke('get-group-members', groupId),
    resetDatabase: () => electron_1.ipcRenderer.invoke('reset-database'),
    fetchLogs: () => electron_1.ipcRenderer.invoke('fetch-logs'),
    getDailyCount: () => electron_1.ipcRenderer.invoke('get-daily-count'),
    clearLogs: () => electron_1.ipcRenderer.invoke('clear-logs'),
    // Media API
    uploadMedia: (filePath) => electron_1.ipcRenderer.invoke('upload-media', filePath),
    onMediaUploadProgress: (callback) => electron_1.ipcRenderer.on('media-upload-progress', (_event, percent) => callback(percent)),
    getFilePath: (file) => electron_1.webUtils.getPathForFile(file),
});
