import { AnalyticsEvent } from "@alliance/common/analytics";
import { Injectable } from "@nestjs/common";
import { Cron, CronExpression } from "@nestjs/schedule";
import { InjectRepository } from "@nestjs/typeorm";
import { milliseconds } from "date-fns";
import type { Request, Response } from "express";
import { PosthogService } from "src/posthog/posthog.service";
import { readCookie } from "src/utils/cookies";
import { hashToken, randomToken } from "src/utils/random";
import type { Repository } from "src/utils/Repository";
import { LessThan } from "typeorm";
import { KoraParticipantSession } from "./entities/kora-participant-session.entity";
import { KoraParticipant } from "./entities/kora-participant.entity";
import { clearCookie, KoraCookie, setCookie } from "./kora-cookies";
import type { KoraSignInMethod } from "./kora-participant.service";

const IDLE_TIMEOUT_MS = milliseconds({ days: 30 });

@Injectable()
export class KoraSessionService {
  constructor(
    @InjectRepository(KoraParticipantSession)
    private readonly sessions: Repository<KoraParticipantSession>,
    @InjectRepository(KoraParticipant)
    private readonly participants: Repository<KoraParticipant>,
    private readonly posthog: PosthogService,
  ) {}

  /** Replaces this browser's session, leaving other browsers signed in. */
  async begin(params: {
    req: Request;
    res: Response;
    participantId: string;
    signedUp: boolean;
    method: KoraSignInMethod;
  }): Promise<void> {
    const { req, res, participantId } = params;
    const previous = readCookie(req, KoraCookie.Session);
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
      name: KoraCookie.Session,
      token,
      maxAgeMs: IDLE_TIMEOUT_MS,
    });
    this.posthog.capture({
      event: params.signedUp
        ? AnalyticsEvent.KoraParticipantSignedUp
        : AnalyticsEvent.KoraParticipantSignedIn,
      distinctId: `kora_participant:${participantId}`,
      properties: { method: params.method },
    });
  }

  /** The signed-in participant, whose session this extends. */
  async current(req: Request, res: Response): Promise<KoraParticipant | null> {
    const token = readCookie(req, KoraCookie.Session);
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
      clearCookie(res, KoraCookie.Session);
      return null;
    }
    setCookie({
      res,
      name: KoraCookie.Session,
      token,
      maxAgeMs: IDLE_TIMEOUT_MS,
    });
    return participant;
  }

  async end(req: Request, res: Response): Promise<void> {
    const token = readCookie(req, KoraCookie.Session);
    if (token) {
      await this.sessions.delete({ tokenHash: hashToken(token) });
    }
    clearCookie(res, KoraCookie.Session);
  }

  @Cron(CronExpression.EVERY_HOUR)
  async forgetExpired(): Promise<void> {
    await this.sessions.delete({ expiresAt: LessThan(new Date()) });
  }
}
