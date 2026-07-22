export interface ErrorLog {
  _id: string;
  source: 'backend' | 'frontend';
  severity: 'critical' | 'warning';
  message: string;
  stack?: string;
  route?: string;
  method?: string;
  statusCode?: number;
  userName?: string;
  createdAt: string;
}
