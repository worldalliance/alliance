import {
  FormResponseDto,
  SubmitFormDto,
  tasksSubmitForm,
} from "@alliance/shared/client";

const GUEST_TASK_COMPLETIONS_STORAGE_KEY =
  "alliance.guest-task-completions.v1";

export interface GuestTaskCompletionRecord {
  actionId: number;
  taskFormId: number;
  submission: SubmitFormDto;
  formResponse: FormResponseDto;
  completedAt: string;
}

type GuestTaskCompletionMap = Record<string, GuestTaskCompletionRecord>;

function isBrowser(): boolean {
  return typeof window !== "undefined";
}

function readGuestTaskCompletionMap(): GuestTaskCompletionMap {
  if (!isBrowser()) {
    return {};
  }

  try {
    const raw = window.localStorage.getItem(
      GUEST_TASK_COMPLETIONS_STORAGE_KEY,
    );
    if (!raw) {
      return {};
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return {};
    }

    return parsed as GuestTaskCompletionMap;
  } catch {
    return {};
  }
}

function writeGuestTaskCompletionMap(map: GuestTaskCompletionMap): void {
  if (!isBrowser()) {
    return;
  }

  window.localStorage.setItem(
    GUEST_TASK_COMPLETIONS_STORAGE_KEY,
    JSON.stringify(map),
  );
}

export function getGuestTaskCompletion(
  actionId: number,
): GuestTaskCompletionRecord | null {
  const map = readGuestTaskCompletionMap();
  return map[String(actionId)] ?? null;
}

export function saveGuestTaskCompletion(
  record: GuestTaskCompletionRecord,
): void {
  const map = readGuestTaskCompletionMap();
  map[String(record.actionId)] = record;
  writeGuestTaskCompletionMap(map);
}

export function removeGuestTaskCompletion(actionId: number): void {
  const map = readGuestTaskCompletionMap();
  delete map[String(actionId)];
  writeGuestTaskCompletionMap(map);
}

export async function syncGuestTaskCompletions(): Promise<{
  syncedActionIds: number[];
  failedActionIds: number[];
}> {
  const map = readGuestTaskCompletionMap();
  const records = Object.values(map);
  const syncedActionIds: number[] = [];
  const failedActionIds: number[] = [];

  for (const record of records) {
    try {
      const response = await tasksSubmitForm({
        path: { id: record.taskFormId },
        body: record.submission,
      });

      if (response.response.ok) {
        removeGuestTaskCompletion(record.actionId);
        syncedActionIds.push(record.actionId);
        continue;
      }

      const errorMessage =
        response.error instanceof Error
          ? response.error.message
          : String(response.error ?? "");

      if (errorMessage === "Form already submitted") {
        removeGuestTaskCompletion(record.actionId);
        syncedActionIds.push(record.actionId);
      } else {
        failedActionIds.push(record.actionId);
      }
    } catch {
      failedActionIds.push(record.actionId);
    }
  }

  return { syncedActionIds, failedActionIds };
}
