import { supabase } from './supabase';
import { InventoryItem, User } from './mock-data';

// Helper for timeouts
export const fetchWithTimeout = async <T>(promise: PromiseLike<T>, ms: number = 5000): Promise<T> => {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            reject(new Error("Request timed out"));
        }, ms);

        promise.then(
            (res) => {
                clearTimeout(timeoutId);
                resolve(res);
            },
            (err) => {
                clearTimeout(timeoutId);
                reject(err);
            }
        );
    });
};

export type { InventoryItem, User };

export interface Brand {
  id: string;
  name: string;
}

export interface ItemType {
  id: string;
  name: string;
}

export interface Unit {
  id: string;
  name: string;
}

// Interfaces for new entities
export interface Client {
  id: string;
  name: string;
  vatNumber: string;
  // Address fields
  street: string;
  streetNumber: string;
  postalCode: string;
  city: string;
  province: string;
  // Display helper
  address?: string; // Constructed full address
  
  email: string;
  phone: string;
  createdAt?: string;
}

export interface Job {
  id: string;
  clientId: string;
  clientName?: string; // For display
  clientAddress?: string; // For display
  code: string;
  description: string;
  status: 'active' | 'completed' | 'suspended';
  startDate: string;
  endDate: string;
  createdAt?: string;
  // New fields
  siteAddress?: string;
  siteManager?: string;
  cig?: string;
  cup?: string;
}

export interface Movement {
  id: string;
  itemId: string;
  userId?: string;
  userName?: string; // For display
  type: 'load' | 'unload' | 'purchase' | 'entry' | 'exit' | 'sale';
  quantity: number;
  reference: string;
  notes?: string;
  date: string;
  jobId?: string;
  jobCode?: string; // For display
  jobDescription?: string; // For display
  itemName?: string; // For display
  itemCode?: string; // For display
  itemUnit?: string; // For display
  itemPrice?: number; // For display
  pieces?: number;
  coefficient?: number;
  isFictitious?: boolean;
  purchaseId?: string;
  purchaseNumber?: string;
  purchaseDate?: string;
  supplierName?: string;
  deliveryNoteId?: string;
}

export interface StockMovement {
  id: string;
  date: string;
  type: 'purchase' | 'entry' | 'exit' | 'sale';
  quantity: number;
  reference: string;
  itemId: string;
  userId?: string;
  userName?: string;
  pieces?: number;
  coefficient?: number;
  notes?: string;
}

export interface JobLog {
  id: string;
  jobId: string;
  userId: string;
  userName?: string;
  date: string;
  content: string;
  weatherInfo?: {
    condition: string;
    tempMax: string;
    tempMin: string;
  };
  tags: string[];
  createdAt: string;
}

export interface JobDocument {
  id: string;
  jobId: string;
  name: string;
  fileUrl: string;
  fileType: string;
  category: string;
  uploadedBy: string;
  uploadedByName?: string;
  createdAt: string;
}

// Mappa i tipi dal DB al Frontend
export interface Supplier {
  id: string;
  name: string;
  vatNumber?: string;
  email?: string;
  phone?: string;
  address?: string;
  createdAt: string;
}

export interface Purchase {
  id: string;
  supplierId: string;
  supplierName?: string;
  deliveryNoteNumber: string;
  deliveryNoteDate: string;
  status: 'draft' | 'completed';
  notes?: string;
  createdBy?: string;
  createdByName?: string;
  createdAt: string;
  items?: { price: number }[];
  jobId?: string;
  jobCode?: string; // Display
}

export interface PurchaseItem {
  id: string;
  purchaseId: string;
  itemId: string;
  itemName?: string; // Display
  itemCode?: string; // Display
  quantity: number;
  pieces?: number;
  coefficient?: number;
  price: number;
  jobId?: string;
  jobCode?: string; // Display
  createdAt: string;
}

const mapDbToSupplier = (db: any): Supplier => ({
  id: db.id,
  name: db.name,
  vatNumber: db.vat_number,
  email: db.email,
  phone: db.phone,
  address: db.address,
  createdAt: db.created_at
});

