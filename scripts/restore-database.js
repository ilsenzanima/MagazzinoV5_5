/**
 * Database Restore Script
 * Restores data from JSON backups to Supabase
 * 
 * Usage: 
 *   npm run restore              - Interactive mode, lists available backups
 *   npm run restore <date>       - Restore from specific backup (e.g., 2026-01-14T20-20)
 *   npm run restore <date> <table> - Restore specific table only
 * 
 * CAUTION: This will overwrite existing data!
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');
const readline = require('readline');

const BACKUP_DIR = path.join(__dirname, '..', 'backups');

// Tables in order of dependencies (for restore)
const TABLES_ORDER = [
    'profiles',
    'clients',
    'suppliers',
    'inventory',
    'jobs',
    'purchases',
    'purchase_items',
    'workers',
    'attendance',
    'delivery_notes',
    'delivery_note_items',
];

// Get Supabase credentials
require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials!');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Helper to prompt user
function prompt(question) {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });
    return new Promise(resolve => {
        rl.question(question, answer => {
            rl.close();
            resolve(answer.trim());
        });
    });
}

// List available backups
function listBackups() {
    if (!fs.existsSync(BACKUP_DIR)) {
        console.error('❌ No backups directory found!');
        return [];
    }

    return fs.readdirSync(BACKUP_DIR)
        .filter(f => fs.statSync(path.join(BACKUP_DIR, f)).isDirectory())
        .sort()
        .reverse();
}

// Restore a single table
async function restoreTable(backupPath, tableName) {
    const filePath = path.join(backupPath, `${tableName}.json`);

    if (!fs.existsSync(filePath)) {
        console.log(`  ⚠️  ${tableName}.json not found, skipping`);
        return { tableName, restored: 0, skipped: true };
    }

    const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

    if (!data || data.length === 0) {
        console.log(`  ⏭️  ${tableName}: empty, skipping`);
        return { tableName, restored: 0, skipped: true };
    }

    console.log(`  🔄 Restoring ${tableName} (${data.length} records)...`);

    try {
        // Delete existing data first
        const { error: deleteError } = await supabase
            .from(tableName)
            .delete()
            .neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all

        if (deleteError) {
            console.error(`  ❌ Error clearing ${tableName}:`, deleteError.message);
            return { tableName, restored: 0, error: deleteError.message };
        }

        // Insert in batches of 100
        const batchSize = 100;
        let restored = 0;

        for (let i = 0; i < data.length; i += batchSize) {
            const batch = data.slice(i, i + batchSize);
            const { error: insertError } = await supabase
                .from(tableName)
                .insert(batch);

            if (insertError) {
                console.error(`  ❌ Error inserting batch in ${tableName}:`, insertError.message);
                return { tableName, restored, error: insertError.message };
            }

            restored += batch.length;
        }

        console.log(`  ✅ ${tableName}: ${restored} records restored`);
        return { tableName, restored };

    } catch (err) {
        console.error(`  ❌ Exception restoring ${tableName}:`, err.message);
        return { tableName, restored: 0, error: err.message };
    }
}

async function main() {
    const args = process.argv.slice(2);

    console.log('🔄 Database Restore Tool\n');

    // List available backups
    const backups = listBackups();

    if (backups.length === 0) {
        console.log('❌ No backups found!');
        process.exit(1);
    }

    let selectedBackup = args[0];
    let selectedTable = args[1];

    // If no backup specified, show interactive menu
    if (!selectedBackup) {
        console.log('📁 Available backups:\n');
        backups.forEach((b, i) => {
            const summaryPath = path.join(BACKUP_DIR, b, '_summary.json');
            let info = '';
            if (fs.existsSync(summaryPath)) {
                const summary = JSON.parse(fs.readFileSync(summaryPath, 'utf8'));
                info = ` (${summary.totalRecords} records)`;
            }
            console.log(`   ${i + 1}. ${b}${info}`);
        });

        const choice = await prompt('\n🔢 Enter number to restore (or q to quit): ');

        if (choice.toLowerCase() === 'q') {
            console.log('👋 Cancelled');
            process.exit(0);
        }

        const index = parseInt(choice) - 1;
        if (isNaN(index) || index < 0 || index >= backups.length) {
            console.log('❌ Invalid choice');
            process.exit(1);
        }

        selectedBackup = backups[index];
    }

    const backupPath = path.join(BACKUP_DIR, selectedBackup);

    if (!fs.existsSync(backupPath)) {
        console.log(`❌ Backup not found: ${selectedBackup}`);
        process.exit(1);
    }

    console.log(`\n📂 Selected backup: ${selectedBackup}\n`);

    // If no table specified, ask what to restore
    if (!selectedTable) {
        console.log('📋 Tables available:');
        TABLES_ORDER.forEach((t, i) => {
            const filePath = path.join(backupPath, `${t}.json`);
            if (fs.existsSync(filePath)) {
                const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));
                console.log(`   ${i + 1}. ${t} (${data.length} records)`);
            }
        });
        console.log(`   A. ALL tables`);

        const choice = await prompt('\n🔢 Enter number or A for all (q to quit): ');

        if (choice.toLowerCase() === 'q') {
            console.log('👋 Cancelled');
            process.exit(0);
        }

        if (choice.toLowerCase() !== 'a') {
            const index = parseInt(choice) - 1;
            if (isNaN(index) || index < 0 || index >= TABLES_ORDER.length) {
                console.log('❌ Invalid choice');
                process.exit(1);
            }
            selectedTable = TABLES_ORDER[index];
        }
    }

    // Confirm before proceeding
    const target = selectedTable || 'ALL TABLES';
    console.log(`\n⚠️  WARNING: This will DELETE and replace data in: ${target}`);
    const confirm = await prompt('   Type "RESTORE" to confirm: ');

    if (confirm !== 'RESTORE') {
        console.log('👋 Cancelled');
        process.exit(0);
    }

    console.log('\n🚀 Starting restore...\n');

    // Perform restore
    const tablesToRestore = selectedTable ? [selectedTable] : TABLES_ORDER;
    const results = [];

    for (const table of tablesToRestore) {
        const result = await restoreTable(backupPath, table);
        results.push(result);
    }

    // Print summary
    console.log('\n📊 Restore Summary:');
    let totalRestored = 0;
    for (const r of results) {
        if (r.error) {
            console.log(`   ❌ ${r.tableName}: ERROR - ${r.error}`);
        } else if (r.skipped) {
            console.log(`   ⏭️  ${r.tableName}: skipped`);
        } else {
            console.log(`   ✅ ${r.tableName}: ${r.restored} records`);
            totalRestored += r.restored;
        }
    }
    console.log(`\n   Total restored: ${totalRestored} records`);
}

main().catch(console.error);
