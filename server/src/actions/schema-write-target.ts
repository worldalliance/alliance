import type { EntityTarget } from 'typeorm';
import { SnapshotHistoryOwner } from 'src/tasks/entities/formsnapshot.entity';
import { ActionUpdate } from './entities/action-update.entity';
import { GeneralUpdate } from './entities/general-update.entity';

export type SchemaWriteTarget = {
  entity: EntityTarget<{ schemaSnapshotId: number }>;
  conflictMessage: string;
};

/**
 * Forms have no display-only write target because the form builder versions
 * their entire `FormSchema`.
 */
export const SCHEMA_WRITE_TARGETS: Record<
  SnapshotHistoryOwner,
  SchemaWriteTarget | null
> = {
  [SnapshotHistoryOwner.Form]: null,
  [SnapshotHistoryOwner.GeneralUpdate]: {
    entity: GeneralUpdate,
    conflictMessage:
      'This general update was changed by someone else since you opened it.',
  },
  [SnapshotHistoryOwner.ActionUpdate]: {
    entity: ActionUpdate,
    conflictMessage:
      'This update was changed by someone else since you opened it.',
  },
};
