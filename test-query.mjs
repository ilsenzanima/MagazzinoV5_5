const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/delivery_notes?select=number,jobs(code,description,name,clients(name))&limit=3';
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

fetch(url, {
  headers: {
    'apikey': key,
    'Authorization': 'Bearer ' + key,
  }
}).then(r => r.json()).then(console.log);
