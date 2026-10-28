import { useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { type UpdateProfileDto } from "../client";
import { meCache } from "./useMe";
import { myLocationCache } from "./useMyLocation";
import type { SettingsAutosaveState } from "./useSettingsAutosave";

/**
 * Loads the settings form from the server once per member, and reports whether
 * that first load is still in flight.
 */
export function useSeedSettingsForm(params: {
  user: (UpdateProfileDto & { id: number }) | undefined;
  setSavedProfile: SettingsAutosaveState["setSavedProfile"];
}): boolean {
  const { user, setSavedProfile } = params;
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(true);
  // refreshUser hands back a new user object, and re-seeding the form off it
  // would drop whatever the member has typed and not yet saved.
  const seededForUserId = useRef<number | null>(null);

  useEffect(() => {
    if (!user || seededForUserId.current === user.id) {
      return;
    }
    seededForUserId.current = user.id;

    const load = () => meCache(queryClient).fetch();
    const seeded = load()
      // A load already in flight for the previous member answers for them.
      .then((me) => (me.user.id === user.id ? me : load()))
      .then((me) => {
        setSavedProfile(me.user);
      })
      .catch((error: unknown) => {
        console.error("failed to load the settings form", error);
      });

    // A failed profile load still gets a form when the location arrives, so
    // loading spans both requests.
    const located = myLocationCache(queryClient)
      .fetch(user.id)
      .then((city) => {
        if (city) {
          const cityId = city.id;
          setSavedProfile((prev) =>
            prev ? { ...prev, cityId } : { ...user, cityId },
          );
        }
      })
      .catch((error: unknown) => {
        console.error("failed to load the settings location", error);
      });

    Promise.all([seeded, located]).finally(() => {
      setLoading(false);
    });
  }, [user, setSavedProfile, queryClient]);

  return loading;
}
