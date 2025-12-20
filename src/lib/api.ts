import { supabase } from './supabase';
import { InventoryItem, mockInventoryItems } from './mock-data';

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
    // Check if empty
    const { count } = await supabase
      .from('inventory')
      .select('*', { count: 'exact', head: true });

    if (count && count > 0) {
      throw new Error("Il database contiene già dei dati. Impossibile eseguire il seed.");
    }

    const dbItems = mockInventoryItems.map(item => {
        // Remove ID to let DB generate UUID
        const { id, status, ...rest } = item; 
        return mapInventoryItemToDbItem(rest as any);
    });

    const { data, error } = await supabase
      .from('inventory')
      .insert(dbItems)
      .select();

    if (error) throw error;
    return data;
  }
};
