import { AsyncLocalStorage } from 'node:async_hooks';

export interface RequestContext {
  requestId: string;
  method: string;
  url: string;
  userId?: number;
}

export const requestContext = new AsyncLocalStorage<RequestContext>();
