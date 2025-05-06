import React, { Suspense, useCallback, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import Card, { CardStyle } from "../../components/system/Card";
import StatsCard from "../../components/StatsCard";
import Globe from "../../components/Globe";
import UserBubbleRow from "../../components/UserBubbleRow";
import Button from "../../components/system/Button";
import PokePanel from "../../components/PokePanel";
import {
  actionsFindOne,
  actionsJoin,
  actionsMyStatus,
} from "../../client/sdk.gen";
import { ActionDto, UserActionDto } from "../../client/types.gen";
import { getApiUrl } from "../../lib/config";
import ActionForumPosts from "../../components/ActionForumPosts";

const ActionPage: React.FC = () => {
  const { id: actionId } = useParams();
  const navigate = useNavigate();
  const [action, setAction] = useState<ActionDto | undefined>(undefined);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [userRelation, setUserRelation] = useState<
    UserActionDto["status"] | null
  >(null);

  useEffect(() => {
    const fetchAction = async () => {
      if (!actionId) return;

      try {
        console.log("fetching action", actionId);
        const response = await actionsFindOne({
          path: { id: actionId },
        });

        if (response.error) {
          throw new Error("Failed to fetch action");
        }

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

        setAction(response.data);
        setLoading(false);
      } catch (err) {
        setError("Failed to load action details. Please try again later.");
        setLoading(false);
        console.error("Error fetching action:", err);
      }
    };

    fetchAction();
  }, [actionId]);

  const onJoinAction = useCallback(async () => {
    if (!actionId) return;

    try {
      const response = await actionsJoin({
        path: { id: actionId },
      });

      if (response.error) {
        throw new Error("Failed to join action");
      }
    } catch (err) {
      console.error("Error joining action:", err);
      setError("Failed to join this action. Please try again later.");
    }
  }, [actionId]);

  return (
    <div className="flex flex-row min-h-screen py-12 px-3 w-full justify-center gap-x-7 bg-stone-50">
      <div className="flex flex-col max-w-[700px] gap-y-3 border-r border-gray-200 pr-7">
        {action?.image && (
          <img
            src={`${getApiUrl()}/images/${action.image}`}
            alt={action.name}
            className="w-full h-auto rounded-md border border-gray-300 max-h-[200px] object-cover"
          />
        )}
        <div className="flex flex-row justify-between items-center my-5">
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
          {userRelation === "NONE" && actionId && (
            <Button
              className="mt-1"
              label="Commit to this action"
              onClick={onJoinAction}
            />
          )}
        </div>
        {userRelation === "JOINED" && <PokePanel />}
        {userRelation === "NONE" && (
          <Card style={CardStyle.Grey} className="mb-5">
            <h2>Why Join?</h2>
            <p>
              {action?.whyJoin ||
                "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
            </p>
          </Card>
        )}
        <h2>What you can do</h2>
        <p>
          {action?.description ||
            "Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua."}
        </p>
        <h2>FAQ</h2>
        <p>
          Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do
          eiusmod tempor incididunt ut labore et dolore magna aliqua.
        </p>

        {actionId && <ActionForumPosts actionId={actionId} />}
      </div>
      <div className="flex flex-col gap-y-5 items-stretch max-w-[300px]">
        <div className="w-[75] self-center">
          <Suspense fallback={<div>Loading...</div>}>
            <Globe people={action?.usersJoined || 0} colored />
          </Suspense>
          <p className="text-center pt-2 text-[11pt]">
            {action?.usersJoined?.toLocaleString() || 0} people committed
          </p>
        </div>

        <Card style={CardStyle.White} className="items-center">
          <UserBubbleRow />
          <p className="text-center pt-2 text-[11pt]">
            <b>6 friends</b> already joined this action!
          </p>
        </Card>
        <StatsCard />
      </div>
    </div>
  );
};

export default ActionPage;
