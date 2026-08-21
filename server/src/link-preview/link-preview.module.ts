import { Module } from "@nestjs/common";
import { UserThrottlerGuard } from "src/utils/throttle";
import { LinkPreviewController } from "./link-preview.controller";
import { LinkPreviewService } from "./link-preview.service";

@Module({
  controllers: [LinkPreviewController],
  providers: [LinkPreviewService, UserThrottlerGuard],
})
export class LinkPreviewModule {}
