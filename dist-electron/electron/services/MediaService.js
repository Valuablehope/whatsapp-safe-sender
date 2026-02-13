"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MediaService = void 0;
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_1 = require("electron");
// Change to require to ensure correct CommonJS behavior in Electron
const ffmpeg = require('fluent-ffmpeg');
const ffmpegStatic = require('ffmpeg-static');
// Global config attempt
if (ffmpegStatic) {
    try {
        ffmpeg.setFfmpegPath(ffmpegStatic);
        process.env.FFMPEG_PATH = ffmpegStatic;
    }
    catch (e) {
        console.error('Error setting global ffmpeg path:', e);
    }
}
class MediaService {
    mainWindow;
    uploadDir;
    constructor(mainWindow) {
        this.mainWindow = mainWindow;
        this.uploadDir = path_1.default.join(electron_1.app.getPath('userData'), 'media_uploads');
        // Ensure upload directory exists
        if (!fs_1.default.existsSync(this.uploadDir)) {
            fs_1.default.mkdirSync(this.uploadDir, { recursive: true });
        }
    }
    async processUpload(filePath) {
        const ext = path_1.default.extname(filePath).toLowerCase();
        const fileName = `${Date.now()}_${path_1.default.basename(filePath)}`;
        const destPath = path_1.default.join(this.uploadDir, fileName);
        return new Promise((resolve, reject) => {
            if (['.mp4', '.mov', '.avi', '.mkv'].includes(ext)) {
                // Compress Video
                this.compressVideo(filePath, destPath, resolve, reject);
            }
            else {
                // Copy Image/Other
                this.copyFile(filePath, destPath, resolve, reject);
            }
        });
    }
    compressVideo(inputPath, outputPath, resolve, reject) {
        console.log(`[MediaService] Starting compression for ${inputPath}`);
        // Paranoid check/set
        if (ffmpegStatic) {
            console.log(`[MediaService] Force setting ffmpeg path to: ${ffmpegStatic}`);
            ffmpeg.setFfmpegPath(ffmpegStatic);
        }
        this.emitProgress(0);
        const command = ffmpeg(inputPath);
        // Double check command was created
        if (!command) {
            reject(new Error('Failed to create ffmpeg command'));
            return;
        }
        command
            .output(outputPath)
            .videoCodec('libx264')
            .size('?x720') // Resilience: Resize to 720p if larger, maintain aspect ratio
            .outputOptions([
            '-crf 28', // Constant Rate Factor (lower is better quality, higher is lower size. 28 is good for WhatsApp)
            '-preset fast', // Encoding speed vs compression ratio
            '-movflags +faststart' // Optimize for web/streaming
        ])
            .on('progress', (progress) => {
            // progress.percent is not always reliable with some containers, fallback to time if needed, 
            // but fluent-ffmpeg usually does a good job if duration is known.
            const percent = progress.percent ? Math.round(progress.percent) : 0;
            this.emitProgress(percent);
            console.log(`[MediaService] Processing: ${percent}% done`);
        })
            .on('end', () => {
            console.log('[MediaService] Compression finished successfully');
            this.emitProgress(100);
            resolve(outputPath);
        })
            .on('error', (err) => {
            console.error('[MediaService] Compression error:', err);
            reject(err);
        })
            .run();
    }
    copyFile(inputPath, outputPath, resolve, reject) {
        const totalSize = fs_1.default.statSync(inputPath).size;
        let copiedSize = 0;
        const readStream = fs_1.default.createReadStream(inputPath);
        const writeStream = fs_1.default.createWriteStream(outputPath);
        readStream.on('data', (chunk) => {
            copiedSize += chunk.length;
            const percent = Math.round((copiedSize / totalSize) * 100);
            this.emitProgress(percent);
        });
        readStream.on('error', reject);
        writeStream.on('error', reject);
        writeStream.on('finish', () => {
            resolve(outputPath);
        });
        readStream.pipe(writeStream);
    }
    emitProgress(percent) {
        if (this.mainWindow && !this.mainWindow.isDestroyed()) {
            this.mainWindow.webContents.send('media-upload-progress', percent);
        }
    }
}
exports.MediaService = MediaService;
