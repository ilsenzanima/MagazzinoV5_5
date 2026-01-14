/**
 * Database Backup Script
 * Exports all Supabase tables to JSON files
 * 
 * Usage: npm run backup
 * 
 * Saves backups to: backups/YYYY-MM-DD_HH-mm/
 * Keeps last 4 backups (configurable via MAX_BACKUPS)
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Configuration
const MAX_BACKUPS = 12; // Keep last 12 weekly backups (3 months)
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Tables to backup (in order of dependencies)
const TABLES = [
    'profiles',
    'clients',
    'suppliers',
    'inventory',
    'jobs',
    'purchases',
    'purchase_items',
    'delivery_notes',
    'delivery_note_items',
    'workers',
    'attendance',
];

// Get Supabase credentials from environment or .env.local
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials!');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function backupTable(tableName) {
    console.log(`  📦 Backing up ${tableName}...`);

    try {
        const { data, error } = await supabase
            .from(tableName)
            .select('*')
            .order('created_at', { ascending: true });

        if (error) {
            console.error(`  ❌ Error backing up ${tableName}:`, error.message);
            return { tableName, count: 0, error: error.message };
        }

        return { tableName, data, count: data?.length || 0 };
    } catch (err) {
        console.error(`  ❌ Exception backing up ${tableName}:`, err.message);
        return { tableName, count: 0, error: err.message };
    }
}

function cleanOldBackups() {
    if (!fs.existsSync(BACKUP_DIR)) return;

    const backups = fs.readdirSync(BACKUP_DIR)
        .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
        .sort()
        .reverse();

    // Keep only MAX_BACKUPS
    const toDelete = backups.slice(MAX_BACKUPS);

    for (const backup of toDelete) {
        const backupPath = path.join(BACKUP_DIR, backup);
        console.log(`  🗑️  Removing old backup: ${backup}`);
        fs.rmSync(backupPath, { recursive: true, force: true });
    }
}

async function main() {
    console.log('🚀 Starting database backup...\n');

    // Create backup directory with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    const backupPath = path.join(BACKUP_DIR, timestamp);

    if (!fs.existsSync(backupPath)) {
        fs.mkdirSync(backupPath, { recursive: true });
    }

    console.log(`📁 Backup directory: ${backupPath}\n`);

    // Backup all tables
    const results = [];
    let totalRecords = 0;

    for (const table of TABLES) {
        const result = await backupTable(table);
        results.push(result);

        if (result.data) {
            const filePath = path.join(backupPath, `${table}.json`);
            fs.writeFileSync(filePath, JSON.stringify(result.data, null, 2));
            totalRecords += result.count;
        }
    }

    // Create summary file
    const summary = {
        timestamp: new Date().toISOString(),
        tables: results.map(r => ({ name: r.tableName, records: r.count, error: r.error })),
        totalRecords,
    };

    fs.writeFileSync(
        path.join(backupPath, '_summary.json'),
        JSON.stringify(summary, null, 2)
    );

    // Clean old backups
    console.log('\n🧹 Cleaning old backups...');
    cleanOldBackups();

    // Print summary
    console.log('\n✅ Backup completed!\n');
    console.log('📊 Summary:');
    for (const result of results) {
        const status = result.error ? '❌' : '✅';
        console.log(`   ${status} ${result.tableName}: ${result.count} records`);
    }
    console.log(`\n   Total: ${totalRecords} records`);
    console.log(`   Location: ${backupPath}`);
}

main().catch(console.error);
