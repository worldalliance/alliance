import { R } from '@alliance/common/result';
import { ForbiddenException } from '@nestjs/common';
import type { ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import 'reflect-metadata';
import { EventType } from 'src/eventlog/event-log.entity';
import { EventLogService } from 'src/eventlog/eventlog.service';
import { getExpectedTwilioSignature } from 'twilio/lib/webhooks/webhooks';
import { MmsController } from './mms.controller';
import {
  TwilioSignatureGuard,
  twilioSignatureEnforced,
  twilioWebhookUrl,
} from './twilio-signature.guard';

// Nest's non-exported metadata key for @UseGuards.
const GUARDS_METADATA = '__guards__';

const AUTH_TOKEN = 'test-auth-token';
const APP_URL = 'https://worldalliance.org';
const PUBLIC_URL = `${APP_URL}/api/mms/inbound`;
const BODY = { From: '+14155559001', To: '+15555550100', Body: 'STOP' };

const withEnv = <T>(
  env: Record<string, string | undefined>,
  run: () => T,
): T => {
  const previous = { ...process.env };
  for (const [key, value] of Object.entries(env)) {
    // Assignment can stringify undefined.
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }
  try {
    return run();
  } finally {
    process.env = previous;
  }
};

// Deliberately differs from the public URL to catch request-derived checks.
const request = (overrides: Partial<Request> = {}): Request => {
  const headers: Record<string, string> = {
    ...((overrides.headers ?? {}) as Record<string, string>),
  };
  return {
    body: BODY,
    originalUrl: '/mms/inbound',
    ...overrides,
    headers,
    header: (name: string) => headers[name.toLowerCase()],
  } as unknown as Request;
};

const contextFor = (req: Request) =>
  ({
    switchToHttp: () => ({ getRequest: () => req }),
  }) as unknown as ExecutionContext;

const signedRequest = (url = PUBLIC_URL) =>
  request({
    headers: {
      'x-twilio-signature': getExpectedTwilioSignature(AUTH_TOKEN, url, BODY),
    } as unknown as Request['headers'],
  });

describe('twilioSignatureEnforced', () => {
  it('is off where the guard skips verification', () => {
    for (const NODE_ENV of ['test', 'development']) {
      withEnv({ NODE_ENV }, () =>
        expect(twilioSignatureEnforced()).toBe(false),
      );
    }
  });

  it('is on everywhere else, including an unset NODE_ENV', () => {
    for (const NODE_ENV of ['production', 'staging', undefined]) {
      withEnv({ NODE_ENV }, () => expect(twilioSignatureEnforced()).toBe(true));
    }
  });
});

describe('twilioWebhookUrl', () => {
  const urlFor = (appUrl: string | undefined) =>
    withEnv({ APP_URL: appUrl }, () => R.toNullable(twilioWebhookUrl()));

  it('builds the public URL from APP_URL, including the /api prefix', () => {
    expect(urlFor(APP_URL)).toBe(PUBLIC_URL);
  });

  it('follows APP_URL between environments', () => {
    expect(urlFor('https://staging.worldalliance.org')).toBe(
      'https://staging.worldalliance.org/api/mms/inbound',
    );
  });

  it('normalizes an APP_URL written a slightly different way', () => {
    for (const written of [
      `${APP_URL}/`,
      `${APP_URL}//`,
      `${APP_URL}?ref=console`,
      'HTTPS://WorldAlliance.org',
    ]) {
      expect(urlFor(written)).toBe(PUBLIC_URL);
    }
  });

  it('fails rather than inventing a URL it cannot build', () => {
    for (const unusable of [undefined, '', 'not a url']) {
      expect(urlFor(unusable)).toBeNull();
    }
  });
});

const enforcing = (env: Record<string, string | undefined> = {}) => ({
  NODE_ENV: 'production',
  TWILIO_AUTH_TOKEN: AUTH_TOKEN,
  APP_URL,
  ...env,
});

/** Returns a fresh guard because alert throttling is instance state. */
const alertingGuard = () => {
  const sendMessage = jest.fn();
  const eventLogService = { sendMessage } as unknown as EventLogService;
  return { guard: new TwilioSignatureGuard(eventLogService), sendMessage };
};

const alertMessage = (sendMessage: jest.Mock, nth = 0): string => {
  const [event] = sendMessage.mock.calls[nth] as [{ message: string }];
  return event.message;
};

describe('TwilioSignatureGuard', () => {
  let guard: TwilioSignatureGuard;

  beforeEach(() => {
    ({ guard } = alertingGuard());
  });

  it('accepts a request signed with the account auth token', () => {
    withEnv(enforcing(), () => {
      expect(guard.canActivate(contextFor(signedRequest()))).toBe(true);
    });
  });

  it('rejects a request with no signature at all', () => {
    withEnv(enforcing(), () => {
      expect(() => guard.canActivate(contextFor(request()))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('rejects a signature made with a different token', () => {
    withEnv(enforcing({ TWILIO_AUTH_TOKEN: 'someone-elses-token' }), () => {
      expect(() => guard.canActivate(contextFor(signedRequest()))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('rejects a signature made for a different URL', () => {
    withEnv(enforcing(), () => {
      const req = signedRequest('https://api.example.org/mms/other');

      expect(() => guard.canActivate(contextFor(req))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('rejects a body that was tampered with after signing', () => {
    withEnv(enforcing(), () => {
      const req = signedRequest();
      req.body = { ...BODY, From: '+14155559999' };

      expect(() => guard.canActivate(contextFor(req))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('fails closed when APP_URL cannot be made into a URL', () => {
    for (const unusable of [undefined, '', 'not a url']) {
      withEnv(enforcing({ APP_URL: unusable }), () => {
        expect(() => guard.canActivate(contextFor(signedRequest()))).toThrow(
          ForbiddenException,
        );
      });
    }
  });

  it('accepts a request when APP_URL carries a trailing slash', () => {
    withEnv(enforcing({ APP_URL: `${APP_URL}/` }), () => {
      expect(guard.canActivate(contextFor(signedRequest()))).toBe(true);
    });
  });

  it('fails closed when no auth token is configured', () => {
    withEnv(enforcing({ TWILIO_AUTH_TOKEN: undefined }), () => {
      expect(() => guard.canActivate(contextFor(signedRequest()))).toThrow(
        ForbiddenException,
      );
    });
  });

  it('skips verification in test and development', () => {
    for (const NODE_ENV of ['test', 'development']) {
      withEnv(enforcing({ NODE_ENV, TWILIO_AUTH_TOKEN: undefined }), () => {
        expect(guard.canActivate(contextFor(request()))).toBe(true);
      });
    }
  });

  it('enforces in staging, which points at real phone numbers', () => {
    withEnv(enforcing({ NODE_ENV: 'staging' }), () => {
      expect(() => guard.canActivate(contextFor(request()))).toThrow(
        ForbiddenException,
      );
    });
  });

  describe('alerting', () => {
    afterEach(() => {
      jest.restoreAllMocks();
    });

    const reject = (guard: TwilioSignatureGuard) => {
      expect(() => guard.canActivate(contextFor(request()))).toThrow(
        ForbiddenException,
      );
    };

    it('raises an alert naming the URL to check', () => {
      const { guard, sendMessage } = alertingGuard();

      withEnv(enforcing(), () => reject(guard));

      expect(sendMessage).toHaveBeenCalledTimes(1);
      const [[event]] = sendMessage.mock.calls as [
        [{ type: EventType; message: string; blob: Record<string, unknown> }],
      ];
      expect(event.type).toBe(EventType.SmsFailure);
      expect(event.message).toContain(PUBLIC_URL);
      expect(event.blob.url).toBe(PUBLIC_URL);
    });

    it('alerts on a missing auth token and an unusable APP_URL', () => {
      for (const env of [
        { TWILIO_AUTH_TOKEN: undefined },
        { APP_URL: 'not a url' },
      ]) {
        const { guard, sendMessage } = alertingGuard();

        withEnv(enforcing(env), () => reject(guard));

        expect(sendMessage).toHaveBeenCalledTimes(1);
      }
    });

    it('still names the console URL when the auth token is what is missing', () => {
      const { guard, sendMessage } = alertingGuard();

      withEnv(enforcing({ TWILIO_AUTH_TOKEN: undefined }), () => reject(guard));

      expect(alertMessage(sendMessage)).toContain(PUBLIC_URL);
    });

    it('says the URL is unbuildable rather than naming a wrong one', () => {
      const { guard, sendMessage } = alertingGuard();

      withEnv(enforcing({ APP_URL: 'not a url' }), () => reject(guard));

      const message = alertMessage(sendMessage);
      expect(message).toContain('<APP_URL is unusable>');
      expect(message).not.toContain('undefined');
    });

    it('alerts once per window, reporting what it stood for', () => {
      const { guard, sendMessage } = alertingGuard();
      const minutes = (n: number) => n * 60 * 1000;
      const now = jest.spyOn(Date, 'now').mockReturnValue(0);

      withEnv(enforcing(), () => {
        reject(guard);
        expect(sendMessage).toHaveBeenCalledTimes(1);

        now.mockReturnValue(minutes(1));
        reject(guard);
        reject(guard);
        expect(sendMessage).toHaveBeenCalledTimes(1);

        now.mockReturnValue(minutes(16));
        reject(guard);
      });

      expect(sendMessage).toHaveBeenCalledTimes(2);
      expect(alertMessage(sendMessage, 0)).not.toContain('rejections since');
      expect(alertMessage(sendMessage, 1)).toContain(
        '3 rejections since the last alert',
      );
    });

    it('says nothing when the signature checks out', () => {
      const { guard, sendMessage } = alertingGuard();

      withEnv(enforcing(), () => {
        expect(guard.canActivate(contextFor(signedRequest()))).toBe(true);
      });

      expect(sendMessage).not.toHaveBeenCalled();
    });
  });

  it('is attached to the inbound route', () => {
    // E2e bypasses verification, so assert decorator wiring directly.
    const guards = Reflect.getMetadata(
      GUARDS_METADATA,
      MmsController.prototype.handleInboundMms,
    ) as unknown[] | undefined;

    expect(guards).toContain(TwilioSignatureGuard);
  });
});
