"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupHandlers = setupHandlers;
const electron_1 = require("electron");
const Database_1 = require("../services/Database");
const WhatsAppClient_1 = require("../services/WhatsAppClient");
const Scheduler_1 = require("../services/Scheduler");
const DailyStats_1 = require("../services/DailyStats");
const MediaService_1 = require("../services/MediaService");
function setupHandlers(win) {
    const dbService = new Database_1.DBService();
    const waClient = new WhatsAppClient_1.WhatsAppClient(win);
    const dailyStats = new DailyStats_1.DailyStats(dbService);
    const scheduler = new Scheduler_1.Scheduler(dbService, waClient, dailyStats, win);
    const mediaService = new MediaService_1.MediaService(win);
    // Logging Helper
    const handle = (channel, callback) => {
        electron_1.ipcMain.handle(channel, async (event, ...args) => {
            const start = Date.now();
            console.log(`[IPC START] ${channel}`, args);
            try {
                const result = await callback(event, ...args);
                const duration = Date.now() - start;
                console.log(`[IPC END] ${channel} (${duration}ms)`);
                return result;
            }
            catch (error) {
                console.error(`[IPC ERROR] ${channel}:`, error);
                throw error;
            }
        });
    };
    // Database IPC
    handle('get-contacts', () => {
        return dbService.getDb().prepare('SELECT * FROM contacts ORDER BY name ASC').all();
    });
    handle('save-contact', (_event, contact) => {
        if (contact.id) {
            const stmt = dbService.getDb().prepare('UPDATE contacts SET name = ?, phone = ?, tag = ? WHERE id = ?');
            return stmt.run(contact.name, contact.phone, contact.tag, contact.id);
        }
        else {
            const stmt = dbService.getDb().prepare('INSERT INTO contacts (name, phone, tag) VALUES (?, ?, ?)');
            return stmt.run(contact.name, contact.phone, contact.tag);
        }
    });
    // Group IPC
    handle('get-groups', () => {
        return dbService.getDb().prepare('SELECT * FROM groups ORDER BY name ASC').all();
    });
    handle('create-group', (_event, { name, description }) => {
        const stmt = dbService.getDb().prepare('INSERT INTO groups (name, description) VALUES (?, ?)');
        const result = stmt.run(name, description);
        return { id: result.lastInsertRowid };
    });
    handle('delete-group', (_event, id) => {
        const stmt = dbService.getDb().prepare('DELETE FROM groups WHERE id = ?');
        stmt.run(id);
        return { success: true };
    });
    handle('add-contact-to-group', (_event, { groupId, contactId }) => {
        try {
            const stmt = dbService.getDb().prepare('INSERT INTO group_members (group_id, contact_id) VALUES (?, ?)');
            stmt.run(groupId, contactId);
            return { success: true };
        }
        catch (e) {
            // Ignore unique constraint violation (already member)
            return { success: false, error: 'Already a member' };
        }
    });
    handle('remove-contact-from-group', (_event, { groupId, contactId }) => {
        const stmt = dbService.getDb().prepare('DELETE FROM group_members WHERE group_id = ? AND contact_id = ?');
        stmt.run(groupId, contactId);
        return { success: true };
    });
    handle('get-group-members', (_event, groupId) => {
        return dbService.getDb().prepare(`
            SELECT c.* FROM contacts c
            JOIN group_members gm ON c.id = gm.contact_id
            WHERE gm.group_id = ?
            ORDER BY c.name ASC
        `).all(groupId);
    });
    // Campaign IPC
    handle('create-template', (_event, data) => {
        // data: { title, type, body, variations[], mediaPath }
        const stmt = dbService.getDb().prepare('INSERT INTO templates (title, type, body, media_path) VALUES (?, ?, ?, ?)');
        const result = stmt.run(data.title || 'Untitled', data.type || 'text', data.body, data.mediaPath || null);
        const templateId = result.lastInsertRowid;
        if (data.variations && data.variations.length > 0) {
            const varStmt = dbService.getDb().prepare('INSERT INTO template_variations (template_id, variation) VALUES (?, ?)');
            for (const v of data.variations) {
                if (v && v.trim())
                    varStmt.run(templateId, v);
            }
        }
        return { id: templateId };
    });
    handle('start-campaign', (_event, campaignData) => {
        // campaignData: { templateId, contactIds[] }
        // 1. Create Campaign Record
        const stmt = dbService.getDb().prepare('INSERT INTO campaigns (template_id) VALUES (?)');
        const result = stmt.run(campaignData.templateId);
        const campaignId = result.lastInsertRowid;
        // 2. Build Queue
        const queueItems = campaignData.contactIds.map((cid) => ({
            contactId: cid,
            templateId: campaignData.templateId,
            campaignId: campaignId
        }));
        // 3. Add to Scheduler
        scheduler.addToQueue(queueItems);
        scheduler.start();
        return { success: true, campaignId };
    });
    handle('stop-campaign', () => {
        scheduler.stop();
        return { success: true };
    });
    handle('get-qr-code', () => {
        // Trigger a QR refresh if possible, or just wait for event
        // waClient.client.emit('qr', ...); // Hard to trigger manually without reload
        if (!waClient.isReady) {
            win.webContents.send('status-update', 'waiting-for-qr');
        }
        else {
            win.webContents.send('status-update', 'ready');
        }
        return null;
    });
    handle('reset-database', () => {
        dbService.reset();
        return { success: true };
    });
    handle('fetch-logs', () => {
        return dbService.getDb().prepare(`
            SELECT * FROM logs 
            ORDER BY timestamp DESC 
            LIMIT 50
        `).all();
    });
    handle('get-daily-count', () => {
        return dailyStats.getTodayCount();
    });
    handle('clear-logs', () => {
        dbService.getDb().prepare('DELETE FROM logs').run();
        return { success: true };
    });
    // Media IPC
    handle('upload-media', async (_event, filePath) => {
        return await mediaService.processUpload(filePath);
    });
}
