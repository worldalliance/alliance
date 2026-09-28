import { OAuthError, OAuthProvider } from "@alliance/common/oauth";
import type { JwtService } from "@nestjs/jwt";
import { User } from "src/user/entities/user.entity";
import type { UserService } from "src/user/user.service";
import { QueryFailedError, type Repository } from "typeorm";
import type { AuthService } from "../auth.service";
import type { SpentTokenService } from "../spent-token.service";
import { OAuthAccount } from "./oauth-account.entity";
import { OAuthAuthService } from "./oauth-auth.service";

const email = "ada@example.com";

describe("OAuthAuthService.authenticate", () => {
  afterEach(() => jest.restoreAllMocks());

  it("keeps the email out of the log when signup fails a query", async () => {
    const authService = {} as AuthService;
    authService.createReferredUser = () =>
      Promise.reject(
        new QueryFailedError(
          'INSERT INTO "user" ("email") VALUES ($1)',
          [email],
          Object.assign(
            new Error(
              'duplicate key value violates unique constraint "UQ_email"',
            ),
            { detail: `Key (email)=(${email}) already exists.` },
          ),
        ),
      );
    const usersService = {} as UserService;
    usersService.findOneByEmail = () => Promise.resolve(null);
    const accountRepository = {} as Repository<OAuthAccount>;
    accountRepository.findOne = () => Promise.resolve(null);
    const service = new OAuthAuthService(
      authService,
      usersService,
      {} as JwtService,
      accountRepository,
      {} as Repository<User>,
      {} as SpentTokenService,
    );
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await service.authenticate({
      profile: {
        provider: OAuthProvider.Google,
        subject: "subject",
        email,
        emailVerified: true,
        name: null,
      },
      referralCode: "invite",
      timeZone: null,
    });

    expect(result).toEqual({ ok: false, error: OAuthError.Failed });
    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain(email);
  });
});
