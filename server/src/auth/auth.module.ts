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
import { AppleOAuthClient } from "./oauth/apple-oauth.client";
import { GoogleOAuthClient } from "./oauth/google-oauth.client";
import { OAuthAccount } from "./oauth/oauth-account.entity";
import { OAuthAuthService } from "./oauth/oauth-auth.service";
import { OAuthController } from "./oauth/oauth.controller";

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
    TypeOrmModule.forFeature([User, Guest, OAuthAccount]),
  ],
  providers: [
    AuthService,
    OAuthAuthService,
    GoogleOAuthClient,
    AppleOAuthClient,
  ],
  controllers: [AuthController, OAuthController],
  exports: [AuthService],
})
export class AuthModule {}
