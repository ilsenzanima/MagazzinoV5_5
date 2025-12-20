import { supabase } from './supabase';
import { InventoryItem, User } from './mock-data';

// Interfaces for new entities
export interface Client {
  id: string;
  name: string;
  vatNumber: string;
  address: string;
  email: string;
  phone: string;
  createdAt?: string;
}

export interface Job {
  id: string;
  clientId: string;
  clientName?: string; // For display
  code: string;
  description: string;
  status: 'active' | 'completed' | 'suspended';
  startDate: string;
  endDate: string;
  createdAt?: string;
}

export interface Site {
  id: string;
  jobId: string;
  jobDescription?: string; // For display
  name: string;
  address: string;
  manager: string;
  status: 'active' | 'inactive' | 'completed';
  createdAt?: string;
}

// Mappa i tipi dal DB al Frontend
export const mapDbItemToInventoryItem = (dbItem: any): InventoryItem => ({
  id: dbItem.id,
  code: dbItem.code,
  name: dbItem.name,
  brand: dbItem.brand,
  type: dbItem.category, // Map category -> type
  quantity: dbItem.quantity,
  minStock: dbItem.min_stock, // Map min_stock -> minStock
  status: dbItem.quantity <= 0 ? 'out_of_stock' : dbItem.quantity <= dbItem.min_stock ? 'low_stock' : 'in_stock',
  image: dbItem.image_url, // Map image_url -> image
  description: dbItem.description,
  price: dbItem.price,
  location: dbItem.location,
  unit: dbItem.unit,
  coefficient: dbItem.coefficient
});

export const mapDbProfileToUser = (profile: any): User => ({
  id: profile.id,
  name: profile.full_name || profile.email?.split('@')[0] || 'Utente',
  email: profile.email || '',
  role: profile.role || 'user',
  avatar: profile.avatar_url,
  status: 'active', // Default value as it's not in profiles table
  lastLogin: profile.updated_at // Using updated_at as proxy for now
});

// Mapping functions for new entities
const mapDbToClient = (db: any): Client => ({
  id: db.id,
  name: db.name,
  vatNumber: db.vat_number,
  address: db.address,
  email: db.email,
  phone: db.phone,
  createdAt: db.created_at
});

const mapClientToDb = (client: Partial<Client>) => ({
  name: client.name,
  vat_number: client.vatNumber,
  address: client.address,
  email: client.email,
  phone: client.phone
});

const mapDbToJob = (db: any): Job => ({
  id: db.id,
  clientId: db.client_id,
  clientName: db.clients?.name,
  code: db.code,
  description: db.description,
  status: db.status,
  startDate: db.start_date,
  endDate: db.end_date,
  createdAt: db.created_at
});

const mapJobToDb = (job: Partial<Job>) => ({
  client_id: job.clientId,
  code: job.code,
  description: job.description,
  status: job.status,
  start_date: job.startDate,
  end_date: job.endDate
});

const mapDbToSite = (db: any): Site => ({
  id: db.id,
  jobId: db.job_id,
  jobDescription: db.jobs?.description,
  name: db.name,
  address: db.address,
  manager: db.manager,
  status: db.status,
  createdAt: db.created_at
});

const mapSiteToDb = (site: Partial<Site>) => ({
  job_id: site.jobId,
  name: site.name,
  address: site.address,
  manager: site.manager,
  status: site.status
});

// Mappa i tipi dal Frontend al DB
export const mapInventoryItemToDbItem = (item: Partial<InventoryItem>) => ({
  code: item.code,
  name: item.name,
  brand: item.brand,
  category: item.type, // Map type -> category
  quantity: item.quantity,
  min_stock: item.minStock, // Map minStock -> min_stock
  image_url: item.image, // Map image -> image_url
  description: item.description,
  price: item.price,
  location: item.location,
  unit: item.unit,
  coefficient: item.coefficient
});

