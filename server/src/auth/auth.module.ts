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
import { OAuthAccount } from "./oauth/oauth-account.entity";
import { OAuthAuthService } from "./oauth/oauth-auth.service";
import { OAuthClientsModule } from "./oauth/oauth-clients.module";
import { OAuthLinkController } from "./oauth/oauth-link.controller";
import { OAuthController } from "./oauth/oauth.controller";
import { SessionModule } from "./session.module";
import { SpentTokenService } from "./spent-token.service";

@Module({
  imports: [
    SessionModule,
    UserModule,
    MailModule,
    OAuthClientsModule,
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
  providers: [AuthService, OAuthAuthService, SpentTokenService],
  controllers: [AuthController, OAuthController, OAuthLinkController],
  exports: [AuthService],
})
export class AuthModule {}
