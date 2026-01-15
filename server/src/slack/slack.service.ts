import { Injectable, Logger } from '@nestjs/common';

@Injectable()
export class SlackService {
  private readonly logger = new Logger(SlackService.name);

  async sendMessage(message: string) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (!webhookUrl) {
      this.logger.warn('SLACK_WEBHOOK_URL is not set; skipping Slack message');
      return;
    }
    if (process.env.NODE_ENV === 'development') {
      this.logger.log(`Skipping Slack message in development: ${message}`);
      return;
    }

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        text: message,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      this.logger.error(
        `Failed to send Slack message: ${res.status} ${res.statusText} ${text}`,
      );
    }
  }
}
