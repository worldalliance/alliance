import { Module } from "@nestjs/common";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailModule } from "src/mail/mail.module";
import { User } from "src/user/entities/user.entity";
import { env } from "../config/env";
import { UserModule } from "../user/user.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Guest } from "./entities/guest.entity";
import { SpentToken } from "./entities/spent-token.entity";
import { WebHandoff } from "./entities/web-handoff.entity";
import { OAuthAccount } from "./oauth/oauth-account.entity";
import { OAuthAuthService } from "./oauth/oauth-auth.service";
import { OAuthCallbackService } from "./oauth/oauth-callback.service";
import { OAuthClientsModule } from "./oauth/oauth-clients.module";
import { OAuthLinkController } from "./oauth/oauth-link.controller";
import { OAuthSessionService } from "./oauth/oauth-session.service";
import { OAuthController } from "./oauth/oauth.controller";
import { SessionModule } from "./session.module";
import { SpentTokenService } from "./spent-token.service";
import { WebHandoffController } from "./web-handoff.controller";
import { WebHandoffService } from "./web-handoff.service";

@Module({
  imports: [
    SessionModule,
    UserModule,
    MailModule,
    OAuthClientsModule,
    JwtModule.registerAsync({
      global: true,
      useFactory: () => ({
        secret: env("JWT_SECRET"),
        signOptions: { expiresIn: "1d" },
      }),
    }),
    TypeOrmModule.forFeature([
      User,
      Guest,
      OAuthAccount,
      SpentToken,
      WebHandoff,
    ]),
  ],
  providers: [
    AuthService,
    OAuthAuthService,
    OAuthCallbackService,
    OAuthSessionService,
    WebHandoffService,
    SpentTokenService,
  ],
  controllers: [
    AuthController,
    OAuthController,
    OAuthLinkController,
    WebHandoffController,
  ],
  exports: [AuthService],
})
export class AuthModule {}
