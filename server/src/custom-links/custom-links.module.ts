import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { CustomLinksController } from "./custom-links.controller";
import { CustomLinksService } from "./custom-links.service";
import { CustomLink } from "./entities/custom-link.entity";

@Module({
  imports: [TypeOrmModule.forFeature([CustomLink, User])],
  controllers: [CustomLinksController],
  providers: [CustomLinksService],
})
export class CustomLinksModule {}
