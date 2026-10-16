import { Body, Controller, Post, Request, UseGuards } from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import { AuthGuard } from "../auth/guards/auth.guard";
import { AssignGroupsDto, UserDto } from "./dto/user.dto";
import { UserService } from "./user.service";

@Controller("user")
export class UserGroupAssignmentController {
  constructor(private readonly userService: UserService) {}

  @Post("groupAssignment/join")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async joinGroupAssignment(@Request() req: JwtRequest): Promise<void> {
    await this.userService.joinGroupAssignment(req.user.sub);
  }

  @Post("groupAssignment/leave")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async leaveGroupAssignment(@Request() req: JwtRequest): Promise<void> {
    await this.userService.leaveGroupAssignment(req.user.sub);
  }

  @Post("groupAssignment/members")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async getGroupAssignmentMembersAdmin(): Promise<UserDto[]> {
    return (await this.userService.findGroupAssignmentMembers()).map(
      (user) => new UserDto(user),
    );
  }

  @Post("groupAssignment/assign")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async assignGroupsAdmin(@Body() body: AssignGroupsDto): Promise<void> {
    await this.userService.assignGroupsAdmin(body);
  }
}
