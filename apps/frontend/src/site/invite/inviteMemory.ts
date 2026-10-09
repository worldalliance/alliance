import { R, type Result } from "@alliance/common/result";
import { InviteAvailability } from "@alliance/shared/lib/useInvite";
import { z } from "zod";

const KEY = "alliance:invite";

const inviteMemorySchema = z.object({
  /** The latest code opened by URL, until it proves valid. */
  explicit: z.string().nullable(),
  /** The last code that proved valid. */
  saved: z.string().nullable(),
});

export type InviteMemory = z.infer<typeof inviteMemorySchema>;

export const NO_INVITE: InviteMemory = { explicit: null, saved: null };

/** An explicit code outranks the saved one, so an unavailable one hides it. */
export const selectedCode = (memory: InviteMemory): string | null =>
  memory.explicit ?? memory.saved;

export const captureInvite = (
  memory: InviteMemory,
  code: string,
): InviteMemory =>
  memory.explicit === code ? memory : { ...memory, explicit: code };

/** Ignores a result for any code but the one selected now. */
export function settleInvite(
  memory: InviteMemory,
  result: { code: string; availability: InviteAvailability },
): InviteMemory {
  const { code, availability } = result;
  if (selectedCode(memory) !== code) return memory;
  switch (availability) {
    case InviteAvailability.Available:
      return memory.explicit === code
        ? { explicit: null, saved: code }
        : memory;
    case InviteAvailability.Unavailable:
      return memory.explicit === code && memory.saved !== code
        ? memory
        : {
            explicit: code,
            saved: memory.saved === code ? null : memory.saved,
          };
    case InviteAvailability.Checking:
    case InviteAvailability.Unknown:
      return memory;
    default:
      throw new Error(
        `unknown invite availability: ${availability satisfies never}`,
      );
  }
}

export function loadInviteMemory(): InviteMemory {
  const read = R.fromThrowable(() => window.sessionStorage.getItem(KEY));
  const raw = R.isSuccess(read) ? read.value : null;
  if (raw === null) return NO_INVITE;
  const json = R.fromThrowable((): unknown => JSON.parse(raw));
  if (R.isFailure(json)) return NO_INVITE;
  const parsed = inviteMemorySchema.safeParse(json.value);
  return parsed.success ? parsed.data : NO_INVITE;
}

export function saveInviteMemory(memory: InviteMemory): Result<void> {
  return R.fromThrowable(() => {
    if (selectedCode(memory) === null) {
      window.sessionStorage.removeItem(KEY);
    } else {
      window.sessionStorage.setItem(KEY, JSON.stringify(memory));
    }
  });
}
