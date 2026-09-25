import {
  applyDecorators,
  DefaultValuePipe,
  ParseBoolPipe,
  Query,
} from "@nestjs/common";
import { ApiQuery, ApiResponse } from "@nestjs/swagger";

const QUERY_NAME = "acknowledgeDeadlineShortening";

/** Documents the 409 a schedule edit returns until staff acknowledge it. */
export const ApiAcknowledgeDeadlineShortening = () =>
  applyDecorators(
    ApiQuery({ name: QUERY_NAME, required: false, type: Boolean }),
    ApiResponse({
      status: 409,
      description: `Moves the member-action deadline earlier for assigned members; resend with ${QUERY_NAME}=true.`,
    }),
  );

export const AcknowledgeDeadlineShortening = () =>
  Query(QUERY_NAME, new DefaultValuePipe(false), ParseBoolPipe);
