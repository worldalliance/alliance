import { R } from "@alliance/common/result";
import {
  Body,
  Controller,
  DefaultValuePipe,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseBoolPipe,
  ParseIntPipe,
  Patch,
  Post,
  Put,
  Query,
  Request,
  UnauthorizedException,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse, ApiUnauthorizedResponse } from "@nestjs/swagger";
import { IsNotEmpty, IsString } from "class-validator";
import { AdminGuard } from "src/auth/guards/admin.guard";
import type { JwtRequest } from "src/auth/tokens";
import { MaybeUserLocationDto } from "src/geo/city.dto";
import { AuthGuard } from "../auth/guards/auth.guard";
import { Public } from "../auth/public.decorator";
import { AccountDeletionService } from "./account-deletion.service";
import { AccountEmailService } from "./account-email.service";
import { AmbassadorInviteGoalService } from "./ambassador-invite-goal.service";
import { AmbassadorProgramService } from "./ambassador-program.service";
import {
  AmbassadorInviteDashboardDto,
  AmbassadorInviteGoalDto,
  CreateAmbassadorInviteGoalDto,
  UpdateAmbassadorInviteGoalDto,
} from "./dto/ambassador-invite.dto";
import {
  AmbassadorProgramDashboardDto,
  AmbassadorProgramMemberDto,
  CreateAmbassadorProgramInteractionDto,
  UpdateAmbassadorProgramMemberDto,
  UpsertAmbassadorProgramMemberDto,
} from "./dto/ambassador-program.dto";
import {
  DeleteUserAdminDto,
  UpdateUserRolesAdminDto,
  UserAdminDetailDto,
} from "./dto/user-admin.dto";
import {
  MyVisibilityContextDto,
  NMembersResponseDto,
  ProfileDto,
  ProfileDtoWithFriends,
  StaffDirectoryEntryDto,
  UpdateProfileDto,
  UpdateStaffDirectoryDto,
  UserCityCountDto,
  UserDto,
} from "./dto/user.dto";
import { FriendService } from "./friend.service";
import { UserAdminService } from "./user-admin.service";
import { UserDirectoryService } from "./user-directory.service";
import { UserVisibilityContextService } from "./user-visibility-context.service";
import { UserService } from "./user.service";

class VerifyEmailBody {
  @IsString()
  @IsNotEmpty()
  token: string;
}

@Controller("user")
export class UserController {
  constructor(
    private readonly userService: UserService,
    private readonly userDirectoryService: UserDirectoryService,
    private readonly accountEmailService: AccountEmailService,
    private readonly userAdminService: UserAdminService,
    private readonly accountDeletionService: AccountDeletionService,
    private readonly userVisibilityContextService: UserVisibilityContextService,
    private readonly ambassadorProgramService: AmbassadorProgramService,
    private readonly ambassadorInviteGoalService: AmbassadorInviteGoalService,
    private readonly friendService: FriendService,
  ) {}

  @Get("me")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  async findMe(@Request() req: JwtRequest): Promise<ProfileDto> {
    const profile = await this.userService.findOne(req.user.sub);
    if (!profile) {
      throw new UnauthorizedException();
    }
    return new ProfileDto(profile);
  }

  @Post("update")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  async update(
    @Body() updateActionDto: UpdateProfileDto,
    @Request() req: JwtRequest,
  ): Promise<ProfileDto> {
    return new ProfileDto(
      await this.userService.update(req.user.sub, updateActionDto),
    );
  }

