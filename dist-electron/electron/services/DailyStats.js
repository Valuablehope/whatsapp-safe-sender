"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DailyStats = void 0;
// STRICT DAILY LIMIT -- SAFETY FIRST
const DAILY_LIMIT = 80;
class DailyStats {
    dbService;
    constructor(dbService) {
        this.dbService = dbService;
    }
    getTodayCount() {
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
        const result = stmt.get();
        return result ? result.count : 0;
    }
    canSend() {
        const count = this.getTodayCount();
        return count < DAILY_LIMIT;
    }
    getLimit() {
        return DAILY_LIMIT;
    }
}
exports.DailyStats = DailyStats;
