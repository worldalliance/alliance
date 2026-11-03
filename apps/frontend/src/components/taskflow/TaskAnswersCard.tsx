import { type UserDto } from "@alliance/shared/client";
import { formatUserLocationDisplayValue } from "@alliance/shared/formrenderer";
import { useCurrentUserLocation } from "@alliance/shared/forms/useCurrentUserLocation";
import { cn } from "@alliance/shared/styles/util";
import {
  useOutputItems,
  type OutputSource,
} from "@alliance/shared/useOutputItems";
import { OutputRenderer } from "@alliance/sharedweb/forms/OutputRenderer";
import { AvatarProfile } from "@alliance/sharedweb/ui/Avatar";
import { type ComponentProps } from "react";

/** The member's own answers through the form's output view; nothing when it shows nothing. */
export default function TaskAnswersCard({
  output,
  user,
  className,
  ...props
}: ComponentProps<"div"> & {
  output: Omit<OutputSource, "ownView">;
  user: UserDto | undefined;
}) {
  const source = { ...output, ownView: true };
  const outputItems = useOutputItems(source);
  const { userLocationDisplayValue } = useCurrentUserLocation({
    enabled: !!user && outputItems.length > 0,
    user,
  });
  const location = formatUserLocationDisplayValue(userLocationDisplayValue);
  if (outputItems.length === 0) return null;

  return (
    <div
      className={cn("flex flex-col gap-y-4 rounded-md bg-white p-6", className)}
      {...props}
    >
      {user ? (
        <div className="flex items-center gap-x-3">
          <AvatarProfile
            pfp={user.profilePicture}
            size="medium"
            alt={user.name}
          />
          <div className="flex-1">
            <p className="text-base font-semibold text-zinc-900">{user.name}</p>
            {location ? (
              <p className="text-base text-zinc-500">{location}</p>
            ) : null}
          </div>
        </div>
      ) : null}
      <OutputRenderer {...source} />
    </div>
  );
}
