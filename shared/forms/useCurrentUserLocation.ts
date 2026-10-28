import { type CityFieldValue } from "@alliance/common/forms/form-schema";
import { type UserDto } from "../client";
import { useMyLocation } from "../lib/useMyLocation";

/** The signed-in user's stored city, for a `userLocation` display block. */
export function useCurrentUserLocation(args: {
  enabled: boolean;
  user: Pick<UserDto, "id" | "customCityString"> | null | undefined;
}): {
  currentUserLocationLoading: boolean;
  userLocationDisplayValue: CityFieldValue | string | null;
} {
  const { enabled, user } = args;
  const location = useMyLocation(enabled ? user?.id : undefined);

  return {
    currentUserLocationLoading: location.isLoading,
    userLocationDisplayValue: location.data ?? user?.customCityString ?? null,
  };
}
