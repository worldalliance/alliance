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

  const serviceWith = (
    createReferredUser: AuthService["createReferredUser"],
  ): OAuthAuthService => {
    const authService = {} as AuthService;
    authService.createReferredUser = createReferredUser;
    const usersService = {} as UserService;
    usersService.findOneByEmail = () => Promise.resolve(null);
    const accountRepository = {} as Repository<OAuthAccount>;
    accountRepository.findOne = () => Promise.resolve(null);
    return new OAuthAuthService(
      authService,
      usersService,
      {} as JwtService,
      accountRepository,
      {} as Repository<User>,
      {} as SpentTokenService,
    );
  };

  const signUp = (service: OAuthAuthService, name: string | null) =>
    service.authenticate({
      profile: {
        provider: OAuthProvider.Google,
        subject: "subject",
        email,
        emailVerified: true,
        name,
      },
      referralCode: "invite",
      timeZone: null,
    });

  it("keeps the email out of the log when signup fails a query", async () => {
    const service = serviceWith(() =>
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
      ),
    );
    const logged = jest.spyOn(console, "error").mockImplementation(() => {});

    const result = await signUp(service, null);

    expect(result).toEqual({ ok: false, error: OAuthError.Failed });
    expect(logged).toHaveBeenCalled();
    expect(JSON.stringify(logged.mock.calls)).not.toContain(email);
  });

  it.each([
    ["  Ada Lovelace  ", "Ada Lovelace"],
    ["   ", email],
    [null, email],
  ])("signs up provider name %j as %j", async (name, expected) => {
    const createReferredUser = jest.fn(() => Promise.resolve(new User()));

    await signUp(serviceWith(createReferredUser), name);

    expect(createReferredUser).toHaveBeenCalledWith(
      expect.objectContaining({ name: expected }),
    );
  });
});
