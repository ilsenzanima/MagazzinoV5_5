import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET() {
  console.log(`[Health Check] Ping received at ${new Date().toISOString()}`);
  try {
    const supabase = await createClient();
    
    // Lightweight query to keep DB awake
    const { error } = await supabase.from('inventory').select('id').limit(1);
    
    if (error) {
      return NextResponse.json({ status: 'error', message: error.message }, { status: 500 });
    }
    
    return NextResponse.json({ status: 'ok', timestamp: new Date().toISOString() });
  } catch (error) {
    return NextResponse.json({ status: 'error', message: 'Internal Server Error' }, { status: 500 });
  }
}
