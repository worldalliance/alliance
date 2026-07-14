import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

// Longer URLs exist in the wild, but browsers and CDNs commonly cap around
// here — and every accepted URL becomes a cache key held for up to an hour,
// so the boundary belongs at validation, not the cache.
const MAX_URL_LENGTH = 2048;

export class LinkPreviewQueryDto {
  @ApiProperty({ maxLength: MAX_URL_LENGTH })
  @IsString()
  @IsNotEmpty()
  @MaxLength(MAX_URL_LENGTH)
  url: string;
}

export type LinkPreview = {
  url: string;
  title: string | null;
  description: string | null;
  siteName: string | null;
  /** Site favicon inlined as a `data:` URI (raster formats only, ≤32KB). */
  faviconDataUri: string | null;
};

export class LinkPreviewDto {
  @ApiProperty() url: string;
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() description?: string;
  @ApiPropertyOptional() siteName?: string;
  @ApiPropertyOptional() faviconDataUri?: string;

  constructor(input: LinkPreview) {
    this.url = input.url;
    this.title = input.title ?? undefined;
    this.description = input.description ?? undefined;
    this.siteName = input.siteName ?? undefined;
    this.faviconDataUri = input.faviconDataUri ?? undefined;
  }
}
