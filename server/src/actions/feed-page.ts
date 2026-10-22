import { BadRequestException } from "@nestjs/common";

const DEFAULT_FEED_LIMIT = 20;

export function parseFeedPage(query: { limit?: string; before?: string }): {
  limit: number;
  before: Date | undefined;
} {
  const before = query.before ? new Date(query.before) : undefined;
  if (before && isNaN(before.getTime())) {
    throw new BadRequestException('Invalid "before" cursor');
  }
  return {
    limit: query.limit ? parseInt(query.limit) : DEFAULT_FEED_LIMIT,
    before,
  };
}
