
import { createClient } from '@supabase/supabase-js';
import * as fs from 'fs';
import * as path from 'path';

// Load environment variables manually
const envPath = path.resolve(process.cwd(), '.env.local');
const envConfig = fs.readFileSync(envPath, 'utf-8');
const env: { [key: string]: string } = {};

envConfig.split('\n').forEach(line => {
    const [key, ...valueParts] = line.split('=');
    if (key && valueParts.length > 0) {
        let value = valueParts.join('=');
        // Remove quotes if present
        value = value.trim().replace(/^["']|["']$/g, '');
        env[key.trim()] = value;
    }
});

const supabaseUrl = env['NEXT_PUBLIC_SUPABASE_URL'];
const supabaseKey = env['NEXT_PUBLIC_SUPABASE_ANON_KEY'];

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkJobs() {
    console.log('Checking recent jobs...');

    const { data: jobs, error } = await supabase
        .from('jobs')
        .select('id, code, description, status, created_at, client_id')
        .order('created_at', { ascending: false })
        .limit(5);

    if (error) {
        console.error('Error fetching jobs:', error);
        return;
    }

    console.log('Last 5 jobs in DB:');
    if (jobs.length === 0) {
        console.log('No jobs found.');
    } else {
        jobs.forEach(j => {
            console.log(`- [${j.created_at}] ${j.code} - ${j.description} (${j.status})`);
        });
    }
}

checkJobs();
