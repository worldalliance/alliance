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
/** Keeps every port below 32768, where Linux's ephemeral range starts (macOS: 49152). */
export const MAX_PORT_SLOT = 246;

export function slotPorts(slot: number): Record<DevService, number> {
  return {
    [DevService.Server]: BASE_PORTS.server + slot * PORT_SLOT_STRIDE,
    [DevService.Frontend]: BASE_PORTS.frontend + slot * PORT_SLOT_STRIDE,
    [DevService.Admin]: BASE_PORTS.admin + slot * PORT_SLOT_STRIDE,
    [DevService.Mobile]: BASE_PORTS.mobile + slot * PORT_SLOT_STRIDE,
  };
}
