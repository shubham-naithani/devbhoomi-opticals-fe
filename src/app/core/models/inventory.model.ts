export type InventoryCategory = 'eyeglasses' | 'sunglasses' | 'lens' | 'contact_lens' | 'accessory';
export type InventoryGender = 'men' | 'women' | 'unisex' | 'kids';
export type FrameShape =
  | 'aviator'
  | 'wayfarer'
  | 'round'
  | 'square'
  | 'rectangle'
  | 'cat_eye'
  | 'oval'
  | 'geometric'
  | 'other';

export interface InventoryItem {
  _id: string;
  name: string;
  brand?: string;
  category: InventoryCategory;
  frameType?: string;
  frameShape?: FrameShape;
  gender: InventoryGender;
  costPrice?: number;
  price: number;
  stock: number;
  sku?: string;
  images: string[];
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryFormValue = Omit<InventoryItem, '_id' | 'createdAt' | 'updatedAt'>;
