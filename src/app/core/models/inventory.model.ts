export type InventoryCategory = 'eyeglasses' | 'sunglasses' | 'lens' | 'contact_lens' | 'accessory';
export type InventoryGender = 'men' | 'women' | 'unisex' | 'kids';

export interface InventoryItem {
  _id: string;
  name: string;
  brand?: string;
  category: InventoryCategory;
  frameType?: string;
  gender: InventoryGender;
  price: number;
  stock: number;
  sku?: string;
  imageUrl?: string;
  description?: string;
  isActive: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export type InventoryFormValue = Omit<InventoryItem, '_id' | 'createdAt' | 'updatedAt'>;