  @Post("switch-domain")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ description: "Opted in to the new domain" })
  @ApiUnauthorizedResponse()
  async switchDomain(@Request() req: JwtRequest): Promise<void> {
    await this.userService.markDomainSwitched(req.user.sub);
  }

  @Get("mylocation")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MaybeUserLocationDto })
  async myLocation(@Request() req: JwtRequest): Promise<MaybeUserLocationDto> {
    const city = await this.userService.getUserLocation(req.user.sub);
    return new MaybeUserLocationDto(city);
  }

  @Get("myvisibilitycontext")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: MyVisibilityContextDto })
  async myVisibilityContext(
    @Request() req: JwtRequest,
  ): Promise<MyVisibilityContextDto> {
    return new MyVisibilityContextDto(
      await this.userVisibilityContextService.getVisibilityContext(
        req.user.sub,
      ),
    );
  }

  @Get("listMessageableUsers")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async listMessageableUsers(
    @Request() req: JwtRequest,
  ): Promise<ProfileDto[]> {
    if (!req.user) {
      throw new UnauthorizedException("User not found");
    }
    return (
      await this.userDirectoryService.findMessageableUsers(req.user.sub)
    ).map((user) => new ProfileDto(user));
  }

  @Get("list")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listAdmin(): Promise<UserDto[]> {
    return (await this.userAdminService.findAllForAdminList()).map(
      (user) => new UserDto(user),
    );
  }

  @Get("list-graph")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listForGraphAdmin(): Promise<UserDto[]> {
    return (
      await this.userService.findAll({
        contractEvents: true,
        communities: true,
        tags: true,
      })
    ).map((user) => new UserDto(user));
  }

  @Get("cityCounts")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [UserCityCountDto] })
  async cityCountsAdmin(): Promise<UserCityCountDto[]> {
    return (await this.userDirectoryService.getUserCityCounts()).map(
      (c) => new UserCityCountDto(c),
    );
  }

  @Get("userdetail/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAdminDetailDto })
  async userDetailAdmin(
    @Param("id", ParseIntPipe) id: number,
  ): Promise<UserAdminDetailDto> {
    const user = await this.userAdminService.findAdminDetail(id);
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return new UserAdminDetailDto(user);
  }

  @Patch("userdetail/:id/roles")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserAdminDetailDto })
  async updateUserRolesAdmin(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: UpdateUserRolesAdminDto,
  ): Promise<UserAdminDetailDto> {
    return new UserAdminDetailDto(
      await this.userAdminService.updateRolesAdmin({
        id,
        actorId: req.user.sub,
        roles: body,
      }),
    );
  }

  @Delete("userdetail/:id")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteUserAdmin(
    @Request() req: JwtRequest,
    @Param("id", ParseIntPipe) id: number,
    @Body() body: DeleteUserAdminDto,
  ): Promise<void> {
    await this.accountDeletionService.deleteUserAdmin({
      userId: id,
      adminId: req.user.sub,
      reason: body.reason,
      confirmationEmail: body.confirmationEmail,
      screenshotKey: body.screenshotKey,
    });
  }

  @Get("list-public")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: UserDto, isArray: true })
  async listPublicAdmin(): Promise<UserDto[]> {
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new UserDto(user),
    );
  }

  @Get("members")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDto] })
  async members(): Promise<ProfileDto[]> {
    return (await this.userService.findAll({ contractEvents: true })).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get("members-public")
  @Public()
  @ApiOkResponse({ type: [ProfileDto] })
  async membersPublic(): Promise<ProfileDto[]> {
    return (await this.userDirectoryService.findAllMembersPublic()).map(
      (user) => new ProfileDto(user),
    );
  }

  @Get("staff-directory")
  @Public()
  @ApiOkResponse({ type: [StaffDirectoryEntryDto] })
  async staffDirectory(): Promise<StaffDirectoryEntryDto[]> {
    return (await this.userDirectoryService.findStaffDirectory()).map(
      (user) => new StaffDirectoryEntryDto(user),
    );
  }

  @Get("staff-directory-admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [StaffDirectoryEntryDto] })
  async staffDirectoryAdmin(): Promise<StaffDirectoryEntryDto[]> {
    return (await this.userDirectoryService.findStaffDirectory()).map(
      (user) => new StaffDirectoryEntryDto(user),
    );
  }

  @Put("staff-directory-admin")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [StaffDirectoryEntryDto] })
  async updateStaffDirectoryAdmin(
    @Body() body: UpdateStaffDirectoryDto,
  ): Promise<StaffDirectoryEntryDto[]> {
    return (
      await this.userDirectoryService.updateStaffDirectory(body.items)
    ).map((user) => new StaffDirectoryEntryDto(user));
  }

  @Get("membersWithFriends")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [ProfileDtoWithFriends] })
  async membersWithFriends(
    @Query("requireSignedContract", new DefaultValuePipe(false), ParseBoolPipe)
    requireSignedContract: boolean,
  ): Promise<ProfileDtoWithFriends[]> {
    const [users, friendIdsByUserId] = await Promise.all([
      this.userService.findAll({ contractEvents: true }),
      this.friendService.findAcceptedFriendIdsByUserId(),
    ]);

    const members = requireSignedContract
      ? users.filter((user) => user.hasActiveContract)
      : users;

    return members.map(
      (user) =>
        new ProfileDtoWithFriends(user, friendIdsByUserId.get(user.id) ?? []),
    );
  }

  @Get("myprofile")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: ProfileDto })
  async myProfile(@Request() req: JwtRequest): Promise<ProfileDto> {
    const user = await this.userService.findOne(req.user.sub, {
      contractEvents: true,
    });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return new ProfileDto(user);
  }

  @Get("slug/:id")
  @Public()
  @ApiOkResponse({ type: ProfileDto })
  @ApiUnauthorizedResponse()
  async findOne(@Param("id", ParseIntPipe) id: number): Promise<ProfileDto> {
    const user = await this.userService.findOne(id, { contractEvents: true });
    if (!user) {
      throw new NotFoundException("User not found");
    }
    return new ProfileDto(user);
  }

  @Post("verifyEmail")
  @Public()
  @ApiOkResponse()
  async verifyEmail(@Body() body: VerifyEmailBody): Promise<void> {
    return this.accountEmailService.verifyEmail(body.token);
  }

  @Post("nmembers")
  @Public()
  @ApiOkResponse({ type: NMembersResponseDto })
  async nmembers(): Promise<NMembersResponseDto> {
    return new NMembersResponseDto(await this.userService.signedMembersCount());
  }

  @Get("ambassadorProgram")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramDashboardDto })
  async getAmbassadorProgramAdmin(): Promise<AmbassadorProgramDashboardDto> {
    return new AmbassadorProgramDashboardDto(
      await this.ambassadorProgramService.getAmbassadorProgramDashboard(),
    );
  }

  @Post("ambassadorProgram/member")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramMemberDto })
  async upsertAmbassadorProgramMemberAdmin(
    @Body() body: UpsertAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMemberDto> {
    return new AmbassadorProgramMemberDto(
      await this.ambassadorProgramService.upsertAmbassadorProgramMember(body),
    );
  }

  @Patch("ambassadorProgram/member/:userId")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramMemberDto })
  async updateAmbassadorProgramMemberAdmin(
    @Param("userId", ParseIntPipe) userId: number,
    @Body() body: UpdateAmbassadorProgramMemberDto,
  ): Promise<AmbassadorProgramMemberDto> {
    return new AmbassadorProgramMemberDto(
      await this.ambassadorProgramService.updateAmbassadorProgramMember(
        userId,
        body,
      ),
    );
  }

  @Post("ambassadorProgram/interaction")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: AmbassadorProgramMemberDto })
  async createAmbassadorProgramInteractionAdmin(
    @Body() body: CreateAmbassadorProgramInteractionDto,
    @Request() req: JwtRequest,
  ): Promise<AmbassadorProgramMemberDto> {
    return new AmbassadorProgramMemberDto(
      await this.ambassadorProgramService.createAmbassadorProgramInteraction(
        body,
        req.user.sub,
      ),
    );
  }

  @Get("ambassadorInvites/dashboard")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AmbassadorInviteDashboardDto })
  async getAmbassadorInviteDashboard(
    @Request() req: JwtRequest,
  ): Promise<AmbassadorInviteDashboardDto> {
    return new AmbassadorInviteDashboardDto(
      await this.ambassadorInviteGoalService.getAmbassadorInviteDashboard(
        req.user.sub,
      ),
    );
  }

  @Post("ambassadorInvites/goal")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AmbassadorInviteGoalDto })
  async createAmbassadorInviteGoal(
    @Body() body: CreateAmbassadorInviteGoalDto,
    @Request() req: JwtRequest,
  ): Promise<AmbassadorInviteGoalDto> {
    return new AmbassadorInviteGoalDto(
      await this.ambassadorInviteGoalService.createAmbassadorInviteGoal(
        body,
        req.user.sub,
      ),
    );
  }

  @Patch("ambassadorInvites/goal/:goalId")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: AmbassadorInviteGoalDto })
  async updateAmbassadorInviteGoal(
    @Param("goalId", ParseIntPipe) goalId: number,
    @Body() body: UpdateAmbassadorInviteGoalDto,
    @Request() req: JwtRequest,
  ): Promise<AmbassadorInviteGoalDto> {
    return new AmbassadorInviteGoalDto(
      await this.ambassadorInviteGoalService.updateAmbassadorInviteGoal(
        goalId,
        body,
        req.user.sub,
      ),
    );
  }

  @Delete("ambassadorInvites/goal/:goalId")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async deleteAmbassadorInviteGoal(
    @Param("goalId", ParseIntPipe) goalId: number,
    @Request() req: JwtRequest,
  ): Promise<void> {
    await this.ambassadorInviteGoalService.deleteAmbassadorInviteGoal(
      goalId,
      req.user.sub,
    );
  }

  @Post("requestAccountDeletion")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async requestAccountDeletion(@Request() req: JwtRequest): Promise<void> {
    R.unwrap(
      await this.accountDeletionService.requestAccountDeletion(req.user.sub),
    );
  }
}
