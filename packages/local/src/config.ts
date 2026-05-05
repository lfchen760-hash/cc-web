import { hostname } from 'node:os';

export const RELAY_URL = process.env.RELAY_URL || 'ws://localhost:3001/ws/local';
export const RELAY_TOKEN = process.env.RELAY_TOKEN || 'dev-token';
export const NODE_ID = process.env.NODE_ID || hostname();
export const NODE_PASSWORD = process.env.NODE_PASSWORD || '';
export const RECONNECT_DELAY = 2000;
export const MAX_RECONNECT_DELAY = 30000;
