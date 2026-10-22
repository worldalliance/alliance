import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AdminGuard } from "src/auth/guards/admin.guard";
import {
  AddUserToTagDto,
  CreateTagDto,
  TagDto,
  TagSummaryDto,
} from "./dto/tag.dto";
import { TagService } from "./tag.service";

@Controller("user")
export class UserTagController {
  constructor(private readonly tagService: TagService) {}

  @Post("createTag")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async createTagAdmin(@Body() body: CreateTagDto): Promise<TagDto> {
    return new TagDto(await this.tagService.createTag(body));
  }

  @Get("tags")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TagDto] })
  async getTagsAdmin(): Promise<TagDto[]> {
    return (await this.tagService.findAllTags()).map((tag) => new TagDto(tag));
  }

  @Get("tag-summaries")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: [TagSummaryDto] })
  async getTagSummariesAdmin(): Promise<TagSummaryDto[]> {
    return (await this.tagService.findAllTagSummaries()).map(
      (tag) => new TagSummaryDto(tag),
    );
  }

  @Post("tags/:tagId/addUser")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async addUserToTagAdmin(
    @Param("tagId") tagId: string,
    @Body() body: AddUserToTagDto,
  ): Promise<TagDto> {
    return new TagDto(await this.tagService.addUserToTag(tagId, body.userId));
  }

  @Post("tags/:tagId/removeUser")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async removeUserFromTagAdmin(
    @Param("tagId") tagId: string,
    @Body() body: AddUserToTagDto,
  ): Promise<TagDto> {
    return new TagDto(
      await this.tagService.removeUserFromTag(tagId, body.userId),
    );
  }

  @Post("tags/:tagId/update")
  @UseGuards(AdminGuard)
  @ApiOkResponse({ type: TagDto })
  async updateTagAdmin(
    @Param("tagId") tagId: string,
    @Body() body: CreateTagDto,
  ): Promise<TagDto> {
    return new TagDto(await this.tagService.updateTag(tagId, body));
  }

  @Delete("tags/:tagId")
  @UseGuards(AdminGuard)
  @ApiOkResponse()
  async deleteTagAdmin(@Param("tagId") tagId: string): Promise<void> {
    await this.tagService.deleteTag(tagId);
  }
}
