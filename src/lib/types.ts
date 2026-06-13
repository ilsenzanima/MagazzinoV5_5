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
    realPieces?: number;  // Real physical pieces count from inventory
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

export interface Warehouse {
    id: string;
    name: string;
    address?: string;
    isPrimary: boolean;
    createdAt?: string;
    updatedAt?: string;
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
    notes?: string;
    createdAt?: string;
}

// Jobs (Commesse)
export interface Job {
    id: string;
    clientId: string;
    clientName?: string;
    clientAddress?: string;
    code: string;
    name: string;
    description?: string;
    status: 'active' | 'completed' | 'suspended';
    startDate: string;
    endDate: string;
    createdAt?: string;
    siteAddress?: string;
    siteManager?: string;
    cig?: string;
    cup?: string;
    estimatedCost?: number | null;
}

export interface JobSalApprovato {
    id: string;
    jobId: string;
    name: string;
    amount: number;
    date?: string;
    documentUrl?: string;
    notes?: string;
    createdAt: string;
}

export interface JobFatturaCommittente {
    id: string;
    jobId: string;
    name: string;
    amount: number;
    date?: string;
    documentUrl?: string;
    notes?: string;
    createdAt: string;
}

export interface JobSalFatturaLink {
    id: string;
    salId: string;
    fatturaId: string;
    amount: number;
    createdAt: string;
}

export interface JobLog {
    id: string;
    jobId: string;
    userId: string;
    userName?: string;
    date: string;
    content: string;
    isCompleted: boolean;
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
    type: 'load' | 'unload' | 'purchase' | 'entry' | 'exit' | 'sale' | 'waste';
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
    type: 'purchase' | 'entry' | 'exit' | 'sale' | 'waste';
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
    notes?: string;
    createdBy?: string;
    createdByName?: string;
    createdAt: string;
    items?: { price: number; quantity?: number; itemName?: string; itemModel?: string }[];
    orderType?: 'purchase' | 'order';
    price?: number;
    quantity?: number;
    jobId?: string;
    jobCode?: string;
    documentUrl?: string | null;
    documentUrls?: string[];
    totalAmount?: number;
    isExhausted?: boolean;
    invoiceId?: string | null;
    invoiceNumber?: string | null;
    convertedPurchaseId?: string | null;
    convertedPurchaseNumber?: string | null;
    transportCost?: number;
}

// Invoices
export interface Invoice {
    id: string;
    supplierId: string;
    supplierName?: string;
    invoiceNumber: string;
    invoiceDate: string;
    documentUrls?: string[];
    totalAmount?: number;
    notes?: string;
    createdBy?: string;
    createdAt: string;
    purchases?: {
        id: string;
        deliveryNoteNumber: string;
        deliveryNoteDate?: string;
        totalAmount?: number;
        transportCost?: number;
        items?: { id: string; itemName?: string; itemModel?: string; quantity?: number; price?: number; transportApplied?: boolean; transportUnitCost?: number }[];
    }[];
}

export interface PurchaseItem {
    id: string;
    purchaseId: string;
    itemId: string;
    itemName?: string;
    itemModel?: string;
    itemCode?: string;
    itemUnit?: string;
    quantity: number;
    pieces?: number;
    coefficient?: number;
    price: number;
    jobId?: string;
    jobCode?: string;
    createdAt: string;
    transportApplied?: boolean;
    transportUnitCost?: number;
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
    purchaseId?: string;
    isFictitious?: boolean;
    purchaseNumber?: string;
    purchaseDate?: string;
    purchaseSupplier?: string;
    kgEccedenza?: number;
}

export interface DeliveryNote {
    id: string;
    type: 'entry' | 'exit' | 'sale' | 'waste';
    number: string;
    date: string;
    jobId?: string;
    jobCode?: string;
    jobName?: string;
    jobClientName?: string;
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
    itemNames?: string[];
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
    hourlyRate: number;
    trasfertaRate: number;
    createdAt: string;
}

// Worker Courses
export interface WorkerCourse {
    id: string;
    workerId: string;
    courseName: string;
    completionDate: string; // ISO date format
    validityYears: number;
    createdAt?: string;
    updatedAt?: string;
}

// Worker Medical Exams
export interface WorkerMedicalExam {
    id: string;
    workerId: string;
    examDate: string; // ISO date format
    nextExamDate: string; // Typically 6 months after examDate
    doctorName?: string;
    notes?: string;
    createdAt?: string;
    updatedAt?: string;
}

// Attendance
export interface Attendance {
    id: string;
    workerId: string;
    workerName?: string;
    jobId?: string;
    jobCode?: string; // For display
    jobName?: string; // For display
    jobDescription?: string; // For display
    warehouseId?: string;
    warehouseName?: string; // For display
    date: string;
    hours: number;
    status: 'presence' | 'absence' | 'sick' | 'holiday' | 'permit' | 'injury' | 'transfer' | 'course' | 'strike' | 'medical_exam';
    notes?: string;
    courseId?: string; // Reference to worker_courses when status='course'
    courseName?: string; // For display
    hourlyRate?: number;
    trasfertaRate?: number;
    createdAt?: string;
}


export interface AttendanceCorrection {
    id: string;
    workerId: string;
    workerName?: string;
    jobId?: string;
    jobName?: string;
    jobCode?: string;
    warehouseId?: string;
    warehouseName?: string;
    date: string;
    hoursDelta: number;
    createdAt?: string;
}

// Load Notes (Note di Carico)
export interface LoadNoteItem {
    id: string; // generated client-side for list management
    inventoryId: string;
    inventoryName: string;
    inventoryModel?: string;
    inventoryCode?: string;
    inventoryUnit: string;
    quantity: number;
    pieces?: number; // Optional: if using pieces logic
    coefficient?: number;
    notes?: string;
    isChecked?: boolean; // UI state for "taken/processed"
}

export interface LoadNote {
    id: string;
    date: string;
    noteType: 'uscita' | 'reso'; // uscita = material going out, reso = material returning
    jobId?: string;
    jobCode?: string;
    jobDescription?: string;
    items: LoadNoteItem[];
    notes?: string;
    status: 'pending' | 'completed' | 'archived'; // 'pending' = da processare
    createdBy?: string;
    createdByName?: string; // Display name of creator
    createdAt?: string;
}
