import { useCallback, useEffect, useMemo, useState } from "react";
import { useLoaderData, useParams } from "react-router";
import Card, { CardStyle } from "../../components/system/Card";
import StatsCard from "../../components/StatsCard";
import Globe from "../../components/Globe";
import {
  actionsFindOne,
  actionsJoin,
  actionsMyStatus,
  actionsUserLocations,
  LatLonDto,
} from "@alliance/shared/client";
import { ActionDto, UserActionDto } from "@alliance/shared/client";
import { getImageSource, isFeatureEnabled } from "../../lib/config";
import ActionForumPosts from "../../components/ActionForumPosts";
import TwoColumnSplit from "../../components/system/TwoColumnSplit";
import { Features } from "@alliance/shared/lib/features";
import ActionEventsPanel from "../../components/ActionEventsPanel";
import { Route } from "../../../.react-router/types/src/pages/app/+types/ActionPage";
import { useAuth } from "../../lib/AuthContext";
import ActionTaskPanel from "../../components/ActionTaskPanel";
import ActionCommitButton from "../../components/ActionCommitButton";

export async function loader({
  params,
}: Route.LoaderArgs): Promise<
  (ActionDto & { locations: LatLonDto[] }) | undefined
> {
  if (!params.id || isNaN(parseInt(params.id))) {
    return undefined;
  }
  const action = await actionsFindOne({
    path: { id: parseInt(params.id) },
  });

  const locations = await actionsUserLocations({
    path: { id: parseInt(params.id) },
  });
  if (!action.data) {
    return undefined;
  }

  console.log("locations", locations);

  return { ...action.data, locations: locations.data || [] };
}

export default function ActionPage() {
  const { id } = useParams();

  const action = useLoaderData<typeof loader>();

  const [error, setError] = useState<string | null>(null);

  const [userRelation, setUserRelation] = useState<
    UserActionDto["status"] | null
  >(null);

  const { isAuthenticated } = useAuth();

  useEffect(() => {
    if (isAuthenticated && id) {
      actionsMyStatus({
        path: { id },
      }).then((response) => {
        console.log("userStatusResponse", response);
        if (response.error) {
          console.error("Failed to fetch user status", response.error);
          setError("Failed to fetch user status");
        }
        if (response.data) {
          setUserRelation(response.data.status);
        }
      });
    }
  }, [isAuthenticated, id]);

  const onJoinAction = useCallback(async () => {
    if (!id) return;

    try {
      const response = await actionsJoin({
        path: { id },
      });

      if (response.error) {
        throw new Error("Failed to join action");
      } else {
        setUserRelation("joined");
      }
    } catch (err) {
      console.error("Error joining action:", err);
      setError("Failed to join this action. Please try again later.");
    }
  }, [id]);

  //   const evtSource = new EventSource(`${getApiUrl()}/actions/live/${actionId}`);
  //   evtSource.onmessage = (e) => {
  //     const newUserCount = Number(e.data);
  //     if (newUserCount !== action?.usersJoined && action) {
  //       setAction({ ...action, usersJoined: newUserCount });
  //     }
  //   };

  const mainContent = useMemo(
    () => (
      <div className="flex flex-col gap-y-3 flex-2 p-10 px-15">
        {action?.image && (
          <img
            src={getImageSource(action.image)}
            alt={action.name}
            className="w-full h-auto rounded-md border border-gray-300 max-h-[200px] object-cover"
          />
        )}
        <div className="flex flex-row justify-between items-start my-5">
          <div className="flex flex-col gap-y-3">
            <h1 className="">{action?.name}</h1>
          </div>
          <ActionCommitButton
            committed={userRelation === "joined"}
            isAuthenticated={isAuthenticated}
            onCommit={onJoinAction}
          />
        </div>
        {error && <div className="text-red-500">{error}</div>}
        {/* {userRelation === "joined" && <PokePanel />} */}
        {userRelation === "none" && (
          <Card style={CardStyle.Grey} className="mb-5">
            <h2>Why Join?</h2>
            <p>
              {action?.whyJoin ||
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
            </p>
          </Card>
        )}
        {action && <ActionTaskPanel action={action} />}
        {action && <ActionEventsPanel events={action.events} />}
        <h2 className="!mt-4">Summary</h2>
        <p>{action?.description}</p>

        {isFeatureEnabled(Features.Forum) && <ActionForumPosts actionId={id} />}
      </div>
    ),
    [action, userRelation, id, isAuthenticated, onJoinAction, error]
  );

  return (
    <>
      <meta name="og:title" content={action?.name} />
      <meta name="og:description" content={action?.description} />
      <TwoColumnSplit
        left={mainContent}
        right={
          <div className="flex flex-col gap-y-5 p-6">
            <Card
              style={CardStyle.White}
              className="items-center gap-y-5 aspect-square justify-center p-8"
            >
              <div className="w-[180px] self-center pb-5">
                <Globe
                  people={action?.usersJoined || 0}
                  colored
                  locations={action?.locations || []}
                />
                <p className="text-center pt-5 text-[11pt]">
                  {action?.usersJoined?.toLocaleString() || 0} people committed
                </p>
              </div>
              {/* <div className="w-full border-t border-gray-300" />
            <UserBubbleRow />
            <p className="text-center pt-2 text-[11pt]">
              <b>6 friends</b> already joined this action!
            </p> */}
              <StatsCard />
            </Card>
          </div>
        }
        coloredRight={false}
        border={false}
      />
    </>
  );
}
