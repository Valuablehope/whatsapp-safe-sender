import { Client, LocalAuth } from 'whatsapp-web.js';
import { BrowserWindow, app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
const { MessageMedia } = require('whatsapp-web.js');

export class WhatsAppClient {
    private client!: Client;
    private mainWindow: BrowserWindow;
    public isReady: boolean = false;
    private readonly sessionPath: string;

    constructor(mainWindow: BrowserWindow) {
        this.mainWindow = mainWindow;
        // Use a dedicated persistent profile inside the app's user data directory
        this.sessionPath = path.join(app.getPath('userData'), 'whatsapp-profile-session');

        // Handle app exit gracefully to prevent SQLite DB corruption
        app.on('before-quit', async () => {
            if (this.client) {
                console.log('Destroying WhatsApp client before app quit...');
                try {
                    await this.client.destroy();
                } catch (err) {
                    console.error('Error destroying WhatsApp client:', err);
                }
            }
        });

        this.initClient();
    }

    private initClient() {
        console.log('Initializing WhatsApp Client...');
        this.isReady = false;

        // @ts-ignore
        this.client = new Client({
            authStrategy: new LocalAuth({
                dataPath: this.sessionPath
            }),
            puppeteer: {
                headless: false, // Explicitly show the browser
                executablePath: 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--no-first-run',
                    '--no-zygote',
                    '--disable-gpu',
                    '--profile-directory=Default' // Helps reduce "Guest" profile behaviors
                ]
            }
        });

        this.bindEvents();

        this.client.initialize().catch((err: any) => {
            console.error('Failed to initialize WhatsApp client:', err);
            this.handleCorruption();
        });
    }

    private bindEvents() {
        this.client.on('qr', (qr: string) => {
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

        this.client.on('auth_failure', (msg: string) => {
            console.error('AUTHENTICATION FAILURE', msg);
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('status-update', 'auth-failure');
            }
            this.handleCorruption();
        });

        this.client.on('disconnected', (reason: string) => {
            this.isReady = false;
            console.log('Client was disconnected', reason);
            if (this.mainWindow && !this.mainWindow.isDestroyed()) {
                this.mainWindow.webContents.send('status-update', 'disconnected');
            }
            if (reason === 'NAVIGATION' || reason === 'Browser Closed') {
                return; // User intentionally closed browser or navigated away
            }
            this.handleCorruption();
        });
    }

    private async handleCorruption() {
        console.log('Handling possible session corruption...');

        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('log-update', {
                status: 'error',
                message: 'Session error or corruption detected. Clearing session data and restarting...',
                timestamp: new Date().toISOString()
            });
        }

        try {
            await this.client.destroy();
        } catch (e) {
            console.error('Error destroying client during corruption handling:', e);
        }

        try {
            if (fs.existsSync(this.sessionPath)) {
                fs.rmSync(this.sessionPath, { recursive: true, force: true });
                console.log('Deleted corrupted session path:', this.sessionPath);
            }
        } catch (cleanupErr) {
            console.error('Failed to delete corrupted session:', cleanupErr);
        }

        // Notify frontend that we need a fresh login
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('status-update', 'waiting-for-qr');
        }

        // Reinitialize fresh client after a short delay
        setTimeout(() => {
            this.initClient();
        }, 3000);
    }

    public async sendMessage(to: string, message: string, mediaPath?: string) {
        if (!this.isReady) {
            throw new Error('Client not ready');
        }
        let cleanNumber = to.replace(/\D/g, '');
        cleanNumber = cleanNumber.replace(/^0+/, '');
        const chatId = `${cleanNumber}@c.us`;
        console.log(`Sending message to ${chatId} (${to})`);

        try {
            if (mediaPath) {
                const media = MessageMedia.fromFilePath(mediaPath);
                return await (this.client as any).sendMessage(chatId, media, { caption: message });
            } else {
                return await this.client.sendMessage(chatId, message);
            }
        } catch (error) {
            console.error('Error sending message:', error);
            throw error;
        }
    }
}
