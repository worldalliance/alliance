import { NodeEnv } from '@alliance/common/node-env';
import { socketCorsOrigins } from './cors-origins';

const DEPLOYED = {
  appUrl: 'https://worldalliance.org',
  adminUrl: 'https://admin.worldalliance.org',
};

const matches = (origins: (string | RegExp)[], origin: string): boolean =>
  origins.some((allowed) =>
    typeof allowed === 'string' ? allowed === origin : allowed.test(origin),
  );

describe('socketCorsOrigins', () => {
  it.each([NodeEnv.Production, NodeEnv.Staging])(
    'allows APP_URL and ADMIN_URL and nothing else under %s',
    (nodeEnv) => {
      expect(socketCorsOrigins({ nodeEnv, ...DEPLOYED })).toEqual([
        DEPLOYED.appUrl,
        DEPLOYED.adminUrl,
      ]);
    },
  );

  it.each([
    'http://localhost:5173',
    'http://localhost:5273',
    'http://127.0.0.1:3005',
  ])('rejects %s in production', (origin) => {
    const origins = socketCorsOrigins({
      nodeEnv: NodeEnv.Production,
      ...DEPLOYED,
    });

    expect(matches(origins, origin)).toBe(false);
  });

  it.each([NodeEnv.Development, NodeEnv.Test])(
    'allows localhost on any port under %s, so a worktree reaches its own server',
    (nodeEnv) => {
      const origins = socketCorsOrigins({
        nodeEnv,
        appUrl: 'http://localhost:5273',
        adminUrl: 'http://localhost:5274',
      });

      for (const origin of [
        'http://localhost:5173',
        'http://localhost:5473',
        'http://127.0.0.1:8085',
        'https://localhost',
      ]) {
        expect(matches(origins, origin)).toBe(true);
      }
    },
  );

  it('does not treat a localhost-prefixed hostname as localhost', () => {
    const origins = socketCorsOrigins({
      nodeEnv: NodeEnv.Development,
      ...DEPLOYED,
    });

    expect(matches(origins, 'http://localhost.evil.com')).toBe(false);
    expect(matches(origins, 'http://notlocalhost')).toBe(false);
  });

  it.each([undefined, '', 'qa', 'Production'])(
    'gives NODE_ENV=%p the deployed set rather than widening',
    (nodeEnv) => {
      expect(socketCorsOrigins({ nodeEnv, ...DEPLOYED })).toEqual([
        DEPLOYED.appUrl,
        DEPLOYED.adminUrl,
      ]);
    },
  );

  it('drops a URL that is unset rather than allowing undefined', () => {
    expect(
      socketCorsOrigins({
        nodeEnv: NodeEnv.Production,
        appUrl: DEPLOYED.appUrl,
        adminUrl: undefined,
      }),
    ).toEqual([DEPLOYED.appUrl]);
  });
});
