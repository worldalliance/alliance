// src/forms/form-response-revision.entity.ts
import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { Allow, IsDefined } from 'class-validator';
import { CreateDateColumnTz } from 'src/datasources/basecolumns';
import type { Relation } from 'src/utils/Repository';
import {
    Column,
    Entity,
    Index,
    JoinColumn,
    ManyToOne,
    PrimaryGeneratedColumn,
} from 'typeorm';
import { FormResponse } from './formresponse.entity';
import { FormSnapshot } from './formsnapshot.entity';

// Append-only history of FormResponse.answers. A row is inserted here
// immediately before the live FormResponse row is overwritten, capturing
// the answers (and the schema they were valid against) as they existed
// right before the edit.
// Note, if an admin runs a snapshot migration on this response while the
// user has the edit form open, there's nothing today that catches it. 
@Entity()
@Index(['formResponseId'])
export class FormResponseRevision {
    @PrimaryGeneratedColumn()
    @ApiProperty()
    @Allow()
    id: number;

    @Column()
    @ApiProperty()
    @IsDefined()
    formResponseId: number;

    @ManyToOne(() => FormResponse, { onDelete: 'CASCADE' })
    @JoinColumn({ name: 'formResponseId' })
    @Type(() => FormResponse)
    @Allow()
    formResponse: Relation<FormResponse>;

    // The answers as they stood immediately before this edit overwrote them.
    @Column({ type: 'jsonb' })
    @ApiProperty()
    @IsDefined()
    @Type(() => Object)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    answers: Record<string, any>;

    // The schema that was in effect for `answers` above (i.e. the
    // FormResponse's formSnapshotId at the moment of this revision).
    @Column()
    @ApiProperty()
    @IsDefined()
    formSnapshotId: number;

    @ManyToOne(() => FormSnapshot, { onDelete: 'RESTRICT' })
    @JoinColumn({ name: 'formSnapshotId' })
    @Type(() => FormSnapshot)
    @Allow()
    formSnapshot: Relation<FormSnapshot>;

    // When this revision was superseded by the edit (i.e. when this row was
    // written). Named for clarity at read time — "when did this version stop
    // being live" — rather than reusing createdAt semantics, since this is append-only.
    @CreateDateColumnTz()
    @ApiProperty()
    @Allow()
    @Type(() => Date)
    supersededAt: Date;
}