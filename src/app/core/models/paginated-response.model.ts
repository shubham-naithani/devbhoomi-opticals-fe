export interface PaginatedResponse<T> {
  total: number;
  page: number;
  pages: number;
  items?: T[];
  users?: T[];
}
