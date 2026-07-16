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

// One sellable variant of a product — a specific color/lens-tint/size
// combination, with its own stock, price, SKU, and photos.
export interface Article {
  _id: string;
  sku?: string;
  color?: string;
  lensTint?: string;
  size?: string;
  costPrice?: number;
  price: number;
  stock: number;
  images: string[];
  isActive: boolean;
}

export type ArticleFormValue = Omit<Article, '_id'>;

// The product/model itself — "Ray-Ban Aviator" — shared across every
// article/variant underneath it.
export interface InventoryItem {
  _id: string;
  name: string;
  brand?: string;
  category: InventoryCategory;
  frameType?: string;
  frameShape?: FrameShape;
  gender: InventoryGender;
  description?: string;
  isActive: boolean;
  articles: Article[];
  createdAt?: string;
  updatedAt?: string;
}

export type ProductFormValue = Omit<InventoryItem, '_id' | 'articles' | 'createdAt' | 'updatedAt'>;

// Helpers used across catalog/cart/walk-in-order to summarize a product's
// variants without repeating this logic in every component.
export function activeArticles(item: InventoryItem): Article[] {
  return (item.articles || []).filter((a) => a.isActive);
}

export function inStockArticles(item: InventoryItem): Article[] {
  return activeArticles(item).filter((a) => a.stock > 0);
}

export function priceRange(item: InventoryItem): { min: number; max: number } {
  const prices = activeArticles(item).map((a) => a.price);
  if (prices.length === 0) return { min: 0, max: 0 };
  return { min: Math.min(...prices), max: Math.max(...prices) };
}

export function totalStock(item: InventoryItem): number {
  return activeArticles(item).reduce((sum, a) => sum + a.stock, 0);
}

export function describeArticle(article: Article): string {
  const parts = [article.color, article.lensTint, article.size].filter(Boolean);
  return parts.length > 0 ? parts.join(' / ') : 'Standard';
}
