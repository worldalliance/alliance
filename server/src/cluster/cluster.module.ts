import { Module } from "@nestjs/common";
import { TypeOrmModule } from "@nestjs/typeorm";
import { User } from "src/user/entities/user.entity";
import { ClusterController } from "./cluster.controller";
import { ClusterService } from "./cluster.service";
import { Cluster } from "./entities/cluster.entity";

@Module({
  imports: [TypeOrmModule.forFeature([Cluster, User])],
  controllers: [ClusterController],
  providers: [ClusterService],
  exports: [ClusterService],
})
export class ClusterModule {}
