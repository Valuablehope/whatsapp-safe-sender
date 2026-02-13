"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppClient = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const { MessageMedia } = require('whatsapp-web.js');
class WhatsAppClient {
    client;
    mainWindow;
    isReady = false;
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        // Safety: Run non-headless to avoid "Headless Chromium" ban triggers
        // @ts-ignore
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth(),
            puppeteer: {
                headless: false, // Explicitly show the browser
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                args: ['--no-sandbox', '--disable-setuid-sandbox']
            }
        });
        this.init();
    }
    init() {
        this.client.on('qr', (qr) => {
            // Send QR to frontend
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('qr-code', qr);
                this.mainWindow.webContents.send('status-update', 'scan-qr');
            }
        });
        this.client.on('ready', () => {
            this.isReady = true;
            console.log('WhatsApp Client is ready!');
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('status-update', 'ready');
                this.mainWindow.webContents.send('log-update', {
                    status: 'system',
                    message: 'WhatsApp Client Connected',
                    timestamp: new Date().toISOString()
                });
            }
        });
        this.client.on('auth_failure', (msg) => {
            console.error('AUTHENTICATION FAILURE', msg);
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('status-update', 'auth-failure');
            }
        });
        this.client.on('disconnected', (reason) => {
            this.isReady = false;
            console.log('Client was disconnected', reason);
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('status-update', 'disconnected');
            }
        });
        this.client.initialize().catch((err) => {
            console.error('Failed to initialize WhatsApp client:', err);
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('log-update', {
                    status: 'error',
                    message: `Failed to initialize WhatsApp: ${err.message}`,
                    timestamp: new Date().toISOString()
                });
            }
        });
    }
    async sendMessage(to, message, mediaPath) {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }
        // whatsapp-web.js expects numbers without '+' and with country code
        // simple sanitization: remove non-digits, then remove leading zeros
        let cleanNumber = to.replace(/\D/g, '');
        cleanNumber = cleanNumber.replace(/^0+/, ''); // Remove leading zeros (e.g. 00961 -> 961)
        const chatId = `${cleanNumber}@c.us`;
        console.log(`Sending message to ${chatId} (${to})`);
        try {
            if (mediaPath) {
                const media = MessageMedia.fromFilePath(mediaPath);
                return await this.client.sendMessage(chatId, media, { caption: message });
            }
            else {
                return await this.client.sendMessage(chatId, message);
            }
        }
        catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
}
exports.WhatsAppClient = WhatsAppClient;
