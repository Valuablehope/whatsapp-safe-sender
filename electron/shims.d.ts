declare module 'whatsapp-web.js' {
    export class Client {
        constructor(options?: any);
        on(event: string, cb: (...args: any[]) => void): void;
        initialize(): Promise<void>;
        sendMessage(to: string, body: string): Promise<any>;
        destroy(): Promise<void>;
    }
    export class LocalAuth {
        constructor(options?: any);
    }
}

declare module 'fluent-ffmpeg';
declare module 'ffmpeg-static';
