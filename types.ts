export interface VirtualIdentity {
  ip: string;
  country: string;
  city: string;
  mac: string;
  userAgentShort: string;
  latency: number;
}

export interface SecurityReport {
  score: number;
  threatLevel: 'Faible' | 'Moyen' | 'Élevé' | 'Critique';
  recommendations: string[];
  analysis: string;
}

export enum ConnectionMode {
  STANDARD = 'Standard',
  STEALTH = 'Furtif',
  DOUBLE_HOP = 'Double Hop'
}

export interface LogEntry {
  id: string;
  timestamp: string;
  event: string;
  type: 'info' | 'warning' | 'success' | 'error';
}