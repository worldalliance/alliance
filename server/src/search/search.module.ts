import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { ActionsModule } from "src/actions/actions.module";
import { ForumModule } from "src/forum/forum.module";
import { UserModule } from "../user/user.module";
import { RecentSearch } from "./recentsearch.entity";
import { SearchController } from "./search.controller";
import { SearchService } from "./search.service";

@Module({
  imports: [
    UserModule,
    ActionsModule,
    ForumModule,
    TypeOrmModule.forFeature([RecentSearch]),
  ],
  providers: [SearchService],
  controllers: [SearchController],
})
export class SearchModule {}
