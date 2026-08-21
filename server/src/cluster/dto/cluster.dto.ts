import { ApiProperty, ApiPropertyOptional, PickType } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { getImageSource } from "src/images/images.service";
import { User } from "src/user/entities/user.entity";
import type { ClusterAssignResult } from "../cluster.service";
import { Cluster } from "../entities/cluster.entity";

export class ClusterSummaryDto extends PickType(Cluster, [
  "id",
  "displayName",
]) {
  constructor(cluster: Pick<Cluster, "id" | "displayName">) {
    super();
    this.id = cluster.id;
    this.displayName = cluster.displayName;
  }
}

export class ClusterMemberDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  displayName: string;

  @ApiPropertyOptional()
  profilePicture?: string;

  constructor(
    user: Pick<User, "id" | "name" | "anonymous" | "profilePicture">,
  ) {
    this.id = user.id;
    this.displayName = user.anonymous ? "Someone" : user.name;
    if (user.profilePicture) {
      this.profilePicture = getImageSource(user.profilePicture);
    }
  }
}

export class ClusterAdminDto extends PickType(Cluster, [
  "id",
  "displayName",
  "createdAt",
  "updatedAt",
]) {
  @ApiProperty({ type: ClusterMemberDto, isArray: true })
  members: ClusterMemberDto[];

  constructor(cluster: Cluster) {
    super();
    this.id = cluster.id;
    this.displayName = cluster.displayName;
    this.createdAt = cluster.createdAt;
    this.updatedAt = cluster.updatedAt;
    this.members = (cluster.members ?? []).map((m) => new ClusterMemberDto(m));
  }
}

export class UpdateClusterDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  displayName: string;
}

export class ReassignAllClustersResultDto {
  @ApiProperty()
  clustersCreated: number;

  @ApiProperty()
  usersAssigned: number;

  constructor(input: ClusterAssignResult) {
    this.clustersCreated = input.clustersCreated;
    this.usersAssigned = input.usersAssigned;
  }
}
