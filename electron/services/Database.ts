import Database from 'better-sqlite3';
import path from 'path';
import { app } from 'electron';

export class DBService {
  private db: Database.Database;

  constructor() {
    const dbPath = path.join(app.getPath('userData'), 'whatsapp-sender.db');
    console.log('Database path:', dbPath);
    this.db = new Database(dbPath);
    this.init();
  }

  private init() {
    // Enable foreign keys
    this.db.pragma('foreign_keys = ON');

    // Create tables
    const schema = `
      CREATE TABLE IF NOT EXISTS contacts (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT,
        phone TEXT UNIQUE,
        tag TEXT
      );

      CREATE TABLE IF NOT EXISTS templates (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        title TEXT,
        type TEXT CHECK(type IN ('text', 'image', 'video')),
        body TEXT,
        media_path TEXT
      );

      CREATE TABLE IF NOT EXISTS template_variations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        template_id INTEGER,
        variation TEXT,
        FOREIGN KEY(template_id) REFERENCES templates(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS media (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        path TEXT,
        type TEXT
      );

      CREATE TABLE IF NOT EXISTS campaigns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        template_id INTEGER,
        status TEXT DEFAULT 'draft',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(template_id) REFERENCES templates(id)
      );

      CREATE TABLE IF NOT EXISTS campaign_queue (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        campaign_id INTEGER,
        contact_id INTEGER,
        status TEXT DEFAULT 'pending',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(campaign_id) REFERENCES campaigns(id) ON DELETE CASCADE,
        FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE,
        UNIQUE(campaign_id, contact_id)
      );

      CREATE TABLE IF NOT EXISTS logs (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        contact_id INTEGER,
        campaign_id INTEGER,
        status TEXT,
        error TEXT,
        timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY(contact_id) REFERENCES contacts(id),
        FOREIGN KEY(campaign_id) REFERENCES campaigns(id)
      );

      CREATE TABLE IF NOT EXISTS groups (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        description TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS group_members (
        group_id INTEGER,
        contact_id INTEGER,
        PRIMARY KEY (group_id, contact_id),
        FOREIGN KEY(group_id) REFERENCES groups(id) ON DELETE CASCADE,
        FOREIGN KEY(contact_id) REFERENCES contacts(id) ON DELETE CASCADE
      );
    `;

    this.db.exec(schema);

    // Migrations
    this.runMigrations();
  }

  private runMigrations() {
    try {
      const tableInfo = this.db.pragma('table_info(templates)') as any[];
      const hasMediaPath = tableInfo.some(col => col.name === 'media_path');

      if (!hasMediaPath) {
        console.log('[Database] Migrating: Adding media_path to templates');
        this.db.prepare('ALTER TABLE templates ADD COLUMN media_path TEXT').run();
      }

      const campTableInfo = this.db.pragma('table_info(campaigns)') as any[];
      const hasName = campTableInfo.some(col => col.name === 'name');
      if (!hasName) {
        console.log('[Database] Migrating: Adding name and status to campaigns');
        this.db.prepare("ALTER TABLE campaigns ADD COLUMN name TEXT DEFAULT 'Legacy Campaign' NOT NULL").run();
        this.db.prepare("ALTER TABLE campaigns ADD COLUMN status TEXT DEFAULT 'completed'").run();
      }
    } catch (error) {
      console.error('[Database] Migration error:', error);
    }
  }

  public getDb() {
    return this.db;
  }

  public reset() {
    // Delete in order of dependencies (child tables first)
    const tables = [
      'logs',
      'campaign_queue',
      'group_members',
      'campaigns',
      'template_variations',
      'contacts',
      'groups',
      'templates',
      'media'
    ];
    const deleteTransaction = this.db.transaction(() => {
      for (const table of tables) {
        this.db.prepare(`DELETE FROM ${table}`).run();
        this.db.prepare(`DELETE FROM sqlite_sequence WHERE name = ?`).run(table);
      }
    });
    deleteTransaction();
  }
}