const mapSupplierToDb = (supplier: Partial<Supplier>) => ({
  name: supplier.name,
  vat_number: supplier.vatNumber,
  email: supplier.email,
  phone: supplier.phone,
  address: supplier.address
});

const mapDbToPurchase = (db: any): Purchase => ({
  id: db.id,
  supplierId: db.supplier_id,
  supplierName: db.suppliers?.name,
  deliveryNoteNumber: db.delivery_note_number,
  deliveryNoteDate: db.delivery_note_date,
  status: db.status,
  notes: db.notes,
  createdBy: db.created_by,
  createdByName: db.profiles?.full_name,
  createdAt: db.created_at,
  items: db.purchase_items,
  jobId: db.job_id,
  jobCode: db.jobs?.code
});

const mapPurchaseToDb = (purchase: Partial<Purchase>) => ({
  supplier_id: purchase.supplierId,
  delivery_note_number: purchase.deliveryNoteNumber,
  delivery_note_date: purchase.deliveryNoteDate,
  status: purchase.status,
  notes: purchase.notes,
  created_by: purchase.createdBy,
  job_id: purchase.jobId || null
});

// --- Suppliers API ---
export const suppliersApi = {
  getAll: async () => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('suppliers')
        .select('*')
        .order('name')
    );
    if (error) throw error;
    return data.map(mapDbToSupplier);
  },
  getById: async (id: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase.from('suppliers').select('*').eq('id', id).single()
    );
    if (error) throw error;
    return mapDbToSupplier(data);
  },
  create: async (supplier: Partial<Supplier>) => {
    const { data, error } = await supabase.from('suppliers').insert(mapSupplierToDb(supplier)).select().single();
    if (error) throw error;
    return mapDbToSupplier(data);
  },
  update: async (id: string, supplier: Partial<Supplier>) => {
    const { data, error } = await supabase.from('suppliers').update(mapSupplierToDb(supplier)).eq('id', id).select().single();
    if (error) throw error;
    return mapDbToSupplier(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('suppliers').delete().eq('id', id);
    if (error) throw error;
  }
};

// --- Purchases API ---
export const purchasesApi = {
  getAll: async () => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('purchases')
        .select('*, suppliers(name), purchase_items(price)')
        .order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data.map(mapDbToPurchase);
  },
  getById: async (id: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('purchases')
        .select('*, suppliers(name)')
        .eq('id', id)
        .single()
    );
    if (error) throw error;
    return mapDbToPurchase(data);
  },
  create: async (purchase: Partial<Purchase>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");

    const dbPurchase = mapPurchaseToDb({ ...purchase, createdBy: user.id });
    
    const { data, error } = await supabase.from('purchases').insert(dbPurchase).select('*, suppliers(name)').single();
    if (error) throw error;
    return mapDbToPurchase(data);
  },
  update: async (id: string, purchase: Partial<Purchase>) => {
    const dbPurchase = mapPurchaseToDb(purchase);
    
    const { data, error } = await supabase.from('purchases').update(dbPurchase).eq('id', id).select('*, suppliers(name)').single();
    if (error) throw error;
    return mapDbToPurchase(data);
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('purchases').delete().eq('id', id);
    if (error) throw error;
  },
  // Items management
  getItems: async (purchaseId: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('purchase_items')
        .select('*, inventory(name, code), jobs(code)')
        .eq('purchase_id', purchaseId)
    );
      
    if (error) throw error;
    return data.map((item: any) => ({
      id: item.id,
      purchaseId: item.purchase_id,
      itemId: item.item_id,
      itemName: item.inventory?.name,
      itemCode: item.inventory?.code,
      quantity: item.quantity,
      pieces: item.pieces,
      coefficient: item.coefficient,
      price: item.price,
      jobId: item.job_id,
      jobCode: item.jobs?.code,
      createdAt: item.created_at
    }));
  },
  addItem: async (item: Partial<PurchaseItem>) => {
    const dbItem = {
      purchase_id: item.purchaseId,
      item_id: item.itemId,
      quantity: item.quantity,
      pieces: item.pieces,
      coefficient: item.coefficient,
      price: item.price,
      job_id: item.jobId
    };
    const { data, error } = await supabase.from('purchase_items').insert(dbItem).select().single();
    if (error) throw error;
    return data;
  },
  updateItem: async (id: string, item: Partial<PurchaseItem>) => {
    const dbItem: any = {};
    if (item.quantity !== undefined) dbItem.quantity = item.quantity;
    if (item.pieces !== undefined) dbItem.pieces = item.pieces;
    if (item.price !== undefined) dbItem.price = item.price;
    if (item.jobId !== undefined) dbItem.job_id = item.jobId;
    
    const { data, error } = await supabase.from('purchase_items').update(dbItem).eq('id', id).select().single();
    if (error) throw error;
    return data;
  },
  deleteItem: async (id: string) => {
    const { error } = await supabase.from('purchase_items').delete().eq('id', id);
    if (error) throw error;
  }
};

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
  coefficient: dbItem.coefficient,
  pieces: dbItem.pieces,
  supplierCode: dbItem.supplier_code
});

