import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import type { Request, Response } from "express";
import { readCookie } from "src/utils/cookies";
import { hashToken, randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { LessThan } from "typeorm";
import { ProjectParticipantSession } from "./entities/project-participant-session.entity";
import { ProjectParticipant } from "./entities/project-participant.entity";
import {
  clearCookie,
  ParticipantCookie,
  setCookie,
} from "./participant-cookies";

const IDLE_TIMEOUT_MS = milliseconds({ days: 30 });

@Injectable()
export class ParticipantSessionService {
  constructor(
    @InjectRepository(ProjectParticipantSession)
    private readonly sessions: Repository<ProjectParticipantSession>,
    @InjectRepository(ProjectParticipant)
    private readonly participants: Repository<ProjectParticipant>,
  ) {}

  /** Replaces this browser's session, leaving other browsers signed in. */
  async begin(params: {
    req: Request;
    res: Response;
    participantId: string;
  }): Promise<void> {
    const { req, res, participantId } = params;
    const previous = readCookie(req, ParticipantCookie.Session);
    if (previous) {
      await this.sessions.delete({ tokenHash: hashToken(previous) });
    }
    const token = randomToken(32);
    await this.sessions.insert({
      tokenHash: hashToken(token),
      participantId,
      expiresAt: new Date(Date.now() + IDLE_TIMEOUT_MS),
    });
    setCookie({
      res,
      name: ParticipantCookie.Session,
      token,
      maxAgeMs: IDLE_TIMEOUT_MS,
    });
  }

  /** The signed-in participant, whose session this extends. */
  async current(
    req: Request,
    res: Response,
  ): Promise<ProjectParticipant | null> {
    const token = readCookie(req, ParticipantCookie.Session);
    if (!token) return null;
    const now = Date.now();
    const renewed = await this.sessions
      .createQueryBuilder()
      .update()
      .set({ expiresAt: new Date(now + IDLE_TIMEOUT_MS) })
      .where(`"tokenHash" = :tokenHash AND "expiresAt" > :now`, {
        tokenHash: hashToken(token),
        now: new Date(now),
      })
      .returning(`"participantId"`)
      .execute();
    const [row]: { participantId: string }[] = renewed.raw;
    const participant =
      row && (await this.participants.findOneBy({ id: row.participantId }));
    if (!participant) {
      clearCookie(res, ParticipantCookie.Session);
      return null;
    }
    setCookie({
      res,
      name: ParticipantCookie.Session,
      token,
      maxAgeMs: IDLE_TIMEOUT_MS,
    });
    return participant;
  }

  async end(req: Request, res: Response): Promise<void> {
    const token = readCookie(req, ParticipantCookie.Session);
    if (token) {
      await this.sessions.delete({ tokenHash: hashToken(token) });
    }
    clearCookie(res, ParticipantCookie.Session);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async forgetExpired(): Promise<void> {
    await this.sessions.delete({ expiresAt: LessThan(new Date()) });
  }
}
