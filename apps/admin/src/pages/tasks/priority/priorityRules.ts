import type {
  AdminActionListItemDto,
  GeneralUpdateAdminDto,
  SetPriorityDto,
} from "@alliance/shared/client";
import { homePagePriorityComparator } from "@alliance/shared/lib/actionUtils";
import {
  actionHomePlacement,
  generalUpdateHomePlacement,
  type HomePlacement,
} from "../../../lib/homePlacement";
import { moveSpan } from "../../../lib/useDragReorder";

export enum PriorityKind {
  Task = "task",
  GeneralUpdate = "generalUpdate",
  Divider = "divider",
}

export type PriorityItem =
  | {
      kind: PriorityKind.Task | PriorityKind.GeneralUpdate;
      id: number;
      name: string;
      suiteName: string | undefined;
      placement: HomePlacement;
    }
  | { kind: PriorityKind.Divider };

export const itemKey = (item: PriorityItem): string =>
  item.kind === PriorityKind.Divider ? item.kind : `${item.kind}-${item.id}`;

/**
 * Tasks and general updates in home-page order, with the divider above the
 * first whose priority is below 0: the server gives a new item priority 0 and
 * raises every priority from 0 up, so it lands just above the divider.
 */
export function buildPriorityList(params: {
  actions: AdminActionListItemDto[];
  generalUpdates: GeneralUpdateAdminDto[];
  showAll: boolean;
  now: Date;
}): PriorityItem[] {
  const { actions, generalUpdates, showAll, now } = params;
  const rows = [
    ...actions.map((action) => ({
      raw: action,
      item: {
        kind: PriorityKind.Task as const,
        id: action.id,
        name: action.name,
        suiteName: action.suite?.name,
        placement: actionHomePlacement({ action, now }),
      },
    })),
    ...generalUpdates.map((generalUpdate) => ({
      raw: generalUpdate,
      item: {
        kind: PriorityKind.GeneralUpdate as const,
        id: generalUpdate.id,
        name: generalUpdate.name,
        suiteName: generalUpdate.suites?.length
          ? generalUpdate.suites.map((suite) => suite.name).join(", ")
          : undefined,
        placement: generalUpdateHomePlacement({ generalUpdate, now }),
      },
    })),
  ]
    .filter(({ item }) => showAll || item.placement.inactive === null)
    .sort((a, b) => homePagePriorityComparator(a.raw, b.raw));
  const below = rows.findIndex(({ raw }) => raw.priority < 0);
  const at = below === -1 ? rows.length : below;
  const items = rows.map(({ item }) => item);
  return [
    ...items.slice(0, at),
    { kind: PriorityKind.Divider },
    ...items.slice(at),
  ];
}

/** Each row's priority is its distance above the divider: 1 just above it, -1 just below. */
export function prioritiesOf(items: readonly PriorityItem[]): SetPriorityDto {
  const divider = items.findIndex((i) => i.kind === PriorityKind.Divider);
  const body: SetPriorityDto = {
    actionPriorities: [],
    generalUpdatePriorities: [],
  };
  items.forEach((item, index) => {
    const entry = { priority: divider - index };
    switch (item.kind) {
      case PriorityKind.Task:
        body.actionPriorities.push({ id: item.id, ...entry });
        return;
      case PriorityKind.GeneralUpdate:
        body.generalUpdatePriorities.push({ id: item.id, ...entry });
        return;
      case PriorityKind.Divider:
        return;
      default:
        throw new Error(`unknown kind: ${item satisfies never}`);
    }
  });
  return body;
}

/**
 * How far each row moved up from where it started, by key. A row that was not
 * in the starting order (it arrived in a refetch) counts as unmoved.
 */
export function movesFrom(params: {
  from: readonly PriorityItem[];
  items: readonly PriorityItem[];
}): { moved: Map<string, number>; anyChanged: boolean } {
  const start = new Map(params.from.map((item, i) => [itemKey(item), i]));
  const moved = new Map<string, number>();
  let anyChanged = false;
  params.items.forEach((item, index) => {
    const was = start.get(itemKey(item));
    if (was === undefined) return;
    moved.set(itemKey(item), was - index);
    if (was !== index) anyChanged = true;
  });
  return { moved, anyChanged };
}

export enum MoveDirection {
  Up = "up",
  Down = "down",
}

const STEP: Record<MoveDirection, number> = {
  [MoveDirection.Up]: -1,
  [MoveDirection.Down]: 2,
};

/** The list with the row at `index` one place up or down; null at either end. */
export function moveOne(params: {
  items: readonly PriorityItem[];
  index: number;
  direction: MoveDirection;
}): PriorityItem[] | null {
  const { items, index, direction } = params;
  const to = index + STEP[direction];
  if (to < 0 || to > items.length) return null;
  return (
    moveSpan({ items, start: index, end: index + 1, index: to })?.items ?? null
  );
}

export const DIVIDER_NAME = "The line for new items";

/** What a screen reader hears after a move: where the row is now. */
export function movedAnnouncement(params: {
  items: readonly PriorityItem[];
  key: string;
}): string {
  const { items, key } = params;
  const index = items.findIndex((item) => itemKey(item) === key);
  const item = items[index];
  const divider = items.findIndex((i) => i.kind === PriorityKind.Divider);
  const count = items.length - 1;
  if (item.kind === PriorityKind.Divider) {
    return index === 0
      ? `${DIVIDER_NAME} is now at the top, above every item.`
      : `${DIVIDER_NAME} is now below item ${index} of ${count}.`;
  }
  const position = `${index < divider ? index + 1 : index} of ${count}`;
  const side = index < divider ? "above" : "below";
  return `${item.name} is now ${position}, ${side} the line for new items.`;
}