export const inventoryApi = {
  // Fetch all items
  getAll: async () => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(mapDbItemToInventoryItem);
  },

  // Get single item
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('inventory')
      .select('*')
      .eq('id', id)
      .single();

    if (error) throw error;
    return mapDbItemToInventoryItem(data);
  },

  // Create item
  create: async (item: Omit<InventoryItem, 'id' | 'status'>) => {
    const dbItem = mapInventoryItemToDbItem(item);
    const { data, error } = await supabase
      .from('inventory')
      .insert(dbItem)
      .select()
      .single();

    if (error) throw error;
    return mapDbItemToInventoryItem(data);
  },

  // Update item
  update: async (id: string, item: Partial<InventoryItem>) => {
    const dbItem = mapInventoryItemToDbItem(item);
    const { data, error } = await supabase
      .from('inventory')
      .update(dbItem)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapDbItemToInventoryItem(data);
  },

  // Delete item
  delete: async (id: string) => {
    const { error } = await supabase
      .from('inventory')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },

  // Seed database with mock data
  seed: async () => {
    // Check if data already exists
    const { count } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      console.log('Database already seeded');
      return;
    }
    return; 
  }
};

export const usersApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;
    return data.map(mapDbProfileToUser);
  },

  updateRole: async (id: string, role: 'admin' | 'user') => {
    const { data, error } = await supabase
      .from('profiles')
      .update({ role })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return mapDbProfileToUser(data);
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  }
};

// --- Clients API ---
export const clientsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');
    if (error) throw error;
    return data.map(mapDbToClient);
  },
  getById: async (id: string) => {
    const { data, error } = await supabase.from('clients').select('*').eq('id', id).single();
    if (error) throw error;
    return mapDbToClient(data);
  },
  create: async (client: Partial<Client>) => {
    const { data, error } = await supabase.from('clients').insert(mapClientToDb(client)).select().single();
    if (error) throw error;
    return mapDbToClient(data);
  },
  update: async (id: string, client: Partial<Client>) => {
    const { data, error } = await supabase.from('clients').update(mapClientToDb(client)).eq('id', id).select().single();
    if (error) throw error;
    return mapDbToClient(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('clients').delete().eq('id', id);
    if (error) throw error;
  }
};

// --- Jobs API ---
export const jobsApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('jobs')
      .select('*, clients(name)')
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(mapDbToJob);
  },
  getByClientId: async (clientId: string) => {
     const { data, error } = await supabase
      .from('jobs')
      .select('*, clients(name)')
      .eq('client_id', clientId)
      .order('created_at', { ascending: false });
    if (error) throw error;
    return data.map(mapDbToJob);
  },
  getById: async (id: string) => {
    const { data, error } = await supabase.from('jobs').select('*, clients(name)').eq('id', id).single();
    if (error) throw error;
    return mapDbToJob(data);
  },
  create: async (job: Partial<Job>) => {
    const { data, error } = await supabase.from('jobs').insert(mapJobToDb(job)).select().single();
    if (error) throw error;
    return mapDbToJob(data);
  },
  update: async (id: string, job: Partial<Job>) => {
    const { data, error } = await supabase.from('jobs').update(mapJobToDb(job)).eq('id', id).select().single();
    if (error) throw error;
    return mapDbToJob(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('jobs').delete().eq('id', id);
    if (error) throw error;
  }
};

// --- Sites API ---
export const sitesApi = {
  getAll: async () => {
    const { data, error } = await supabase
      .from('sites')
      .select('*, jobs(description)')
      .order('name');
    if (error) throw error;
    return data.map(mapDbToSite);
  },
  getById: async (id: string) => {
    const { data, error } = await supabase.from('sites').select('*, jobs(description)').eq('id', id).single();
    if (error) throw error;
    return mapDbToSite(data);
  },
  create: async (site: Partial<Site>) => {
    const { data, error } = await supabase.from('sites').insert(mapSiteToDb(site)).select().single();
    if (error) throw error;
    return mapDbToSite(data);
  },
  update: async (id: string, site: Partial<Site>) => {
    const { data, error } = await supabase.from('sites').update(mapSiteToDb(site)).eq('id', id).select().single();
    if (error) throw error;
    return mapDbToSite(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('sites').delete().eq('id', id);
    if (error) throw error;
  }
};
