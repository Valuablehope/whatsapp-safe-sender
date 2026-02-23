import { ipcMain, BrowserWindow } from 'electron';
import { DBService } from '../services/Database';
import { WhatsAppClient } from '../services/WhatsAppClient';
import { Scheduler } from '../services/Scheduler';
import { DailyStats } from '../services/DailyStats';
import { MediaService } from '../services/MediaService';

export function setupHandlers(win: BrowserWindow) {
    const dbService = new DBService();
    const waClient = new WhatsAppClient(win);
    const dailyStats = new DailyStats(dbService);
    const scheduler = new Scheduler(dbService, waClient, dailyStats, win);

    const mediaService = new MediaService(win);

    // Logging Helper
    const handle = (channel: string, callback: (event: any, ...args: any[]) => Promise<any> | any) => {
        ipcMain.handle(channel, async (event, ...args) => {
            const start = Date.now();
            console.log(`[IPC START] ${channel}`, args);
            try {
                const result = await callback(event, ...args);
                const duration = Date.now() - start;
                console.log(`[IPC END] ${channel} (${duration}ms)`);
                return result;
            } catch (error) {
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
        } else {
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
        } catch (e) {
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
    handle('get-campaigns', () => {
        return dbService.getDb().prepare(`
            SELECT c.*, 
                   COUNT(q.id) as total_queue,
                   SUM(CASE WHEN q.status = 'sent' THEN 1 ELSE 0 END) as sent_count,
                   SUM(CASE WHEN q.status = 'failed' THEN 1 ELSE 0 END) as failed_count
            FROM campaigns c
            LEFT JOIN campaign_queue q ON c.id = q.campaign_id
            GROUP BY c.id
            ORDER BY c.created_at DESC
        `).all();
    });

    handle('create-campaign', (_event, name: string) => {
        const stmt = dbService.getDb().prepare('INSERT INTO campaigns (name, status) VALUES (?, ?)');
        const result = stmt.run(name || 'Untitled Campaign', 'draft');
        return { id: result.lastInsertRowid };
    });

    handle('create-template', (_event, data) => {
        // data: { title, type, body, variations[], mediaPath }
        const stmt = dbService.getDb().prepare('INSERT INTO templates (title, type, body, media_path) VALUES (?, ?, ?, ?)');
        const result = stmt.run(data.title || 'Untitled', data.type || 'text', data.body, data.mediaPath || null);
        const templateId = result.lastInsertRowid as number;

        if (data.variations && data.variations.length > 0) {
            const varStmt = dbService.getDb().prepare('INSERT INTO template_variations (template_id, variation) VALUES (?, ?)');
            for (const v of data.variations) {
                if (v && v.trim()) varStmt.run(templateId, v);
            }
        }
        return { id: templateId };
    });

    handle('start-campaign', (_event, data) => {
        // data: { campaignId, title, body, variations[], mediaPath, contactIds[] }

        // 1. Create Template
        const stmtTpl = dbService.getDb().prepare('INSERT INTO templates (title, type, body, media_path) VALUES (?, ?, ?, ?)');
        const resultTpl = stmtTpl.run(data.title || 'Untitled Template', 'text', data.body, data.mediaPath || null);
        const templateId = resultTpl.lastInsertRowid as number;

        if (data.variations && data.variations.length > 0) {
            const varStmt = dbService.getDb().prepare('INSERT INTO template_variations (template_id, variation) VALUES (?, ?)');
            for (const v of data.variations) {
                if (v && v.trim()) varStmt.run(templateId, v);
            }
        }

        // 2. Update Campaign
        const stmtUpdate = dbService.getDb().prepare('UPDATE campaigns SET template_id = ?, status = ? WHERE id = ?');
        stmtUpdate.run(templateId, 'active', data.campaignId);

        // 3. Build Queue
        const insertQueue = dbService.getDb().prepare('INSERT OR IGNORE INTO campaign_queue (campaign_id, contact_id, status) VALUES (?, ?, ?)');
        const addQueueTx = dbService.getDb().transaction((contacts) => {
            for (const cid of contacts) {
                insertQueue.run(data.campaignId, cid, 'pending');
            }
        });
        addQueueTx(data.contactIds);

        // 4. Start Scheduler
        scheduler.start();

        return { success: true, campaignId: data.campaignId };
    });

    handle('resume-campaign', (_event, campaignId: number) => {
        dbService.getDb().prepare('UPDATE campaigns SET status = ? WHERE id = ?').run('active', campaignId);
        scheduler.start();
        return { success: true };
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
        } else {
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
