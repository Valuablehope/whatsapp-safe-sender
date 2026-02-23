"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
class Scheduler {
    isRunning = false;
    dbService;
    waClient;
    dailyStats;
    mainWindow;
    messagesSentSession = 0;
    constructor(db, client, stats, win) {
        this.dbService = db;
        this.waClient = client;
        this.dailyStats = stats;
        this.mainWindow = win;
    }
    start() {
        if (this.isRunning)
            return;
        this.isRunning = true;
        this.processQueue();
        this.updateStatus('running');
    }
    stop() {
        this.isRunning = false;
        this.updateStatus('stopped');
    }
    async processQueue() {
        if (!this.isRunning)
            return;
        // Fetch a single pending queue item
        const item = this.dbService.getDb().prepare(`
            SELECT q.id as queue_id, q.campaign_id, q.contact_id, c.template_id 
            FROM campaign_queue q
            JOIN campaigns c ON q.campaign_id = c.id
            WHERE q.status = 'pending' AND c.status = 'active'
            ORDER BY q.created_at ASC
            LIMIT 1
        `).get();
        if (!item) {
            this.stop();
            // Check if ANY active campaigns exist, if so mark them completed
            this.dbService.getDb().prepare("UPDATE campaigns SET status = 'completed' WHERE status = 'active' AND id NOT IN (SELECT campaign_id FROM campaign_queue WHERE status = 'pending')").run();
            this.updateStatus('completed');
            return;
        }
        // 1. Check Daily Limit
        if (!this.dailyStats.canSend()) {
            this.stop();
            this.logSystem('Daily limit of 80 messages reached. Stopping safely.');
            this.updateStatus('limit-reached');
            this.dbService.getDb().prepare("UPDATE campaigns SET status = 'paused' WHERE status = 'active'").run();
            return;
        }
        // 2. Human Pause Logic
        if (this.messagesSentSession > 0 && this.messagesSentSession % (Math.floor(Math.random() * 3) + 5) === 0) {
            // Pause every 5-7 messages
            const pauseTime = Math.floor(Math.random() * (180000 - 60000 + 1) + 60000); // 1-3 minutes
            this.logSystem(`Taking a human pause for ${Math.round(pauseTime / 1000)} seconds...`);
            this.updateStatus('paused');
            await this.delay(pauseTime);
            if (!this.isRunning)
                return; // Check if stopped during pause
            this.updateStatus('running');
        }
        // 4. Get Data
        const contact = this.dbService.getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(item.contact_id);
        const template = this.dbService.getDb().prepare('SELECT * FROM templates WHERE id = ?').get(item.template_id);
        if (!contact || !template) {
            this.dbService.getDb().prepare('UPDATE campaign_queue SET status = ? WHERE id = ?').run('failed', item.queue_id);
            setImmediate(() => this.processQueue());
            return;
        }
        // 5. Content Variation
        const variations = this.dbService.getDb().prepare('SELECT * FROM template_variations WHERE template_id = ?').all(item.template_id);
        let messageBody = template.body;
        if (variations && variations.length > 0) {
            const randomVar = variations[Math.floor(Math.random() * variations.length)];
            messageBody = randomVar.variation;
        }
        // Replace variables
        messageBody = messageBody.replace('{name}', contact.name || 'Friend')
            .replace('{date}', new Date().toLocaleDateString());
        // 6. Delays (Safety)
        const delayTime = Math.floor(Math.random() * (25000 - 8000 + 1) + 8000); // 8-25 seconds
        this.logSystem(`Waiting ${Math.round(delayTime / 1000)}s before sending to ${contact.phone}...`);
        await this.delay(delayTime);
        if (!this.isRunning)
            return;
        // 7. Send
        try {
            await this.waClient.sendMessage(contact.phone, messageBody, template.media_path);
            this.dbService.getDb().prepare('UPDATE campaign_queue SET status = ? WHERE id = ?').run('sent', item.queue_id);
            this.dbService.getDb().prepare('INSERT INTO logs (contact_id, campaign_id, status, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)').run(item.contact_id, item.campaign_id, 'SENT');
            this.messagesSentSession++;
            if (!this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('log-update', { id: Date.now(), contact: contact.phone, status: 'SENT' });
            }
        }
        catch (error) {
            console.error('Send Error:', error);
            this.dbService.getDb().prepare('UPDATE campaign_queue SET status = ? WHERE id = ?').run('failed', item.queue_id);
            this.dbService.getDb().prepare('INSERT INTO logs (contact_id, campaign_id, status, error, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)').run(item.contact_id, item.campaign_id, 'FAILED', error.message);
            if (!this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('log-update', { id: Date.now(), contact: contact.phone, status: 'FAILED', error: error.message });
            }
        }
        // Loop
        setImmediate(() => this.processQueue());
    }
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
    logSystem(msg) {
        console.log(msg);
        if (!this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('log-update', { status: 'system', message: msg, timestamp: new Date().toISOString() });
        }
    }
    updateStatus(status) {
        if (!this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('status-update', status || (this.isRunning ? 'running' : 'idle'));
            try {
                const countRow = this.dbService.getDb().prepare("SELECT COUNT(*) as count FROM campaign_queue q JOIN campaigns c ON q.campaign_id = c.id WHERE q.status = 'pending' AND c.status = 'active'").get();
                this.mainWindow.webContents.send('queue-update', countRow ? countRow.count : 0);
            }
            catch (e) { }
        }
    }
}
exports.Scheduler = Scheduler;
