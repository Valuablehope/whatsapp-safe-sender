import { useEffect, useState } from 'react';
import QRCode from 'qrcode';
import { Wifi, WifiOff, MessageSquare, Activity } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from './ui/Card';
import './dashboard.css';

interface DashboardProps {
    status: string;
    qrCode: string | null;
    dailyCount: number;
}

export const Dashboard = ({ status, qrCode, dailyCount }: DashboardProps) => {
    const [qrSrc, setQrSrc] = useState<string>('');

    useEffect(() => {
        let isActive = true;
        if (qrCode) {
            console.log('[Dashboard] QR Code received, generating image...');
            const start = Date.now();
            QRCode.toDataURL(qrCode)
                .then(url => {
                    if (isActive) {
                        console.log(`[Dashboard] QR Code generated in ${Date.now() - start}ms`);
                        setQrSrc(url);
                    } else {
                        console.warn('[Dashboard] QR Code generation ignored (stale)');
                    }
                })
                .catch(err => console.error('[Dashboard] QR generation error:', err));
        } else {
            console.log('[Dashboard] QR Code cleared/empty');
            setQrSrc('');
        }
        return () => { isActive = false; };
    }, [qrCode]);

    return (
        <div className="dashboard-container">
            <header className="dashboard-header">
                <h1 className="dashboard-title">
                    <Activity className="text-emerald" size={32} />
                    Dashboard
                </h1>
                <p className="dashboard-subtitle">Overview of your campaign activity</p>
            </header>

            <div className="dashboard-grid">
                {/* Daily Quota Card */}
                <Card className="dashboard-card-center">
                    <CardHeader className="flex flex-col items-center pb-2 border-b-0">
                        <div className="flex items-center gap-2 text-muted">
                            <MessageSquare size={20} className="text-emerald" />
                            <CardTitle>Daily Quota</CardTitle>
                        </div>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center pt-0">
                        <div className="chart-container">
                            <svg viewBox="0 0 36 36" className="chart-svg">
                                <path
                                    style={{ color: 'var(--surface-active)' }}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="3.8"
                                />
                                <path
                                    style={{
                                        color: 'var(--primary)',
                                        filter: 'drop-shadow(0 0 4px rgba(16,185,129,0.4))',
                                        transition: 'stroke-dasharray 1s ease-out'
                                    }}
                                    strokeDasharray={`${(dailyCount / 80) * 100}, 100`}
                                    d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                                    fill="none"
                                    stroke="currentColor"
                                    strokeWidth="2.8"
                                    strokeLinecap="round"
                                />
                            </svg>
                            <div className="chart-value">
                                <span className="chart-number">{dailyCount}</span>
                                <span className="chart-label">/ 80</span>
                            </div>
                        </div>
                        <p className="chart-label">Messages Sent Today</p>
                    </CardContent>
                </Card>

                {/* Connection Card */}
                <Card className="dashboard-card-center">
                    <CardHeader className="flex flex-col items-center pb-2 border-b-0">
                        <div className="flex items-center gap-2 text-muted">
                            {status === 'ready' ? <Wifi size={20} className="text-emerald" /> : <WifiOff size={20} className="text-rose" />}
                            <CardTitle>WhatsApp Connection</CardTitle>
                        </div>
                    </CardHeader>

                    <CardContent className="flex flex-col items-center pt-0 w-full">
                        <div className="connection-status">
                            {status === 'ready' ? (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="status-icon-circle bg-emerald-soft">
                                        <Wifi size={28} className="text-emerald" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-emerald">Connected</p>
                                        <p className="text-sm text-muted mt-1">Ready to send messages</p>
                                    </div>
                                </div>
                            ) : qrSrc ? (
                                <div className="flex flex-col items-center gap-3">
                                    <img src={qrSrc} alt="QR Code" className="qr-code-img" />
                                    <p className="text-xs text-muted">Scan with WhatsApp</p>
                                </div>
                            ) : (
                                <div className="flex flex-col items-center gap-4">
                                    <div className="status-icon-circle bg-slate-soft">
                                        <WifiOff size={28} className="text-muted" />
                                    </div>
                                    <div className="text-center">
                                        <p className="text-lg font-semibold text-muted">Disconnected</p>
                                        <p className="text-sm text-muted mt-1">Waiting for connection...</p>
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            </div>
        </div>
    );
};