export const mapDbProfileToUser = (profile: any): User => {
  const role = (profile.role || 'user') as 'admin' | 'user' | 'operativo';
  let avatarFile = 'user.png';
  
  if (role === 'admin') avatarFile = 'admin.png';
  else if (role === 'operativo') avatarFile = 'operativo.png';
  
  return {
    id: profile.id,
    name: profile.full_name || profile.email?.split('@')[0] || 'Utente',
    email: profile.email || '',
    role: role,
    // Use role-based avatar instead of user uploaded one
    avatar: `/avatars/${avatarFile}`, 
    status: 'active', // Default value as it's not in profiles table
    lastLogin: profile.updated_at // Using updated_at as proxy for now
  };
};

// Mapping functions for new entities
const mapDbToClient = (db: any): Client => {
  // Try to parse address if it's stored as JSON or composite string, 
  // but for now we'll handle the flat structure or provide defaults
  // Assuming the DB still has a single 'address' column for legacy/simplicity 
  // OR we need to split it.
  
  // Since we updated the interface but maybe not the DB schema yet, 
  // let's be safe.
  
  return {
    id: db.id,
    name: db.name,
    vatNumber: db.vat_number,
    
    // Map legacy single address field to new fields if needed, 
    // or just use empty strings if columns don't exist yet.
    // Ideally, we should update the DB schema to match.
    // For now, let's assume 'address' in DB maps to 'street' + others or 
    // we use the single field to populate 'address' (display) and fill others with placeholders
    street: db.street || db.address || '',
    streetNumber: db.street_number || '',
    postalCode: db.postal_code || '',
    city: db.city || '',
    province: db.province || '',
    
    address: db.address, // Keep original full string if available
    
    email: db.email,
    phone: db.phone,
    createdAt: db.created_at
  };
};

const mapClientToDb = (client: Partial<Client>) => ({
  name: client.name,
  vat_number: client.vatNumber,
  street: client.street,
  street_number: client.streetNumber,
  postal_code: client.postalCode,
  city: client.city,
  province: client.province,
  // Also populate address for backward compatibility if needed, or remove if not
  address: client.address || `${client.street || ''} ${client.streetNumber || ''}, ${client.postalCode || ''} ${client.city || ''} ${client.province ? '(' + client.province + ')' : ''}`.trim().replace(/^,/, '').trim(),
  email: client.email,
  phone: client.phone
});

const mapDbToJob = (db: any): Job => ({
  id: db.id,
  clientId: db.client_id,
  clientName: db.clients?.name,
  clientAddress: db.clients?.address || [
      db.clients?.street ? `${db.clients.street} ${db.clients.street_number || ''}` : '',
      db.clients?.postal_code,
      db.clients?.city,
      db.clients?.province ? `(${db.clients.province})` : ''
  ].filter(Boolean).join(' - '),
  code: db.code,
  description: db.description,
  status: db.status,
  startDate: db.start_date,
  endDate: db.end_date,
  createdAt: db.created_at,
  // New fields
  siteAddress: db.site_address,
  siteManager: db.site_manager,
  cig: db.cig,
  cup: db.cup
});

