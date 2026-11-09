import { echoesStoredKey } from "@alliance/common/image-src";
import type { Logger } from "@nestjs/common";
import { renderedImageKey } from "src/images/images.service";
import type { CreateActionDto, UpdateActionDto } from "./dto/action.dto";
import type { Action } from "./entities/action.entity";

/**
 * A new action has no stored value to compare against, so a url counts as one
 * this api rendered only when it renders back to itself. Keeping the key it
 * names rather than dropping the field is what a duplicate wants, since the
 * copy then points at the same upload as the original.
 */
export function rewriteRenderedImages(
  next: Pick<CreateActionDto, "image" | "squareThumbnailImage">,
  logger: Logger,
): void {
  for (const column of ["image", "squareThumbnailImage"] as const) {
    const value = next[column];
    if (typeof value !== "string") {
      continue;
    }
    const key = renderedImageKey(value);
    if (key) {
      logger.warn(
        `Rewrote an action ${column} url back to its upload key: ${value.slice(0, 100)}`,
      );
      next[column] = key;
    }
  }
}

/**
 * Both image columns are served as urls, so an editor seeded from the api
 * sends one back on its next save. Dropping the echo keeps the upload key,
 * which renders correctly in every environment.
 */
export function dropEchoedImages(params: {
  next: Pick<UpdateActionDto, "image" | "squareThumbnailImage">;
  stored: Partial<Pick<Action, "image" | "squareThumbnailImage">>;
  logger: Logger;
}): void {
  const { next, stored, logger } = params;
  for (const column of ["image", "squareThumbnailImage"] as const) {
    const value = next[column];
    // null clears the column, so only a string can be an echo.
    if (typeof value !== "string") {
      continue;
    }
    if (echoesStoredKey({ next: value, stored: stored[column] })) {
      logger.warn(
        `Ignored an action ${column} that echoes the stored key: ${value.slice(0, 100)}`,
      );
      delete next[column];
    }
  }
}
