import { Module } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { JwtModule } from "@nestjs/jwt";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MailModule } from "src/mail/mail.module";
import { User } from "src/user/entities/user.entity";
import { UserModule } from "../user/user.module";
import { AuthController } from "./auth.controller";
import { AuthService } from "./auth.service";
import { Guest } from "./entities/guest.entity";
import { SpentToken } from "./entities/spent-token.entity";
import { AppleOAuthClient } from "./oauth/apple-oauth.client";
import { GoogleOAuthClient } from "./oauth/google-oauth.client";
import { OAuthAccount } from "./oauth/oauth-account.entity";
import { OAuthAuthService } from "./oauth/oauth-auth.service";
import { OAuthClients } from "./oauth/oauth-clients";
import { OAuthLinkController } from "./oauth/oauth-link.controller";
import { OAuthController } from "./oauth/oauth.controller";
import { SpentTokenService } from "./spent-token.service";

@Module({
  imports: [
    UserModule,
    MailModule,
    JwtModule.registerAsync({
      global: true,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.get<string>("JWT_SECRET"),
        signOptions: { expiresIn: "1d" },
      }),
    }),
    TypeOrmModule.forFeature([User, Guest, OAuthAccount, SpentToken]),
  ],
  providers: [
    AuthService,
    OAuthAuthService,
    SpentTokenService,
    GoogleOAuthClient,
    AppleOAuthClient,
    OAuthClients,
  ],
  controllers: [AuthController, OAuthController, OAuthLinkController],
  exports: [AuthService],
})
export class AuthModule {}