const mapJobToDb = (job: Partial<Job>) => ({
  client_id: job.clientId,
  code: job.code,
  description: job.description,
  status: job.status,
  start_date: job.startDate,
  end_date: job.endDate || null, // Handle empty string for date
  // New fields
  site_address: job.siteAddress,
  site_manager: job.siteManager,
  cig: job.cig,
  cup: job.cup
});

const mapDbToJobLog = (db: any): JobLog => ({
  id: db.id,
  jobId: db.job_id,
  userId: db.user_id,
  userName: db.profiles?.full_name,
  date: db.date,
  content: db.content,
  weatherInfo: db.weather_info,
  tags: db.tags || [],
  createdAt: db.created_at
});

const mapJobLogToDb = (log: Partial<JobLog>) => ({
  job_id: log.jobId,
  user_id: log.userId,
  date: log.date,
  content: log.content,
  weather_info: log.weatherInfo,
  tags: log.tags
});

const mapDbToJobDocument = (db: any): JobDocument => ({
  id: db.id,
  jobId: db.job_id,
  name: db.name,
  fileUrl: db.file_url,
  fileType: db.file_type,
  category: db.category,
  uploadedBy: db.uploaded_by,
  uploadedByName: db.profiles?.full_name,
  createdAt: db.created_at
});

const mapJobDocumentToDb = (doc: Partial<JobDocument>) => ({
  job_id: doc.jobId,
  name: doc.name,
  file_url: doc.fileUrl,
  file_type: doc.fileType,
  category: doc.category,
  uploaded_by: doc.uploadedBy
});

const mapDbToMovement = (db: any): Movement => ({
  id: db.id,
  itemId: db.item_id,
  userId: db.user_id,
  userName: db.profiles?.full_name || 'Utente',
  type: db.type,
  quantity: db.quantity,
  reference: db.reference,
  notes: db.notes,
  date: db.created_at,
  jobId: db.job_id,
  jobCode: db.jobs?.code,
  jobDescription: db.jobs?.description
});

export interface Site {
  id: string;
  name: string;
  address?: string;
  manager?: string;
  jobId: string;
  jobDescription: string;
  status: string;
}

const mapJobToSite = (job: Job): Site => ({
  id: job.id,
  name: job.description, // Using description as site name for now
  address: job.siteAddress,
  manager: job.siteManager,
  jobId: job.id,
  jobDescription: job.description,
  status: job.status
});

// --- Sites API (Derived from Jobs) ---
export const sitesApi = {
  getAll: async () => {
    const jobs = await jobsApi.getAll();
    return jobs.map(mapJobToSite);
  },
  getById: async (id: string) => {
    const job = await jobsApi.getById(id);
    return mapJobToSite(job);
  }
};

const mapMovementToDb = (movement: Partial<Movement>) => ({
  item_id: movement.itemId,
  user_id: movement.userId,
  type: movement.type,
  quantity: movement.quantity,
  reference: movement.reference,
  notes: movement.notes,
  job_id: movement.jobId
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
  coefficient: item.coefficient,
  supplier_code: item.supplierCode,
  real_quantity: item.realQuantity
});

export interface DeliveryNoteItem {
  id: string;
  deliveryNoteId: string;
  inventoryId: string;
  inventoryName?: string;
  inventoryCode?: string;
  inventoryUnit?: string;
  inventoryBrand?: string;
  inventoryCategory?: string;
  inventoryDescription?: string;
  quantity: number;
  pieces?: number;
  coefficient?: number;
  price?: number;
  purchaseItemId?: string; // Link to origin purchase
  isFictitious?: boolean; // If true, only affects job inventory, not main inventory
}

export interface DeliveryNote {
  id: string;
  type: 'entry' | 'exit' | 'sale';
  number: string;
  date: string;
  jobId?: string;
  jobCode?: string;
  causal: string;
  pickupLocation: string;
  deliveryLocation: string;
  transportMean?: string;
  transportTime?: string;
  appearance?: string;
  packagesCount?: number;
  notes?: string;
  items?: DeliveryNoteItem[];
  created_at?: string;
}

const mapDeliveryNoteToDb = (note: Partial<DeliveryNote>) => ({
  type: note.type,
  number: note.number,
  date: note.date,
  job_id: note.jobId,
  causal: note.causal,
  pickup_location: note.pickupLocation,
  delivery_location: note.deliveryLocation,
  transport_mean: note.transportMean,
  transport_time: note.transportTime,
  appearance: note.appearance,
  packages_count: note.packagesCount,
  notes: note.notes
});

