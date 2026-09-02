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
  code?: string
  address?: string
  landmark?: string
  city?: string
  state?: string
  pincode?: string
  latitude?: string
  longitude?: string
  description?: string
  electricityMode: "flat" | "meter"
  electricityRatePerUnit?: number
  signupToken?: string
  complaintToken?: string
  createdAt: string
  updatedAt: string
  totalBeds?: number
  occupiedBeds?: number
}

export interface Floor {
  id: string
  propertyId: string
  name: string
  position: number
  description?: string
  createdAt: string
  updatedAt: string
}

export interface FloorWithRoomCount {
  floor: Floor
  roomCount: number
}

export interface Bed {
  id: string
  roomId: string
  number: string
  status: "vacant" | "occupied" | "maintenance"
  monthlyRent?: number | null
  createdAt: string
  updatedAt: string
}

export interface BedWithLocation {
  bed: Bed
  roomId: string
  roomNumber: string
  roomRent?: number
  floorName?: string | null
}

export interface AdvancePayment {
  id: string
  tenantId: string
  amount: number
  date: string
  status: "available" | "applied" | "forfeited"
  appliedAmount: number
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface AdvancePaymentWithTenant {
  advance: AdvancePayment
  tenantName: string
}

export interface SecurityDeposit {
  id: string
  tenantId: string
  propertyId: string
  amount: number
  status: "held" | "partial" | "refunded"
  refundAmount: number
  refundDate?: string | null
  promisedDate?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface SecurityDepositWithTenant {
  deposit: SecurityDeposit
  tenantName: string
}

export interface DepositLiabilityReport {
  totalHeld: number
  totalRefunded: number
  netLiability: number
}

export interface ExpenseCategory {
  id: string
  propertyId: string
  name: string
  createdAt: string
  updatedAt: string
}

export interface Expense {
  id: string
  propertyId: string
  categoryId: string
  amount: number
  description: string
  date: string
  status: "pending" | "approved" | "rejected"
  approvedBy?: string | null
  approvedAt?: string | null
  notes?: string | null
  createdAt: string
  updatedAt: string
}

export interface ExpenseWithCategory {
  expense: Expense
  categoryName: string
}

export interface ExpenseCategorySummary {
  categoryId: string
  categoryName: string
  total: number
  count: number
}

export interface ExpenseMonthSummary {
  month: string
  total: number
  count: number
}

export interface ExpenseSummary {
  total: number
  pendingTotal: number
  byCategory: ExpenseCategorySummary[]
  byMonth: ExpenseMonthSummary[]
}

export interface ChargeType {
  id: string
  propertyId: string
  name: string
  code: string
  defaultAmount: number
  isRecurring: boolean
  isActive: boolean
  createdAt: string
  updatedAt: string
}

export interface RentPlan {
  id: string
  propertyId: string
  name: string
  monthlyRent: number
  securityDeposit?: number | null
  dueDay: number
  lateFeePerDay?: number | null
  isActive: boolean
  minStayMonths?: number | null
  noticePeriodDays?: number | null
  description?: string | null
  createdAt: string
  updatedAt: string
}

export interface RentPlanWithRoomCount {
  plan: RentPlan
  roomCount: number
}

export interface Room {
  id: string
  propertyId: string
  floorId?: string | null
  rentPlanId?: string | null
  number: string
  type: "single" | "double" | "triple" | "dormitory"
  capacity: number
  monthlyRent: number
  createdAt: string
  updatedAt: string
  /** Joined from the room's floor; null when unassigned. */
  floorName?: string | null
  floorPosition?: number | null
  /** Joined from the room's rent plan, if any. */
  planName?: string | null
  planRent?: number | null
  /** Beds belonging to this room, ordered by label. */
  beds?: Bed[]
}

export interface Tenant {
  id: string
  propertyId: string
  roomId?: string | null
  bedId?: string | null
  requestedRoomId?: string | null
  onboardingToken?: string | null
  name: string
  email?: string
  phone: string
  alternatePhone?: string
  gender?: "male" | "female" | "other"
  occupation?: string
  dateOfBirth?: string
  aadhaarNumber?: string
  panNumber?: string
  permanentAddress?: string
  permanentAddressCity?: string
  permanentAddressState?: string
  permanentAddressPincode?: string
  status: "pending" | "active" | "vacating" | "vacated" | "rejected"
  joiningDate: string
  vacatingDate?: string
  monthlyRentOverride?: number
  deposit?: number
  notes?: string
  createdAt: string
  updatedAt: string
  /** Joined from the tenant's bed/room; present on list and detail responses. */
  bedNumber?: string | null
  roomNumber?: string | null
}

export interface BillLineItem {
  code: string
  name: string
  amount: number
  units?: number
  ratePerUnit?: number
}

export interface Bill {
  id: string
  tenantId: string
  billMonth: string
  rentAmount: number
  electricityAmount: number
  lineItems: BillLineItem[]
  totalAmount: number
  paidAmount: number
  balance: number
  status: "pending" | "partial" | "paid" | "overdue"
  dueDate?: string | null
  approved: boolean
  voidedAt?: string | null
  promisedDate?: string | null
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
  totalBeds: number
  occupiedBeds: number
  totalTenants: number
  occupancyRate: number
  monthlyCollection: number
  pendingRent: number
  overdueRent: number
}

export interface PropertyDashboard {
  property: Property
  totalRooms: number
  totalBeds: number
  occupiedBeds: number
  activeTenants: number
  occupancyRate: number
  monthlyBilled: number
  monthlyCollected: number
  monthlyPending: number
  overdueRent: number
}

export interface MonthlyTrendPoint {
  month: string
  collected: number
  expenses: number
}

export interface DueRentRow {
  tenantId: string
  tenantName: string
  roomNumber: string | null
  amountDue: number
  daysOverdue: number
}

export interface AgingBucketSummary {
  bucket: "current" | "0-30" | "31-60" | "61-90" | "90+"
  total: number
  count: number
}

export interface AgingReport {
  buckets: AgingBucketSummary[]
  total: number
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
