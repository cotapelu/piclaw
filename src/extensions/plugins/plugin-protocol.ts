/**
 * Plugin Protocol - Message types for main ↔ worker communication
 */

export type RpcRequest = {
  type: 'request';
  id: string;
  method: string;
  params?: any;
};

export type RpcResponse = {
  type: 'response';
  id: string;
  result?: any;
  error?: string;
};

export type RpcEvent = {
  type: 'event';
  event: string;
  payload?: any;
};

export type PluginMessage = RpcRequest | RpcResponse | RpcEvent;

export function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}