const mapDbToDeliveryNote = (db: any): DeliveryNote => ({
  id: db.id,
  type: db.type,
  number: db.number,
  date: db.date,
  jobId: db.job_id,
  jobCode: db.jobs?.code,
  causal: db.causal,
  pickupLocation: db.pickup_location,
  deliveryLocation: db.delivery_location,
  transportMean: db.transport_mean,
  transportTime: db.transport_time,
  appearance: db.appearance,
  packagesCount: db.packages_count,
  notes: db.notes,
  created_at: db.created_at,
  items: db.delivery_note_items?.map((i: any) => ({
    ...i,
    inventoryId: i.inventory_id,
    purchaseItemId: i.purchase_item_id,
    isFictitious: i.is_fictitious,
    inventoryName: i.inventory?.name,
    inventoryCode: i.inventory?.code,
    inventoryUnit: i.inventory?.unit,
    inventoryBrand: i.inventory?.brand,
    inventoryCategory: i.inventory?.category,
    inventoryDescription: i.inventory?.description
  }))
});

export const deliveryNotesApi = {
  getAll: async () => {
    console.time('deliveryNotesApi.getAll');
    try {
      const { data, error } = await fetchWithTimeout<any>(
        supabase
          .from('delivery_notes')
          .select('*, jobs(code, description), delivery_note_items(quantity)')
          .order('date', { ascending: false })
      );

      if (error) {
          // Table doesn't exist yet, return mock data or empty
          console.warn("Delivery notes table not found, returning empty");
          return [];
      }

      return data.map((d: any) => ({
        ...mapDbToDeliveryNote(d),
        itemCount: d.delivery_note_items?.length || 0,
        totalQuantity: d.delivery_note_items?.reduce((sum: number, item: any) => sum + (item.quantity || 0), 0)
      }));
    } finally {
      console.timeEnd('deliveryNotesApi.getAll');
    }
  },
  
  getById: async (id: string) => {
    const { data, error } = await supabase
      .from('delivery_notes')
      .select(`
        *,
        jobs(code, description),
        delivery_note_items(
          *,
          inventory(name, code, unit, brand, category, description)
        )
      `)
      .eq('id', id)
      .single();

    if (error) throw error;
    
    return mapDbToDeliveryNote(data);
  },

  create: async (note: Omit<DeliveryNote, 'id' | 'created_at' | 'items'>, items: Omit<DeliveryNoteItem, 'id' | 'deliveryNoteId'>[]) => {
    console.time('deliveryNotesApi.create');
    try {
      // 1. Create Note
      console.time('insert_note');
      const { data: noteData, error: noteError } = await supabase
        .from('delivery_notes')
        .insert(mapDeliveryNoteToDb(note))
        .select()
        .single();
      console.timeEnd('insert_note');

      if (noteError) {
        console.error("Error creating delivery note:", noteError);
        throw noteError;
    }

      // 2. Create Items
      if (items.length > 0) {
        console.time('insert_items');
        const itemsToInsert = items.map(item => ({
          delivery_note_id: noteData.id,
          inventory_id: item.inventoryId,
          quantity: item.quantity,
          pieces: item.pieces,
          coefficient: item.coefficient,
          price: item.price,
          purchase_item_id: item.purchaseItemId || null,
          is_fictitious: item.isFictitious || false
        }));

        const { error: itemsError } = await supabase
          .from('delivery_note_items')
          .insert(itemsToInsert);
        console.timeEnd('insert_items');

        if (itemsError) throw itemsError;
      }

      return mapDbToDeliveryNote(noteData);
    } finally {
      console.timeEnd('deliveryNotesApi.create');
    }
  },

  update: async (id: string, note: Partial<DeliveryNote>, items?: Omit<DeliveryNoteItem, 'id' | 'deliveryNoteId'>[]) => {
    // Update Note
    const { error: noteError } = await supabase
        .from('delivery_notes')
        .update(mapDeliveryNoteToDb(note))
        .eq('id', id);
    
    if (noteError) throw noteError;

    // Update Items (Delete all and recreate - simplest strategy for now)
    if (items) {
        // Delete existing
        await supabase.from('delivery_note_items').delete().eq('delivery_note_id', id);
        
        // Insert new
        const itemsToInsert = items.map(item => ({
            delivery_note_id: id,
            inventory_id: item.inventoryId,
            quantity: item.quantity,
            pieces: item.pieces,
            coefficient: item.coefficient,
            price: item.price,
            purchase_item_id: item.purchaseItemId || null,
            is_fictitious: item.isFictitious || false
        }));
        
        const { error: itemsError } = await supabase
            .from('delivery_note_items')
            .insert(itemsToInsert);

        if (itemsError) throw itemsError;
    }
  },

  delete: async (id: string) => {
    const { error } = await supabase
      .from('delivery_notes')
      .delete()
      .eq('id', id);
    if (error) throw error;
  }
};

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
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('inventory')
        .select('*')
        .eq('id', id)
        .single()
    );

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

  getHistory: async (itemId: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('stock_movements_view')
        .select('*')
        .eq('item_id', itemId)
        .order('date', { ascending: false })
    );
      
    if (error) throw error;

    return data.map((m: any) => ({
      id: m.id,
      date: m.date,
      type: m.type,
      quantity: m.quantity,
      reference: m.reference,
      itemId: m.item_id,
      userId: m.user_id,
      userName: m.user_name,
      pieces: m.pieces,
      coefficient: m.coefficient,
      notes: m.notes,
      isFictitious: m.is_fictitious
    }));
  },

  // Get available purchase batches for an item (for FIFO/Traceability)
  getAvailableBatches: async (itemId: string) => {
    const { data, error } = await supabase
      .from('purchase_batch_availability')
      .select('*')
      .eq('item_id', itemId)
      .order('purchase_date', { ascending: true }); // FIFO by default
      
    if (error) throw error;
    return data.map((b: any) => ({
        id: b.purchase_item_id,
        purchaseRef: b.purchase_ref,
        date: b.purchase_date,
        originalQty: b.original_quantity,
        remainingQty: b.remaining_quantity,
        originalPieces: b.original_pieces,
        remainingPieces: b.remaining_pieces
    }));
  },

  // Get items currently at a specific job site (for Returns)
  getJobInventory: async (jobId: string) => {
    const { data, error } = await supabase
        .from('job_inventory')
        .select('*, inventory(*)')
        .eq('job_id', jobId)
        .gt('quantity', 0); // Only show items actually there

    if (error) throw error;
    return data.map((i: any) => ({
        itemId: i.item_id,
        quantity: i.quantity,
        item: mapDbItemToInventoryItem(i.inventory)
    }));
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

  updateRole: async (id: string, role: 'admin' | 'user' | 'operativo') => {
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

export const brandsApi = {
  getAll: async () => {
    const { data, error } = await supabase.from('brands').select('*').order('name');
    if (error) throw error;
    return data as Brand[];
  },
  create: async (name: string) => {
    const { data, error } = await supabase.from('brands').insert({ name }).select().single();
    if (error) throw error;
    return data as Brand;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('brands').delete().eq('id', id);
    if (error) throw error;
  }
};

export const itemTypesApi = {
  getAll: async () => {
    const { data, error } = await supabase.from('item_types').select('*').order('name');
    if (error) throw error;
    return data as ItemType[];
  },
  create: async (name: string) => {
    const { data, error } = await supabase.from('item_types').insert({ name }).select().single();
    if (error) throw error;
    return data as ItemType;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('item_types').delete().eq('id', id);
    if (error) throw error;
  }
};

export const unitsApi = {
  getAll: async () => {
    const { data, error } = await supabase.from('units').select('*').order('name');
    if (error) throw error;
    return data as Unit[];
  },
  create: async (name: string) => {
    const { data, error } = await supabase.from('units').insert({ name }).select().single();
    if (error) throw error;
    return data as Unit;
  },
  delete: async (id: string) => {
    const { error } = await supabase.from('units').delete().eq('id', id);
    if (error) throw error;
  }
};

// --- Clients API ---
export const clientsApi = {
  getAll: async () => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('clients')
        .select('*')
        .order('name')
    );
    if (error) throw error;
    return data.map(mapDbToClient);
  },
  getById: async (id: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase.from('clients').select('*').eq('id', id).single()
    );
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
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('jobs')
        .select('*, clients(*)')
        .order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data.map(mapDbToJob);
  },
  getByClientId: async (clientId: string) => {
    console.time('jobsApi.getByClientId');
    try {
      const { data, error } = await fetchWithTimeout(
        supabase
          .from('jobs')
          .select('*, clients(name, address, street, street_number, postal_code, city, province)')
          .eq('client_id', clientId)
          .order('created_at', { ascending: false })
      );

      if (error) throw error;
      return data.map(mapDbToJob);
    } finally {
      console.timeEnd('jobsApi.getByClientId');
    }
  },
  getById: async (id: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase.from('jobs').select('*, clients(*)').eq('id', id).single()
    );
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

