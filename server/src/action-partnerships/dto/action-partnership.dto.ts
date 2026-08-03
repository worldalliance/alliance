import { ApiProperty, ApiPropertyOptional, PickType } from '@nestjs/swagger';
import { IsDateString, IsOptional } from 'class-validator';
import { ActionPartnershipNote } from '../entities/action-partnership-note.entity';
import { ActionPartnershipResponse } from '../entities/action-partnership-response.entity';
import type { WithRelations } from 'src/utils/Repository';

export class ActionPartnershipNoteDto extends PickType(ActionPartnershipNote, [
  'id',
  'responseId',
  'noteDate',
  'body',
  'createdAt',
  'updatedAt',
]) {
  constructor(note: ActionPartnershipNote) {
    super();
    this.id = note.id;
    this.responseId = note.responseId ?? note.response.id;
    this.noteDate = note.noteDate;
    this.body = note.body;
    this.createdAt = note.createdAt;
    this.updatedAt = note.updatedAt;
  }
}

export class ActionPartnershipResponseDto extends PickType(
  ActionPartnershipResponse,
  [
    'id',
    'organizationName',
    'organizationWebsite',
    'personName',
    'contact',
    'outreachChannels',
    'outreachOtherDetails',
    'audienceSize',
    'desiredCollaboration',
    'notes',
    'createdAt',
    'updatedAt',
  ],
) {
  @ApiProperty({ type: () => ActionPartnershipNoteDto, isArray: true })
  notesHistory: ActionPartnershipNoteDto[];

  constructor(
    response: WithRelations<ActionPartnershipResponse, { notesHistory: true }>,
  ) {
    super();
    this.id = response.id;
    this.organizationName = response.organizationName;
    this.organizationWebsite = response.organizationWebsite;
    this.personName = response.personName;
    this.contact = response.contact;
    this.outreachChannels = response.outreachChannels;
    this.outreachOtherDetails = response.outreachOtherDetails;
    this.audienceSize = response.audienceSize;
    this.desiredCollaboration = response.desiredCollaboration;
    this.notes = response.notes;
    this.createdAt = response.createdAt;
    this.updatedAt = response.updatedAt;
    this.notesHistory = response.notesHistory.map(
      (note) => new ActionPartnershipNoteDto(note),
    );
  }
}

export class CreateActionPartnershipResponseDto extends PickType(
  ActionPartnershipResponse,
  [
    'organizationName',
    'organizationWebsite',
    'personName',
    'contact',
    'outreachChannels',
    'outreachOtherDetails',
    'audienceSize',
    'desiredCollaboration',
    'notes',
  ],
) {}

export class CreateActionPartnershipResponseResultDto {
  @ApiProperty()
  submitted: boolean;

  constructor() {
    this.submitted = true;
  }
}

export class CreateActionPartnershipNoteDto extends PickType(
  ActionPartnershipNote,
  ['body'],
) {
  @ApiPropertyOptional({ type: String, format: 'date-time' })
  @IsOptional()
  @IsDateString()
  noteDate?: string;
}
