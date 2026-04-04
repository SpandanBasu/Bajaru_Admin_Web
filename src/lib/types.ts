export type UserProfile = {
  name: string;
  role: string;
  avatarUrl: string;
};

export type ProductAttributes = {
  origin: string;
  shelfLife: string;
  [key: string]: string;
};

export type Product = {
  id: string;
  name: string;
  description: string;
  type: string;
  category: string;
  isVeg: boolean;
  unitWeight: string;
  basePrice: number;
  mrp: number;
  price: number;
  stock: number;
  imageUrls: string[];
  imageUrl: string;
  imageColorValue: number;
  tags: string[];
  rating: number;
  ratingCount: number;
  attributes: ProductAttributes;
  active: boolean;
  createdAt: string;
  updatedAt: string;
  localName: string;
  searchTags: string[];
};

export type ProcurementItem = {
  id: string;
  productId: string;
  name: string;
  neededToday: number;
  unit: string;
  unitWeight: string;
  orderCount: number;
  warehouseId: string;
  status: string;
};