// --- Job Logs API ---
export const jobLogsApi = {
  getByJobId: async (jobId: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('job_logs')
        .select('*, profiles:user_id(full_name)')
        .eq('job_id', jobId)
        .order('date', { ascending: false })
    );
    if (error) throw error;
    return data.map(mapDbToJobLog);
  },
  create: async (log: Partial<JobLog>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");

    const { data, error } = await supabase
      .from('job_logs')
      .insert(mapJobLogToDb({ ...log, userId: user.id }))
      .select('*, profiles:user_id(full_name)')
      .single();
    if (error) throw error;
    return mapDbToJobLog(data);
  }
};

// --- Job Documents API ---
export const jobDocumentsApi = {
  getByJobId: async (jobId: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('job_documents')
        .select('*, profiles:uploaded_by(full_name)')
        .eq('job_id', jobId)
        .order('created_at', { ascending: false })
    );
    if (error) throw error;
    return data.map(mapDbToJobDocument);
  },
  create: async (doc: Partial<JobDocument>) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");

    const { data, error } = await supabase
      .from('job_documents')
      .insert(mapJobDocumentToDb({ ...doc, uploadedBy: user.id }))
      .select('*, profiles:uploaded_by(full_name)')
      .single();
    if (error) throw error;
    return mapDbToJobDocument(data);
  }
};

