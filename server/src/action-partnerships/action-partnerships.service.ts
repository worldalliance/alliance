import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import type {
  Repository as TypedRepository,
  WithRelationsExact,
} from 'src/utils/Repository';
import {
  CreateActionPartnershipNoteDto,
  CreateActionPartnershipResponseDto,
} from './dto/action-partnership.dto';
import { ActionPartnershipNote } from './entities/action-partnership-note.entity';
import { ActionPartnershipResponse } from './entities/action-partnership-response.entity';

@Injectable()
export class ActionPartnershipsService {
  constructor(
    @InjectRepository(ActionPartnershipResponse)
    private readonly responseRepository: TypedRepository<ActionPartnershipResponse>,
    @InjectRepository(ActionPartnershipNote)
    private readonly noteRepository: Repository<ActionPartnershipNote>,
  ) {}

  async createResponse(
    dto: CreateActionPartnershipResponseDto,
  ): Promise<ActionPartnershipResponse> {
    const response = this.responseRepository.create({
      ...dto,
      outreachOtherDetails: dto.outreachOtherDetails ?? '',
      notes: dto.notes ?? '',
    });
    return this.responseRepository.save(response);
  }

  async findAllResponsesAdmin(): Promise<
    WithRelationsExact<ActionPartnershipResponse, { notesHistory: true }>[]
  > {
    return this.responseRepository.find({
      relations: { notesHistory: true },
      order: {
        createdAt: 'DESC',
        notesHistory: { noteDate: 'DESC', createdAt: 'DESC' },
      },
    });
  }

  async createNoteAdmin(
    responseId: number,
    dto: CreateActionPartnershipNoteDto,
  ): Promise<ActionPartnershipNote> {
    const response = await this.responseRepository.findOne({
      where: { id: responseId },
    });
    if (!response) {
      throw new NotFoundException('Action partnership response not found');
    }

    const note = this.noteRepository.create({
      response,
      noteDate: dto.noteDate ? new Date(dto.noteDate) : new Date(),
      body: dto.body,
    });
    return this.noteRepository.save(note);
  }

  async deleteResponseAdmin(responseId: number): Promise<void> {
    const response = await this.responseRepository.findOne({
      where: { id: responseId },
    });
    if (!response) {
      throw new NotFoundException('Action partnership response not found');
    }

    await this.responseRepository.remove(response);
  }
}
