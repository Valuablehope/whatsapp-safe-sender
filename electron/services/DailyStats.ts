import { DBService } from './Database';

// STRICT DAILY LIMIT -- SAFETY FIRST
const DAILY_LIMIT = 80;

export class DailyStats {
    private dbService: DBService;

    constructor(dbService: DBService) {
        this.dbService = dbService;
    }

    public getTodayCount(): number {
        const db = this.dbService.getDb();
        // Count 'SENT' messages for today (local time)
        // SQLITE 'date("now", "localtime")' helps if needed, but 'date("now")' is UTC.
        // Let's rely on standard ISO string prefix YYYY-MM-DD
        const today = new Date().toISOString().split('T')[0];
        const stmt = db.prepare(`
      SELECT COUNT(*) as count 
      FROM logs 
      WHERE status = 'SENT' 
      AND date(timestamp) = date('now')
    `);
        const result = stmt.get() as { count: number };
        return result ? result.count : 0;
    }

    public canSend(): boolean {
        const count = this.getTodayCount();
        return count < DAILY_LIMIT;
    }

    public getLimit(): number {
        return DAILY_LIMIT;
    }
}
