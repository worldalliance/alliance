import type { OpenAPIObject } from "@nestjs/swagger";

const API_ERROR_SCHEMA_NAME = "HeyApiError";

const API_ERROR_REF = {
  $ref: `#/components/schemas/${API_ERROR_SCHEMA_NAME}`,
} as const;

/**
 * Schema for an endpoint that returns no body. `additionalProperties: false`
 * makes hey-api generate `{ [key: string]: never }` — the tightest "empty
 * object" type, which matches what `@hey-api/client-fetch` actually produces
 * at runtime for an empty response body (an empty object, not `undefined`).
 */
const EMPTY_OBJECT_SCHEMA = {
  type: "object",
  additionalProperties: false,
} as const;

const HTTP_METHODS = [
  "get",
  "post",
  "put",
  "delete",
  "patch",
  "options",
  "head",
  "trace",
] as const;

function isSuccessStatus(status: string): boolean {
  const code = Number(status);
  return code >= 200 && code < 300;
}

/**
 * Post-processes the generated OpenAPI document so hey-api emits useful types
 * instead of `unknown`:
 *
 * 1. Errors — NestJS serializes thrown `HttpException`s to a consistent body
 *    (`{ statusCode, message, error? }`), but our `@ApiResponse` decorators
 *    rarely declare a schema for it, so every `.error` would be `unknown`. We
 *    attach a shared `HeyApiError` schema to every error response (status >= 400
 *    or `default`) and add a `default` error response to operations declaring
 *    none.
 *
 * 2. Empty success bodies — a void handler (`@ApiOkResponse()` with no `type`)
 *    yields a 2xx response with no content, which hey-api types as `unknown`. We
 *    attach an empty-object schema so `.data` is typed as `{ [key: string]:
 *    never }` (matching the empty object client-fetch returns at runtime).
 */
export function injectResponseSchemas(document: OpenAPIObject): OpenAPIObject {
  document.components ??= {};
  document.components.schemas ??= {};
  document.components.schemas[API_ERROR_SCHEMA_NAME] = {
    type: "object",
    properties: {
      statusCode: { type: "number" },
      message: {
        oneOf: [
          { type: "string" },
          { type: "array", items: { type: "string" } },
        ],
      },
      error: { type: "string" },
    },
    required: ["statusCode", "message"],
  };

  for (const pathItem of Object.values(document.paths ?? {})) {
    for (const method of HTTP_METHODS) {
      const operation = pathItem[method];
      if (!operation?.responses) continue;

      const responses = operation.responses;
      let hasErrorResponse = false;

      for (const [status, response] of Object.entries(responses)) {
        if (!response) continue;
        // Leave $ref responses and ones that already declare a body untouched.
        if ("$ref" in response || response.content) {
          if (status === "default" || Number(status) >= 400) {
            hasErrorResponse = true;
          }
          continue;
        }

        if (status === "default" || Number(status) >= 400) {
          hasErrorResponse = true;
          response.content = {
            "application/json": { schema: { ...API_ERROR_REF } },
          };
        } else if (isSuccessStatus(status)) {
          // Void endpoint: empty success body.
          response.content = {
            "application/json": { schema: { ...EMPTY_OBJECT_SCHEMA } },
          };
        }
      }

      if (!hasErrorResponse) {
        responses.default = {
          description: "Default error response for hey-api",
          content: { "application/json": { schema: { ...API_ERROR_REF } } },
        };
      }
    }
  }

  return document;
}
