import { R, type Result } from "@alliance/common/result";

export enum UpdateSearchOutcome {
  Downloaded = "downloaded",
  InStore = "inStore",
  None = "none",
  Failed = "failed",
}

export async function searchForNewerVersion(deps: {
  fetchOta: () => Promise<Result<boolean, unknown>>;
  storeHasNewer: () => Promise<Result<boolean, unknown>>;
}): Promise<UpdateSearchOutcome> {
  const ota = await deps.fetchOta();
  if (R.isSuccess(ota) && ota.value) return UpdateSearchOutcome.Downloaded;
  const store = await deps.storeHasNewer();
  if (R.isSuccess(store) && store.value) return UpdateSearchOutcome.InStore;
  return R.isFailure(ota) || R.isFailure(store)
    ? UpdateSearchOutcome.Failed
    : UpdateSearchOutcome.None;
}