// --- Movements API ---
export const movementsApi = {
  getByItemId: async (itemId: string) => {
    // Join with profiles to get user name and jobs to get job info
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('movements')
        .select(`
          *,
          profiles:user_id(full_name),
          jobs:job_id(code, description)
        `)
        .eq('item_id', itemId)
        .order('created_at', { ascending: false })
    );
      
    if (error) throw error;
    return data.map(mapDbToMovement);
  },

  getByJobId: async (jobId: string) => {
    const { data, error } = await fetchWithTimeout(
      supabase
        .from('stock_movements_view')
        .select('*')
        .eq('job_id', jobId)
        .order('date', { ascending: false })
    );

    if (error) throw error;

    return data.map((db: any) => ({
      id: db.id,
      itemId: db.item_id,
      userId: db.user_id,
      userName: db.user_name,
      type: db.type,
      quantity: db.quantity,
      reference: db.reference,
      notes: db.notes,
      date: db.date,
      jobId: db.job_id,
      itemName: db.item_name,
      itemCode: db.item_code,
      itemUnit: db.item_unit,
      itemPrice: db.item_price || 0,
      isFictitious: db.is_fictitious,
      supplierName: db.supplier_name,
      purchaseDate: db.purchase_date,
      purchaseNumber: db.purchase_number,
      purchaseId: db.purchase_id,
      deliveryNoteId: db.delivery_note_id
    }));
  },
  
  create: async (movement: Partial<Movement>) => {
    // 1. Get current user
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error("Utente non autenticato");
    
    // 2. Prepare movement data
    const dbMovement = mapMovementToDb({
      ...movement,
      userId: user.id
    });
    
    // 3. Insert movement
    const { data, error } = await supabase
      .from('movements')
      .insert(dbMovement)
      .select()
      .single();
      
    if (error) throw error;
    return mapDbToMovement(data);
  }
};
