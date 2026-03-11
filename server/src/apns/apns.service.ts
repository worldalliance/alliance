import { Injectable, Logger, OnModuleDestroy } from '@nestjs/common';
import * as http2 from 'http2';
import * as crypto from 'crypto';

interface ApnsPayload {
  aps: Record<string, unknown>;
  [key: string]: unknown;
}

@Injectable()
export class ApnsService implements OnModuleDestroy {
  private readonly logger = new Logger(ApnsService.name);
  private client: http2.ClientHttp2Session | null = null;
  private jwt: string | null = null;
  private jwtIssuedAt = 0;

  private get host(): string {
    return process.env.NODE_ENV === 'production'
      ? 'https://api.push.apple.com'
      : 'https://api.sandbox.push.apple.com';
  }

  private get topic(): string {
    return 'com.alliancefoundation.alliancemobile.push-type.liveactivity';
  }

  onModuleDestroy() {
    this.destroyClient();
  }

  private destroyClient() {
    if (this.client) {
      this.client.close();
      this.client = null;
    }
  }

  private getClient(): http2.ClientHttp2Session {
    if (this.client && !this.client.closed && !this.client.destroyed) {
      return this.client;
    }
    this.client = http2.connect(this.host);
    this.client.on('error', (err) => {
      this.logger.error('APNs HTTP/2 connection error', err);
      this.destroyClient();
    });
    this.client.on('goaway', () => {
      this.destroyClient();
    });
    return this.client;
  }

  private getJwt(): string {
    const now = Math.floor(Date.now() / 1000);
    // Refresh JWT every 50 minutes (APNs requires refresh within 60 min)
    if (this.jwt && now - this.jwtIssuedAt < 50 * 60) {
      return this.jwt;
    }

    const keyId = process.env.APNS_KEY_ID;
    const teamId = process.env.APNS_TEAM_ID;
    const privateKey = process.env.APNS_PRIVATE_KEY;

    if (!keyId || !teamId || !privateKey) {
      throw new Error(
        'Missing APNs configuration: APNS_KEY_ID, APNS_TEAM_ID, APNS_PRIVATE_KEY',
      );
    }

    const header = Buffer.from(
      JSON.stringify({ alg: 'ES256', kid: keyId }),
    ).toString('base64url');
    const payload = Buffer.from(
      JSON.stringify({ iss: teamId, iat: now }),
    ).toString('base64url');

    const signer = crypto.createSign('SHA256');
    signer.update(`${header}.${payload}`);
    // The .p8 key may have literal \n instead of actual newlines
    const normalizedKey = privateKey.replace(/\\n/g, '\n');
    const signature = signer
      .sign(normalizedKey, 'base64')
      // Convert from standard base64 to base64url
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    this.jwt = `${header}.${payload}.${signature}`;
    this.jwtIssuedAt = now;
    return this.jwt;
  }

  private async sendRequest(
    token: string,
    payload: ApnsPayload,
    headers: Record<string, string>,
  ): Promise<{ statusCode: number; body: string }> {
    return new Promise((resolve, reject) => {
      const client = this.getClient();
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${this.getJwt()}`,
        'apns-topic': this.topic,
        'apns-push-type': 'liveactivity',
        ...headers,
      });

      const body = JSON.stringify(payload);
      let responseBody = '';

      req.on('response', (headers) => {
        const statusCode = headers[':status'] as number;
        req.on('data', (chunk: Buffer) => {
          responseBody += chunk.toString();
        });
        req.on('end', () => {
          if (statusCode !== 200) {
            this.logger.warn(
              `APNs response ${statusCode}: ${responseBody}`,
            );
          }
          resolve({ statusCode, body: responseBody });
        });
      });

      req.on('error', (err) => {
        this.logger.error('APNs request error', err);
        reject(err);
      });

      req.end(body);
    });
  }

  async sendPushToStart(
    token: string,
    attributes: {
      actionName: string;
      deadline: number;
      totalCount: number;
    },
    contentState: { completedCount: number },
    alert?: { title: string; body: string },
  ): Promise<{ statusCode: number; body: string }> {
    const payload: ApnsPayload = {
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: 'start',
        'content-state': contentState,
        'attributes-type': 'ActionDeadlineAttributes',
        attributes,
        ...(alert ? { alert } : {}),
      },
    };

    return this.sendRequest(token, payload, {
      'apns-priority': '10',
    });
  }

  async sendUpdate(
    token: string,
    contentState: { completedCount: number },
  ): Promise<{ statusCode: number; body: string }> {
    const payload: ApnsPayload = {
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: 'update',
        'content-state': contentState,
      },
    };

    return this.sendRequest(token, payload, {
      'apns-priority': '10',
    });
  }

  async sendEnd(
    token: string,
    contentState: { completedCount: number },
    dismissalDate?: number,
  ): Promise<{ statusCode: number; body: string }> {
    const payload: ApnsPayload = {
      aps: {
        timestamp: Math.floor(Date.now() / 1000),
        event: 'end',
        'content-state': contentState,
        ...(dismissalDate ? { 'dismissal-date': dismissalDate } : {}),
      },
    };

    return this.sendRequest(token, payload, {
      'apns-priority': '10',
    });
  }
}
