export interface AuditLogEntry {
  _id: string;
  entityType: 'Order' | 'Inventory' | 'User' | 'EyeTest';
  entityId: string;
  action: 'create' | 'update' | 'delete';
  performedByName: string;
  summary: string;
  createdAt: string;
}
