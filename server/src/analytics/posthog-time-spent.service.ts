import { Injectable, Logger } from "@nestjs/common";
import { Cron } from "@nestjs/schedule";
import { UserService } from "src/user/user.service";
import { TimeSpentForUser } from "./timespent.dto";

@Injectable()
export class PosthogTimeSpentService {
  private readonly API_KEY: string;
  private readonly PROJECT_ID: string;
  private readonly logger = new Logger(PosthogTimeSpentService.name);

  private timeSpentPerUserLast7Days: TimeSpentForUser[] = [];
  private timeSpentPerUserTotal: TimeSpentForUser[] = [];

  getQuery(range: "last7Days" | "total") {
    return `
WITH scoped_sessions AS (
  SELECT
    e.person_id,
    e.session.id                                          AS session_id,
    /* duration is identical across events in a session, but we compute once explicitly */
    toFloat(e.session.$end_timestamp - e.session.$start_timestamp) AS raw_duration
  FROM events AS e
  WHERE e.event = '$pageview'
    ${range === "last7Days" ? "AND e.timestamp >= now() - INTERVAL 7 DAY" : ""}
    AND e.person_id IS NOT NULL
    AND e.session.id IS NOT NULL
    AND e.session.$start_timestamp IS NOT NULL
    AND e.session.$end_timestamp IS NOT NULL
)
/* 2) Keep one row per (person_id, session_id) and clamp duration to a reasonable window */
, per_session AS (
  SELECT
    person_id,
    session_id,
    /* drop negatives and absurdly long sessions (e.g. > 8h) */
    greatest(0, least(raw_duration, 8*60*60)) AS session_duration
  FROM scoped_sessions
  GROUP BY person_id, session_id, raw_duration
)
, per_person AS (
  SELECT
    person_id,
    sum(session_duration) AS total_session_duration_seconds
  FROM per_session
  GROUP BY person_id
)
SELECT
  pp.person_id,
  JSONExtractString(p.properties, 'email') AS email,
  pp.total_session_duration_seconds
FROM per_person AS pp
JOIN persons AS p ON p.id = pp.person_id
ORDER BY pp.total_session_duration_seconds DESC
          `;
  }

  constructor(private readonly userService: UserService) {
    if (!process.env.POSTHOG_QUERY_KEY || !process.env.POSTHOG_PROJECT_ID) {
      this.logger.warn("POSTHOG_QUERY_KEY or POSTHOG_PROJECT_ID is not set");
      return;
    }
    this.API_KEY = process.env.POSTHOG_QUERY_KEY;
    this.PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
  }

  async getPosthogData(
    range: "last7Days" | "total",
  ): Promise<TimeSpentForUser[]> {
    const users = await this.userService.findAllUsers();

    const emailToUserId: Record<string, number> = Object.fromEntries(
      users.map((user) => [user.email, user.id]),
    );

    const body = {
      query: {
        kind: "HogQLQuery",
        query: this.getQuery(range),
      },
    };

    const res = await fetch(
      `https://app.posthog.com/api/projects/${this.PROJECT_ID}/query`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify(body),
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let data: any = null;
    try {
      data = await res.json();
    } catch {}

    if (!data || !data.results) {
      return [];
    }

    const results = data.results.map((result) => {
      return {
        person_id: result[0],
        email: result[1],
        total_session_duration_seconds: result[2],
      };
    });

    const timeSpentPerUser: TimeSpentForUser[] = results.map(
      (result) =>
        ({
          userId: emailToUserId[result.email],
          timeSpent: result.total_session_duration_seconds,
        }) satisfies TimeSpentForUser,
    );
    return timeSpentPerUser;
  }

  @Cron("* * * * *")
  async getTimeSpentFromPosthog() {
    if (!this.API_KEY) {
      this.logger.warn("POSTHOG_QUERY_KEY or POSTHOG_PROJECT_ID is not set");
      return;
    }
    if (
      process.env.NODE_ENV === "development" &&
      !process.env.DEV_POSTHOG_ANALYTICS
    ) {
      return;
    }
    const timeSpentPerUserLast7Days = await this.getPosthogData("last7Days");
    const timeSpentPerUserTotal = await this.getPosthogData("total");

    this.timeSpentPerUserLast7Days = timeSpentPerUserLast7Days;
    this.timeSpentPerUserTotal = timeSpentPerUserTotal;
  }

  async getTimeSpentPerUser(): Promise<TimeSpentForUser[]> {
    return this.timeSpentPerUserLast7Days;
  }

  async getTimeSpentPerUserTotal(): Promise<TimeSpentForUser[]> {
    return this.timeSpentPerUserTotal;
  }
}
