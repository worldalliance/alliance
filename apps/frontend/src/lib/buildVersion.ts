import { z } from "zod";

export const BUILD_VERSION_PATH = "/build-version";

export const buildVersionSchema = z.object({ sha: z.string().nullable() });
