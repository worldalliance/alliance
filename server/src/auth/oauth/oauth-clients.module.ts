import { Module } from "@nestjs/common";
import { AppleOAuthClient } from "./apple-oauth.client";
import { GoogleOAuthClient } from "./google-oauth.client";
import { OAuthClients } from "./oauth-clients";

@Module({
  providers: [GoogleOAuthClient, AppleOAuthClient, OAuthClients],
  exports: [GoogleOAuthClient, AppleOAuthClient, OAuthClients],
})
export class OAuthClientsModule {}
