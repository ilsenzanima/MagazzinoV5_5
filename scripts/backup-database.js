/**
 * Database Backup Script
 * Exports all Supabase tables to a private Supabase Storage bucket.
 *
 * Usage: npm run backup
 *
 * Saves backups to: storage bucket "backups" / YYYY-MM-DDTHH-mm / <table>.json
 * Keeps last MAX_BACKUPS weekly snapshots (older ones are auto-deleted).
 */

const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const MAX_BACKUPS = 12; // keep last 12 weekly backups (~3 months)
const BUCKET = 'backups';

const TABLES = [
    'profiles',
    'warehouses',
    'brands',
    'item_types',
    'units',
    'clients',
    'client_contacts',
    'suppliers',
    'supplier_compliance_documents',
    'inventory',
    'inventory_supplier_codes',
    'fictitious_item_prices',
    'jobs',
    'sites',
    'job_logs',
    'job_documents',
    'job_inventory',
    'job_commessa_documents',
    'job_compliance_associations',
    'job_sal_names',
    'job_sal_items',
    'job_sal_costs',
    'job_sal_approvati',
    'job_fatture_committente',
    'job_sal_fattura_links',
    'job_cost_analysis_params',
    'job_cost_analysis_rows',
    'client_proposals',
    'proposal_cost_analysis_params',
    'proposal_cost_analysis_rows',
    'proposal_documents',
    'proposal_compliance_associations',
    'purchases',
    'purchase_items',
    'invoices',
    'delivery_notes',
    'delivery_note_items',
    'load_notes',
    'load_note_items',
    'movements',
    'workers',
    'attendance',
    'attendance_corrections',
    'leave_requests',
    'worker_courses',
    'worker_medical_exams',
];

require('dotenv').config({ path: path.join(__dirname, '..', '.env.local') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing Supabase credentials!');
    console.error('Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function ensureBucket() {
    const { data: buckets } = await supabase.storage.listBuckets();
    const exists = buckets?.some(b => b.name === BUCKET);
    if (!exists) {
        const { error } = await supabase.storage.createBucket(BUCKET, { public: false });
        if (error) throw new Error(`Cannot create bucket: ${error.message}`);
        console.log(`🪣  Created private bucket "${BUCKET}"`);
    }
}

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

async function uploadFile(storagePath, content) {
    const { error } = await supabase.storage
        .from(BUCKET)
        .upload(storagePath, Buffer.from(content, 'utf-8'), {
            contentType: 'application/json',
            upsert: true,
        });
    if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
}

async function cleanOldBackups(currentTimestamp) {
    // List top-level "folders" (unique prefixes before the first /)
    const { data, error } = await supabase.storage.from(BUCKET).list('', { limit: 200 });
    if (error) {
        console.warn('  ⚠️  Could not list backups for cleanup:', error.message);
        return;
    }

    // Each item is a folder entry whose name is the timestamp prefix
    const folders = (data || [])
        .filter(item => item.id === null) // folders have null id in Supabase Storage
        .map(item => item.name)
        .sort()
        .reverse();

    const toDelete = folders.slice(MAX_BACKUPS);
    for (const folder of toDelete) {
        // List all files inside the folder then remove them
        const { data: files } = await supabase.storage.from(BUCKET).list(folder);
        if (files?.length) {
            const paths = files.map(f => `${folder}/${f.name}`);
            await supabase.storage.from(BUCKET).remove(paths);
        }
        console.log(`  🗑️  Removed old backup: ${folder}`);
    }
}

async function main() {
    console.log('🚀 Starting database backup...\n');

    await ensureBucket();

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 16);
    console.log(`📁 Backup folder: ${BUCKET}/${timestamp}\n`);

    const results = [];
    let totalRecords = 0;

    for (const table of TABLES) {
        const result = await backupTable(table);
        results.push(result);

        if (result.data) {
            await uploadFile(`${timestamp}/${table}.json`, JSON.stringify(result.data, null, 2));
            totalRecords += result.count;
        }
    }

    const summary = {
        timestamp: new Date().toISOString(),
        tables: results.map(r => ({ name: r.tableName, records: r.count, error: r.error })),
        totalRecords,
    };
    await uploadFile(`${timestamp}/_summary.json`, JSON.stringify(summary, null, 2));

    console.log('\n🧹 Cleaning old backups...');
    await cleanOldBackups(timestamp);

    console.log('\n✅ Backup completed!\n');
    console.log('📊 Summary:');
    for (const result of results) {
        const status = result.error ? '❌' : '✅';
        console.log(`   ${status} ${result.tableName}: ${result.count} records`);
    }
    console.log(`\n   Total: ${totalRecords} records`);
    console.log(`   Location: Supabase Storage → ${BUCKET}/${timestamp}`);
}

main().catch(err => {
    console.error('💥 Backup failed:', err.message);
    process.exit(1);
});
