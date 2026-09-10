export interface AdminUser {
  id: string;
  name: string;
  email: string;
}

export interface AdminOwner {
  owner: {
    id: string;
    userId: string;
    phone: string | null;
    createdAt: string;
    updatedAt: string;
  };
  user: {
    id: string;
    name: string;
    email: string;
  };
  propertyCount?: number;
  tenantCount?: number;
}

export interface AdminProperty {
  id: string;
  ownerId: string;
  name: string;
  code: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  pincode: string | null;
  electricityMode: string;
  createdAt: string;
  updatedAt: string;
  ownerName?: string;
  totalBeds?: number;
  occupiedBeds?: number;
  activeTenants?: number;
}

export interface AdminTenant {
  id: string;
  propertyId: string;
  name: string;
  phone: string;
  email: string | null;
  status: string;
  joiningDate: string;
  bedNumber: string | null;
  roomNumber: string | null;
  propertyName?: string;
  ownerName?: string;
}

export interface AdminBill {
  id: string;
  tenantId: string;
  billMonth: string;
  totalAmount: number;
  paidAmount: number;
  balance: number;
  status: string;
  approved: boolean;
  voidedAt: string | null;
  createdAt: string;
  tenantName?: string;
  propertyName?: string;
}

export interface AdminPayment {
  id: string;
  billId: string;
  amount: number;
  paymentDate: string;
  method: string | null;
  notes: string | null;
  createdAt: string;
  tenantName?: string;
  billMonth?: string;
}

export interface AdminAnalytics {
  totalUsers: number;
  totalOwners: number;
  totalProperties: number;
  activeTenants: number;
}

export interface BlogPost {
  id: string;
  slug: string;
  title: string;
  excerpt: string | null;
  content: string;
  author: string;
  tags: string[];
  coverImage: string | null;
  published: boolean;
  publishedAt: string | null;
  createdAt: string;
  updatedAt: string;
}
