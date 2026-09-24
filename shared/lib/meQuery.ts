import { queryOptions } from "@tanstack/react-query";
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
