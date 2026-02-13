import { FileText, Clock, AlertCircle, CheckCircle, Trash2 } from 'lucide-react';
import { Card } from './ui/Card';
import { Badge } from './ui/Badge';
import { Button } from './ui/Button';
import './logs.css';

interface LogsScreenProps {
    logs: any[];
    onClearLogs?: () => void;
}

export const LogsScreen = ({ logs, onClearLogs }: LogsScreenProps) => {
    return (
        <div className="logs-container">
            <header className="page-header justify-between items-center flex">
                <div>
                    <h1 className="page-title">
                        <FileText className="text-emerald" size={32} />
                        Activity Logs
                    </h1>
                    <p className="page-subtitle">Real-time system events and delivery reports.</p>
                </div>
                {onClearLogs && (
                    <Button variant="outline" onClick={onClearLogs} className="gap-2 border-slate-700 hover:bg-slate-800 text-slate-400 hover:text-rose-400">
                        <Trash2 size={16} />
                        Clear Logs
                    </Button>
                )}
            </header>

            <Card className="logs-card">
                <div className="logs-header">
                    <div className="logs-header-row">
                        <span className="col-time">Time</span>
                        <span className="col-status">Status</span>
                        <span className="col-message">Message</span>
                    </div>
                </div>

                <div className="logs-list">
                    {logs.length === 0 ? (
                        <div className="empty-logs">
                            <FileText size={48} className="mb-4 text-slate-700" />
                            <p className="text-lg font-medium">No activity recorded yet</p>
                            <p className="text-sm mt-2 text-muted">Logs will appear here when you start a campaign</p>
                        </div>
                    ) : (
                        logs.map((log, i) => {
                            const isError = log.status === 'ERROR' || log.status === 'FAILED';
                            const isSuccess = log.status === 'SENT';

                            return (
                                <div key={i} className={`log-item ${isError ? 'error' : isSuccess ? 'success' : 'default'}`}>
                                    <span className="col-time font-mono">
                                        <Clock size={12} className="opacity-70 mr-2 inline" />
                                        {new Date(log.timestamp || Date.now()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                                    </span>

                                    <span className="col-status">
                                        <Badge
                                            variant={isError ? 'destructive' : isSuccess ? 'default' : 'secondary'}
                                            className="status-badge"
                                        >
                                            {log.status}
                                        </Badge>
                                    </span>

                                    <span className={`col-message ${isError ? 'text-rose-300' : 'text-slate-300'}`}>
                                        {isError ? <AlertCircle size={14} className="icon-status text-rose" /> : isSuccess ? <CheckCircle size={14} className="icon-status text-emerald" /> : null}
                                        {log.message || log.error || `Message sent to ${log.contact}`}
                                    </span>
                                </div>
                            );
                        })
                    )}
                </div>
            </Card>
        </div>
    );
};
