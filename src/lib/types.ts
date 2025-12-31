// Core Entities Definitions

// Auth & Users
export interface User {
    id: string;
    name: string;
    email: string;
    role: 'admin' | 'user' | 'operativo';
    avatar?: string;
    status: 'active' | 'inactive';
    lastLogin?: string;
}

// Inventory
export interface InventoryItem {
    id: string;
    code: string;
    name: string;
    brand: string;
    type: string;
    quantity: number;
    minStock: number;
    status?: 'in_stock' | 'low_stock' | 'out_of_stock';
    image?: string;
    description?: string;
    price?: number;
    location?: string;
    unit: string;
    coefficient: number;
    pieces?: number;
    supplierCode?: string;
    realQuantity?: number | null;
    model?: string;
}

export interface Brand {
    id: string;
    name: string;
}

export interface ItemType {
    id: string;
    name: string;
    imageUrl?: string;
}

export interface Unit {
    id: string;
    name: string;
}

export interface InventorySupplierCode {
    id: string;
    inventoryId: string;
    code: string;
    supplierId?: string;
    supplierName?: string;
    note?: string;
    createdAt: string;
}

// Partners (Suppliers & Clients)
export interface Supplier {
    id: string;
    name: string;
    vatNumber?: string;
    email?: string;
    phone?: string;
    address?: string;
    createdAt: string;
}

export interface Client {
    id: string;
    name: string;
    vatNumber: string;
    street: string;
    streetNumber: string;
    postalCode: string;
    city: string;
    province: string;
    address?: string;
    email: string;
    phone: string;
    createdAt?: string;
}

// Jobs (Commesse)
export interface Job {
    id: string;
    clientId: string;
    clientName?: string;
    clientAddress?: string;
    code: string;
    description: string;
    status: 'active' | 'completed' | 'suspended';
    startDate: string;
    endDate: string;
    createdAt?: string;
    siteAddress?: string;
    siteManager?: string;
    cig?: string;
    cup?: string;
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
    condition: string;
    tempMax: string;
    tempMin: string;
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

// Movements & Stock
export interface Movement {
    id: string;
    itemId: string;
    userId?: string;
    userName?: string;
    type: 'load' | 'unload' | 'purchase' | 'entry' | 'exit' | 'sale';
    quantity: number;
    reference: string;
    notes?: string;
    date: string;
    jobId?: string;
    jobCode?: string;
    jobDescription?: string;
    itemModel?: string;
    itemName?: string;
    itemCode?: string;
    itemUnit?: string;
    itemPrice?: number;
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

// Purchases
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
    items?: { price: number; quantity?: number }[];
    price?: number;
    quantity?: number;
    jobId?: string;
    jobCode?: string;
    documentUrl?: string | null;
    totalAmount?: number;
}

export interface PurchaseItem {
    id: string;
    purchaseId: string;
    itemId: string;
    itemName?: string;
    itemModel?: string;
    itemCode?: string;
    quantity: number;
    pieces?: number;
    coefficient?: number;
    price: number;
    jobId?: string;
    jobCode?: string;
    createdAt: string;
}

// Delivery Notes (DDT)
export interface DeliveryNoteItem {
    id: string;
    deliveryNoteId: string;
    inventoryId: string;
    inventoryName?: string;
    inventoryModel?: string;
    inventoryCode?: string;
    inventoryUnit?: string;
    inventoryBrand?: string;
    inventoryCategory?: string;
    inventoryDescription?: string;
    quantity: number;
    pieces?: number;
    coefficient?: number;
    price?: number;
    purchaseItemId?: string;
    isFictitious?: boolean;
}

export interface DeliveryNote {
    id: string;
    type: 'entry' | 'exit' | 'sale';
    number: string;
    date: string;
    jobId?: string;
    jobCode?: string;
    jobDescription?: string;
    jobAddress?: string;
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
    itemCount?: number;
    totalQuantity?: number;
}

// Sites (derived from Jobs)
export interface Site {
    id: string;
    name: string;
    address?: string;
    manager?: string;
    jobId: string;
    jobDescription: string;
    status: string;
}

// Workers
export interface Worker {
    id: string;
    firstName: string;
    lastName: string;
    email: string;
    isActive: boolean;
    createdAt: string;
}

// Attendance
export interface Attendance {
    id: string;
    workerId: string;
    workerName?: string;
    jobId?: string;
    jobCode?: string; // For display
    jobDescription?: string; // For display
    date: string;
    hours: number;
    status: 'presence' | 'absence' | 'sick' | 'holiday' | 'permit' | 'injury' | 'transfer' | 'course' | 'strike';
    notes?: string;
    createdAt?: string;
}
