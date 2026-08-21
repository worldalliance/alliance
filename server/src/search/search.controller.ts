import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Request,
  UseGuards,
} from "@nestjs/common";
import { ApiOkResponse } from "@nestjs/swagger";
import { AuthGuard } from "src/auth/guards/auth.guard";
import type { JwtRequest } from "src/auth/guards/jwtreq";
import { SearchService } from "./search.service";
import { SaveSearchSelectionDto, SearchItemDto } from "./searchitem.dto";

@Controller("search")
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get("all")
  @UseGuards(AuthGuard)
  @ApiOkResponse({ type: [SearchItemDto] })
  async all(
    @Query("query") query: string,
    @Request() req: JwtRequest,
  ): Promise<SearchItemDto[]> {
    const items = await this.searchService.search(query, req.user.sub);
    return items.map((item) => new SearchItemDto(item));
  }

  @Post("selected")
  @UseGuards(AuthGuard)
  @ApiOkResponse()
  async saveSelected(
    @Body() body: SaveSearchSelectionDto,
    @Request() req: JwtRequest,
  ): Promise<void> {
    return this.searchService.saveSelected(body, req.user.sub);
  }
}
