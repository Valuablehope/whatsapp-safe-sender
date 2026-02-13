"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Scheduler = void 0;
class Scheduler {
    queue = [];
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
    addToQueue(items) {
        this.queue.push(...items);
        this.updateStatus();
        if (!this.isRunning) {
            // Auto-start or wait for manual start? Prompt says "Start / Pause / Stop buttons"
            // So we wait for explicit start call.
        }
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
    clearQueue() {
        this.queue = [];
        this.updateStatus();
    }
    async processQueue() {
        if (!this.isRunning)
            return;
        if (this.queue.length === 0) {
            this.stop();
            this.updateStatus('completed');
            return;
        }
        // 1. Check Daily Limit
        if (!this.dailyStats.canSend()) {
            this.stop();
            this.logSystem('Daily limit of 80 messages reached. Stopping safely.');
            this.updateStatus('limit-reached');
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
        // 3. Get User
        const item = this.queue.shift();
        if (!item)
            return;
        // 4. Get Data
        const contact = this.dbService.getDb().prepare('SELECT * FROM contacts WHERE id = ?').get(item.contactId);
        const template = this.dbService.getDb().prepare('SELECT * FROM templates WHERE id = ?').get(item.templateId);
        // 5. Content Variation
        const variations = this.dbService.getDb().prepare('SELECT * FROM template_variations WHERE template_id = ?').all(item.templateId);
        let messageBody = template.body;
        if (variations && variations.length > 0) {
            const randomVar = variations[Math.floor(Math.random() * variations.length)];
            // Simplistic variation logic: replace whole body or part?
            // Prompt says "Randomly select one template variation". 
            // Assuming variation stores the full body text variant.
            messageBody = randomVar.variation;
        }
        // Replace variables
        messageBody = messageBody.replace('{name}', contact.name || 'Friend')
            .replace('{date}', new Date().toLocaleDateString());
        // 6. Delays (Safety)
        const delayTime = Math.floor(Math.random() * (25000 - 8000 + 1) + 8000); // 8-25 seconds
        this.logSystem(`Waiting ${Math.round(delayTime / 1000)}s before sending to ${contact.phone}...`);
        await this.delay(delayTime);
        if (!this.isRunning) {
            this.queue.unshift(item); // Put back
            return;
        }
        // 7. Send
        try {
            await this.waClient.sendMessage(contact.phone, messageBody, template.media_path);
            // Log Success
            this.dbService.getDb().prepare('INSERT INTO logs (contact_id, campaign_id, status, timestamp) VALUES (?, ?, ?, CURRENT_TIMESTAMP)')
                .run(item.contactId, item.campaignId, 'SENT');
            this.messagesSentSession++;
            this.mainWindow.webContents.send('log-update', { id: Date.now(), contact: contact.phone, status: 'SENT' });
        }
        catch (error) {
            console.error('Send Error:', error);
            this.dbService.getDb().prepare('INSERT INTO logs (contact_id, campaign_id, status, error, timestamp) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)')
                .run(item.contactId, item.campaignId, 'FAILED', error.message);
            this.mainWindow.webContents.send('log-update', { id: Date.now(), contact: contact.phone, status: 'FAILED', error: error.message });
            // Auto-stop on error spike? For now just log.
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
            this.mainWindow.webContents.send('queue-update', this.queue.length);
        }
    }
}
exports.Scheduler = Scheduler;
