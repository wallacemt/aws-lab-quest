import { AsyncLocalStorage } from "node:async_hooks";

export type McpPrincipal = {
  userId: string;
  email: string;
  scopes: string[];
  tokenId: string;
};

export type AdminRequestContext = {
  requestId: string;
  principal?: McpPrincipal;
  actor?: { userId: string; email: string };
};

const storage = new AsyncLocalStorage<AdminRequestContext>();

export function runInAdminContext<T>(context: AdminRequestContext, fn: () => T): T {
  return storage.run(context, fn);
}

export function getAdminRequestContext(): AdminRequestContext | undefined {
  return storage.getStore();
}
