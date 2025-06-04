import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import Card, { CardStyle } from "../../components/system/Card";
import StatsCard from "../../components/StatsCard";
import Globe from "../../components/Globe";
import Button from "../../components/system/Button";
import {
  actionsFindOne,
  actionsJoin,
  actionsMyStatus,
} from "@alliance/shared/client";
import { ActionDto, UserActionDto } from "@alliance/shared/client";
import { getImageSource, isFeatureEnabled } from "../../lib/config";
import ActionForumPosts from "../../components/ActionForumPosts";
import TwoColumnSplit from "../../components/system/TwoColumnSplit";
import { Features } from "@alliance/shared/lib/features";
import { useAuth } from "../../lib/AuthContext";
import ActionEventsPanel from "../../components/ActionEventsPanel";
import { PublicAppRoute } from "../../RouteWrappers";

const ActionPage: React.FC = () => {
  const { id: actionId } = useParams();
  const navigate = useNavigate();
  const [action, setAction] = useState<ActionDto | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const { isAuthenticated } = useAuth();

  const [userRelation, setUserRelation] = useState<
    UserActionDto["status"] | null
  >(null);

  useEffect(() => {
    const fetchAction = async () => {
      if (!actionId) return;

      try {
        console.log("fetching action", actionId);
        const response = await actionsFindOne({
          path: { id: parseInt(actionId) },
        });

        console.log("response", response);

        if (response.error) {
          throw new Error("Failed to fetch action");
        }

        setAction(response.data);

        if (isAuthenticated) {
          const userStatusResponse = await actionsMyStatus({
            path: { id: actionId },
          });

          console.log("userStatusResponse", userStatusResponse);
          if (userStatusResponse.error) {
            throw new Error("Failed to fetch user status");
          }
          if (userStatusResponse.data) {
            setUserRelation(userStatusResponse.data.status);
          }
        }

        setLoading(false);
      } catch (err) {
        setError("Failed to load action details. Please try again later.");
        setLoading(false);
        console.error("Error fetching action:", err);
      }
    };

    fetchAction();
  }, [actionId, isAuthenticated]);

  const onJoinAction = useCallback(async () => {
    if (!actionId) return;

    try {
      const response = await actionsJoin({
        path: { id: actionId },
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
  }, [actionId]);

  //   const evtSource = new EventSource(`${getApiUrl()}/actions/live/${actionId}`);
  //   evtSource.onmessage = (e) => {
  //     const newUserCount = Number(e.data);
  //     if (newUserCount !== action?.usersJoined && action) {
  //       setAction({ ...action, usersJoined: newUserCount });
  //     }
  //   };

  const mainContent = (
    <>
      <div className="flex flex-col gap-y-3 flex-2 p-10 px-20">
        {action?.image && (
          <img
            src={getImageSource(action.image)}
            alt={action.name}
            className="w-full h-auto rounded-md border border-gray-300 max-h-[200px] object-cover"
          />
        )}
        <div className="flex flex-row justify-between items-start my-5">
          <div className="flex flex-col gap-y-3">
            <h1>{action?.name}</h1>
            <p className="text-gray-900 text-[12pt] mt-[-3px]">
              Part of the{" "}
              <a
                className="text-blue-500 cursor-pointer"
                onClick={() => {
                  navigate("/issues/climate");
                }}
              >
                Alliance Climate Program
              </a>
            </p>
          </div>
          {userRelation === "none" && actionId && (
            <Button className="mt-2" onClick={onJoinAction}>
              Commit to this action
            </Button>
          )}
        </div>
        {error && <div className="text-red-500">{error}</div>}
        {loading && <div className="text-gray-500">Loading...</div>}
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
        {action && <ActionEventsPanel action={action} />}
        <h2 className="!mt-8">What you can do</h2>
        <p>
          {action?.description ||
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
        </p>
        <h2>FAQ</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>
        {isFeatureEnabled(Features.Forum) && (
          <ActionForumPosts actionId={actionId} />
        )}
      </div>
    </>
  );

  return (
    <PublicAppRoute>
      <meta name="og:title" content={action?.name} />
      <meta name="og:description" content={action?.description} />
      <TwoColumnSplit
        left={mainContent}
        right={
          <div className="flex flex-col gap-y-5 p-6">
            <Card
              style={CardStyle.White}
              className="items-center gap-y-5 aspect-square justify-center"
            >
              <div className="w-[180px] self-center">
                <Suspense fallback={<div>Loading...</div>}>
                  <Globe people={action?.usersJoined || 0} colored />
                </Suspense>
                <p className="text-center pt-5 text-[11pt]">
                  {action?.usersJoined?.toLocaleString() || 0} people committed
                </p>
              </div>
              {/* <div className="w-full border-t border-gray-300" />
            <UserBubbleRow />
            <p className="text-center pt-2 text-[11pt]">
              <b>6 friends</b> already joined this action!
            </p> */}
            </Card>
            <StatsCard />
          </div>
        }
        coloredRight={true}
      />
    </PublicAppRoute>
  );
};

export default ActionPage;
