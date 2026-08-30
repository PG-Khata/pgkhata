export interface User {
  id: string
  name: string
  email: string
  image?: string
}

export interface OwnerProfile {
  id: string
  userId: string
  phone?: string
  createdAt: string
  updatedAt: string
}

export interface Property {
  id: string
  ownerId: string
  name: string
  address?: string
  city?: string
  state?: string
  pincode?: string
  electricityMode: "flat" | "meter"
  electricityRatePerUnit?: number
  signupToken?: string
  complaintToken?: string
  createdAt: string
  updatedAt: string
}

export interface Floor {
  id: string
  propertyId: string
  name: string
  position: number
  createdAt: string
  updatedAt: string
}

export interface FloorWithRoomCount {
  floor: Floor
  roomCount: number
}

export interface Room {
  id: string
  propertyId: string
  floorId?: string | null
  number: string
  type: "single" | "double" | "triple" | "dormitory"
  capacity: number
  monthlyRent: number
  createdAt: string
  updatedAt: string
  /** Joined from the room's floor; null when unassigned. */
  floorName?: string | null
  floorPosition?: number | null
}

export interface Tenant {
  id: string
  propertyId: string
  roomId?: string
  name: string
  email?: string
  phone: string
  status: "active" | "vacating" | "vacated"
  joiningDate: string
  vacatingDate?: string
  monthlyRentOverride?: number
  deposit?: number
  notes?: string
  createdAt: string
  updatedAt: string
}

export interface Bill {
  id: string
  tenantId: string
  billMonth: string
  rentAmount: number
  electricityAmount: number
  totalAmount: number
  paidAmount: number
  balance: number
  status: "pending" | "partial" | "paid" | "overdue"
  dueDate?: string
  approved: boolean
  createdAt: string
  updatedAt: string
}

export interface Payment {
  id: string
  billId: string
  amount: number
  paymentDate: string
  method?: "cash" | "upi" | "bank_transfer" | "other"
  notes?: string
  createdAt: string
}

export interface ElectricityReading {
  id: string
  roomId: string
  reading: number
  units: number
  readingDate: string
  createdAt: string
}

export interface Complaint {
  id: string
  propertyId: string
  subject: string
  description: string
  roomNumber?: string
  status: "open" | "in_progress" | "resolved"
  createdAt: string
  updatedAt: string
}

export interface OwnerDashboard {
  totalProperties: number
  totalRooms: number
  totalTenants: number
  occupancyRate: number
  monthlyCollection: number
  pendingRent: number
  overdueRent: number
}

export interface PropertyDashboard {
  property: Property
  totalRooms: number
  activeTenants: number
  occupancyRate: number
  monthlyBilled: number
  monthlyCollected: number
  monthlyPending: number
}

export interface BillWithDetails {
  bill: Bill
  tenantName: string
  roomNumber: string
}

export interface PaymentWithDetails {
  payment: Payment
  tenantName: string
  billMonth: string
}

export interface SubscriptionPlan {
  id: string
  name: string
  price: number
  maxProperties: number
  maxRooms: number
  features: string[]
}
