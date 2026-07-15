import type { PaginatedList } from '@alliance/common/pagination';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, Max, Min } from 'class-validator';

export type { PaginatedList } from '@alliance/common/pagination';

export class PaginationQueryDto {
  @ApiPropertyOptional({ default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ default: 50, maximum: 200 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  limit?: number = 50;
}

/**
 * Mixin factory for paginated response DTOs. Subclass it to name the schema:
 *
 * ```ts
 * export class ThingListDto extends PaginatedListDto(ThingDto) {}
 * ```
 *
 * The service returns `PaginatedList<Thing>` (raw entities); the DTO wraps
 * each item in `ItemDto`.
 */
export function PaginatedListDto<TInput, TItemDto>(
  ItemDto: new (input: TInput) => TItemDto,
) {
  class PaginatedListDtoBase {
    @ApiProperty({ type: () => ItemDto, isArray: true })
    items: TItemDto[];

    @ApiProperty()
    totalCount: number;

    @ApiProperty()
    page: number;

    @ApiProperty()
    limit: number;

    @ApiProperty()
    totalPages: number;

    constructor(input: PaginatedList<TInput>) {
      this.items = input.items.map((item) => new ItemDto(item));
      this.totalCount = input.totalCount;
      this.page = input.page;
      this.limit = input.limit;
      this.totalPages = input.totalPages;
    }
  }
  return PaginatedListDtoBase;
}
