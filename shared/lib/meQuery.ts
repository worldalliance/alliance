import { queryOptions } from "@tanstack/react-query";
// eslint-disable-next-line api-client/named-hooks-only -- the queryOptions in this file own this call
import { authMe, type UserDto } from "../client";

export async function fetchMe(): Promise<UserDto> {
  const response = await authMe();
  if (!response.data) {
    throw response.error;
  }
  return response.data.user;
}

export const meQuery = queryOptions({
  queryKey: ["authMe"],
  queryFn: fetchMe,
});
