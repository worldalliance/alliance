import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { UserService } from 'src/user/user.service';
import { TimeSpentForUserDto } from './timespent.dto';

@Injectable()
export class AnalyticsService {
  private readonly API_KEY: string;
  private readonly PROJECT_ID: string;
  private readonly logger = new Logger(AnalyticsService.name);

  private timeSpentPerUserLast7Days: TimeSpentForUserDto[] = [];
  private timeSpentPerUserTotal: TimeSpentForUserDto[] = [];

  getQuery(range: 'last7Days' | 'total') {
    return `
WITH per_session AS (
  SELECT
    p.id AS person_id,
    any(JSONExtractString(p.properties, 'email')) AS email,
    e.session.id AS session_id,
    /* end/start are identical on every event in the session, so any() is fine */
    any(e.session.$end_timestamp - e.session.$start_timestamp) AS session_duration
  FROM events AS e
  JOIN person_distinct_ids AS pdi ON e.distinct_id = pdi.distinct_id
  JOIN persons AS p ON p.id = pdi.person_id
  WHERE e.event = '$pageview'
    ${range === 'last7Days' ? 'AND e.timestamp >= now() - INTERVAL 7 DAY' : ''}
  GROUP BY person_id, session_id
)
SELECT
  person_id,
  email,
  sum(session_duration) AS total_session_duration_seconds
FROM per_session
GROUP BY person_id, email
ORDER BY total_session_duration_seconds DESC
          `;
  }

  constructor(private readonly userService: UserService) {
    if (!process.env.POSTHOG_QUERY_KEY || !process.env.POSTHOG_PROJECT_ID) {
      this.logger.warn('POSTHOG_QUERY_KEY or POSTHOG_PROJECT_ID is not set');
      return;
    }
    this.API_KEY = process.env.POSTHOG_QUERY_KEY;
    this.PROJECT_ID = process.env.POSTHOG_PROJECT_ID;
  }

  async getPosthogData(
    range: 'last7Days' | 'total',
  ): Promise<TimeSpentForUserDto[]> {
    const users = await this.userService.findActiveUsers();

    const emailToUserId = users.reduce((acc, user) => {
      acc[user.email] = user.id;
      return acc;
    }, {});

    const body = {
      query: {
        kind: 'HogQLQuery',
        query: this.getQuery(range),
      },
    };

    const res = await fetch(
      `https://app.posthog.com/api/projects/${this.PROJECT_ID}/query`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.API_KEY}`,
        },
        body: JSON.stringify(body),
      },
    );

    const data = await res.json();

    const results = data.results.map((result) => {
      return {
        person_id: result[0],
        email: result[1],
        total_session_duration_seconds: result[2],
      };
    });

    const timeSpentPerUser: TimeSpentForUserDto[] = results.map(
      (result) =>
        ({
          userId: emailToUserId[result.email],
          timeSpent: result.total_session_duration_seconds,
        }) satisfies TimeSpentForUserDto,
    );
    return timeSpentPerUser;
  }

  @Cron('* * * * *')
  async getTimeSpentFromPosthog() {
    if (!this.API_KEY) {
      this.logger.warn('POSTHOG_QUERY_KEY or POSTHOG_PROJECT_ID is not set');
      return;
    }
    if (
      process.env.NODE_ENV === 'development' &&
      !process.env.DEV_POSTHOG_ANALYTICS
    ) {
      return;
    }
    const timeSpentPerUserLast7Days = await this.getPosthogData('last7Days');
    const timeSpentPerUserTotal = await this.getPosthogData('total');

    this.timeSpentPerUserLast7Days = timeSpentPerUserLast7Days;
    this.timeSpentPerUserTotal = timeSpentPerUserTotal;
  }

  async getTimeSpentPerUser(): Promise<TimeSpentForUserDto[]> {
    return this.timeSpentPerUserLast7Days;
  }

  async getTimeSpentPerUserTotal(): Promise<TimeSpentForUserDto[]> {
    return this.timeSpentPerUserTotal;
  }
}
