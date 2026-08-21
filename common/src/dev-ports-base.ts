export enum DevService {
  Server = "server",
  Frontend = "frontend",
  Admin = "admin",
  Mobile = "mobile",
}

export const BASE_PORTS = {
  [DevService.Server]: 3005,
  [DevService.Frontend]: 5173,
  [DevService.Admin]: 5174,
  [DevService.Mobile]: 8085,
} as const satisfies Record<DevService, number>;

/** Slot n takes every base port plus n * PORT_SLOT_STRIDE; the main checkout is slot 0. */
export const PORT_SLOT_STRIDE = 100;
export const MAX_PORT_SLOT = 12;
