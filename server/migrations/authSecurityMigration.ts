import { sql } from "drizzle-orm";
import { db } from "../storage";

export async function migrateAuthSecurity() {
  // Add email verification and password reset columns to users table
  const columns = [
    { name: 'email_verified', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified BOOLEAN DEFAULT false` },
    { name: 'email_verify_token', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_token VARCHAR(255)` },
    { name: 'email_verify_expires', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verify_expires TIMESTAMP` },
    { name: 'password_reset_token', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_token VARCHAR(255)` },
    { name: 'password_reset_expires', sql: `ALTER TABLE users ADD COLUMN IF NOT EXISTS password_reset_expires TIMESTAMP` },
  ];

  for (const col of columns) {
    try {
      await db.execute(sql.raw(col.sql));
    } catch (err: any) {
      // Column might already exist — that's fine
      if (!err.message?.includes('already exists')) {
        console.error(`Migration: failed to add ${col.name}:`, err.message);
      }
    }
  }

  console.log('Migration: auth security columns ready');
}
