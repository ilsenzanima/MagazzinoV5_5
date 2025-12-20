export interface InventoryItem {
  id: string;
  code: string;
  name: string;
  brand: string;
  type: string;
  quantity: number;
  minStock: number;
  status: 'in_stock' | 'low_stock' | 'out_of_stock';
  image?: string;
  description?: string;
  price?: number;
  location?: string; // Kept for backend compatibility, but maybe hidden in UI
}

export const mockInventoryItems: InventoryItem[] = [
  {
    id: '1',
    code: 'ART-001',
    name: 'Trapano Avvitatore 18V',
    brand: 'Makita',
    type: 'Elettroutensili',
    quantity: 15,
    minStock: 5,
    status: 'in_stock',
    image: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&q=80',
    description: 'Trapano avvitatore professionale con percussione, 2 batterie incluse.',
    price: 189.99,
    location: 'A-12-3'
  },
  {
    id: '2',
    code: 'ART-002',
    name: 'Set Cacciaviti 6pz',
    brand: 'Beta',
    type: 'Utensili Manuali',
    quantity: 4,
    minStock: 10,
    status: 'low_stock',
    // No image to test placeholder
    description: 'Set di 6 cacciaviti professionali a taglio e croce.',
    price: 24.50,
    location: 'B-05-1'
  },
  {
    id: '3',
    code: 'ART-003',
    name: 'Nastro Isolante Nero',
    brand: '3M',
    type: 'Materiale Elettrico',
    quantity: 0,
    minStock: 20,
    status: 'out_of_stock',
    image: 'https://images.unsplash.com/photo-1621905251189-08b45d6a269e?w=800&q=80',
    description: 'Nastro isolante in PVC, rotolo da 25m.',
    price: 2.99,
    location: 'C-01-4'
  },
  {
    id: '4',
    code: 'ART-004',
    name: 'Martello da Carpentiere',
    brand: 'Stanley',
    type: 'Utensili Manuali',
    quantity: 12,
    minStock: 5,
    status: 'in_stock',
    description: 'Martello con manico in fibra di vetro antivibrazione.',
    price: 18.90,
    location: 'B-05-2'
  },
  {
    id: '5',
    code: 'ART-005',
    name: 'Smerigliatrice Angolare',
    brand: 'Bosch',
    type: 'Elettroutensili',
    quantity: 3,
    minStock: 4,
    status: 'low_stock',
    image: 'https://images.unsplash.com/photo-1572981779307-38b8cabb2407?w=800&q=80',
    description: 'Smerigliatrice 125mm, 900W.',
    price: 89.00,
    location: 'A-13-1'
  },
];
