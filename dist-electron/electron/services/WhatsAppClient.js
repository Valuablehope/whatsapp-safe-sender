"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.WhatsAppClient = void 0;
const whatsapp_web_js_1 = require("whatsapp-web.js");
const electron_1 = require("electron");
const fs = __importStar(require("fs"));
const path = __importStar(require("path"));
const { MessageMedia } = require('whatsapp-web.js');
class WhatsAppClient {
    client;
    mainWindow;
    isReady = false;
    sessionPath;
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        // Use a dedicated persistent profile inside the app's user data directory
        this.sessionPath = path.join(electron_1.app.getPath('userData'), 'whatsapp-profile-session');
        // Handle app exit gracefully to prevent SQLite DB corruption
        electron_1.app.on('before-quit', async () => {
            if (this.client) {
                console.log('Destroying WhatsApp client before app quit...');
                try {
                    await this.client.destroy();
                }
                catch (err) {
                    console.error('Error destroying WhatsApp client:', err);
                }
            }
        });
        this.initClient();
    }
    initClient() {
        console.log('Initializing WhatsApp Client...');
        this.isReady = false;
        // @ts-ignore
        this.client = new whatsapp_web_js_1.Client({
            authStrategy: new whatsapp_web_js_1.LocalAuth({
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
        this.client.initialize().catch((err) => {
            console.error('Failed to initialize WhatsApp client:', err);
            this.handleCorruption();
        });
    }
    bindEvents() {
        this.client.on('qr', (qr) => {
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
            this.handleCorruption();
        });
        this.client.on('disconnected', (reason) => {
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
    async handleCorruption() {
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
        }
        catch (e) {
            console.error('Error destroying client during corruption handling:', e);
        }
        try {
            if (fs.existsSync(this.sessionPath)) {
                fs.rmSync(this.sessionPath, { recursive: true, force: true });
                console.log('Deleted corrupted session path:', this.sessionPath);
            }
        }
        catch (cleanupErr) {
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
    async sendMessage(to, message, mediaPath) {
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
