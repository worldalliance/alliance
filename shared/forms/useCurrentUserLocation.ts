import { type CityFieldValue } from "@alliance/common/forms/form-schema";
import { useEffect, useState } from "react";
import { userMyLocation, type UserDto } from "../client";

/** The signed-in user's stored city, for a `userLocation` display block. */
export function useCurrentUserLocation(args: {
  enabled: boolean;
  user: Pick<UserDto, "id" | "customCityString"> | null | undefined;
}): {
  currentUserLocationLoading: boolean;
  userLocationDisplayValue: CityFieldValue | string | null;
} {
  const { enabled, user } = args;
  const [currentUserLocation, setCurrentUserLocation] =
    useState<CityFieldValue | null>(null);
  const [currentUserLocationLoading, setCurrentUserLocationLoading] =
    useState(false);

  useEffect(() => {
    if (!enabled || !user) {
      setCurrentUserLocation(null);
      setCurrentUserLocationLoading(false);
      return;
    }

    let cancelled = false;
    setCurrentUserLocation(null);
    setCurrentUserLocationLoading(true);

    userMyLocation()
      .then((response) => {
        if (cancelled) return;
        setCurrentUserLocation(response.data?.city ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        setCurrentUserLocation(null);
      })
      .finally(() => {
        if (cancelled) return;
        setCurrentUserLocationLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [enabled, user?.id, user]);

  return {
    currentUserLocationLoading,
    userLocationDisplayValue:
      currentUserLocation ?? user?.customCityString ?? null,
  };
}
