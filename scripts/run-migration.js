#!/usr/bin/env node
require('dotenv').config();
const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL
});

async function runMigration() {
  const migrationPath = path.join(__dirname, '../database/migrations/001_add_player_profiles.sql');
  const sql = fs.readFileSync(migrationPath, 'utf-8');

  console.log('🔄 Running migration: 001_add_player_profiles.sql');

  try {
    await pool.query(sql);
    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('Full error:', error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

runMigration();
