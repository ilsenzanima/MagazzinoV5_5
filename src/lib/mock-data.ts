import { InventoryItem, Movement, User } from './types';
export type { InventoryItem, Movement, User };

// Movement interface imported from ./types

// Deprecated: Use brandsApi.getAll()
export const mockBrands = [
  "Makita", "Bosch", "Stanley", "Beta", "Wurth", "3M", "DeWalt", "Hilti", "Usag"
];

// Deprecated: Use itemTypesApi.getAll()
export const mockTypes = [
  "Elettroutensili", "Utensili Manuali", "Ferramenta", "DPI", "Materiale Elettrico", "Idraulica", "Consumabili"
];

// Deprecated: Use unitsApi.getAll()
export const mockUnits = ['PZ', 'ML', 'MQ', 'KG', 'L'];

export const mockMovements: Movement[] = [
  { id: 'm1', itemId: '1', date: '2023-12-01', type: 'load', quantity: 20, reference: 'BOL-2023-001' },
  { id: 'm2', itemId: '1', date: '2023-12-10', type: 'unload', quantity: 5, reference: 'ORD-123' },
  { id: 'm3', itemId: '2', date: '2023-11-20', type: 'load', quantity: 10, reference: 'BOL-2023-002' },
  { id: 'm4', itemId: '2', date: '2023-12-15', type: 'unload', quantity: 6, reference: 'ORD-125' },
];

// User interface imported from ./types

export const mockUsers: User[] = [
  { id: '1', name: 'Mario Rossi', email: 'admin@magazzino.it', role: 'admin', status: 'active', lastLogin: '2023-12-20 10:30' },
  { id: '2', name: 'Luigi Verdi', email: 'magazziniere@magazzino.it', role: 'user', status: 'active', lastLogin: '2023-12-19 14:15' },
  { id: '3', name: 'Giulia Bianchi', email: 'ufficio@magazzino.it', role: 'user', status: 'inactive', lastLogin: '2023-11-05 09:00' },
];

export const mockInventoryItems: InventoryItem[] = [
  {
    id: '1',
    code: 'PPA-E12X8',
    name: 'Trapano Avvitatore 18V',
    brand: 'Makita',
    type: 'Elettroutensili',
    quantity: 15,
    minStock: 5,
    status: 'in_stock',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80',
    description: 'Trapano avvitatore professionale con percussione, 2 batterie incluse.',
    price: 189.99,
    location: 'A-12-3',
    unit: 'PZ',
    coefficient: 1.0
  },
  {
    id: '2',
    code: 'PPA-E99Z1',
    name: 'Set Cacciaviti 6pz',
    brand: 'Beta',
    type: 'Utensili Manuali',
    quantity: 4,
    minStock: 10,
    status: 'low_stock',
    description: 'Set di 6 cacciaviti professionali a taglio e croce.',
    price: 24.50,
    location: 'B-05-1',
    unit: 'PZ',
    coefficient: 1.0
  },
  {
    id: '3',
    code: 'PPA-E00A2',
    name: 'Nastro Isolante Nero',
    brand: '3M',
    type: 'Materiale Elettrico',
    quantity: 0,
    minStock: 20,
    status: 'out_of_stock',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
    description: 'Nastro isolante in PVC, rotolo da 25m.',
    price: 2.99,
    location: 'C-01-4',
    unit: 'ML',
    coefficient: 25.0
  },
  {
    id: '4',
    code: 'PPA-E77K3',
    name: 'Martello da Carpentiere',
    brand: 'Stanley',
    type: 'Utensili Manuali',
    quantity: 12,
    minStock: 5,
    status: 'in_stock',
    description: 'Martello con manico in fibra di vetro antivibrazione.',
    price: 18.90,
    location: 'B-05-2',
    unit: 'PZ',
    coefficient: 1.0
  },
  {
    id: '5',
    code: 'PPA-E33J4',
    name: 'Smerigliatrice Angolare',
    brand: 'Bosch',
    type: 'Elettroutensili',
    quantity: 3,
    minStock: 4,
    status: 'low_stock',
    image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80',
    description: 'Smerigliatrice 125mm, 900W.',
    price: 89.00,
    location: 'A-13-1',
    unit: 'PZ',
    coefficient: 1.0
  },
];
