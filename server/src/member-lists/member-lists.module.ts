import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { MemberListMember } from "./entities/member-list-member.entity";
import { MemberListVersion } from "./entities/member-list-version.entity";
import { MemberList } from "./entities/member-list.entity";
import { MemberListsController } from "./member-lists.controller";
import { MemberListsService } from "./member-lists.service";

@Module({
  imports: [
    TypeOrmModule.forFeature([MemberList, MemberListVersion, MemberListMember]),
  ],
  controllers: [MemberListsController],
  providers: [MemberListsService],
})
export class MemberListsModule {}
