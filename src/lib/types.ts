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
  name: string;
  quantity: number;
  unit: string;
  imageUrl: string;
  date: string;
  status: "Pending" | "Received";
};
