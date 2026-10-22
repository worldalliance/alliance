import { Global, Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { SessionService } from "./session.service";

@Global()
@Module({
  imports: [TypeOrmModule.forFeature([User])],
  providers: [SessionService],
  exports: [SessionService],
})
export class SessionModule {}
