import React, { useCallback, useEffect, useMemo, useState } from "react";
import { href, Link } from "react-router";
import {
  userCreateCommunity,
  userGetCommunities,
} from "@alliance/shared/client";
import type {
  CommunityDto,
  CreateCommunityDto,
} from "@alliance/shared/client/types.gen";
import Card from "@alliance/sharedweb/ui/Card";
import { CardStyle } from "@alliance/shared/styles/card";
import Button, { ButtonColor } from "@alliance/sharedweb/ui/Button";
import List from "@alliance/sharedweb/ui/List";

const INITIAL_COMMUNITY: CreateCommunityDto = {
  name: "",
  description: "",
  photo: "",
};

const GroupsPage: React.FC = () => {
  const [communities, setCommunities] = useState<CommunityDto[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newCommunity, setNewCommunity] =
    useState<CreateCommunityDto>(INITIAL_COMMUNITY);
  const [creating, setCreating] = useState(false);

  const loadCommunities = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await userGetCommunities();
      setCommunities(response.data ?? []);
    } catch (err) {
      console.error("Failed to load communities", err);
      setError("Unable to load communities. Please try again.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadCommunities();
  }, [loadCommunities]);

  const sortedCommunities = useMemo(() => {
    return [...communities].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { sensitivity: "base" })
    );
  }, [communities]);

  const handleCreateCommunity = useCallback(
    async (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      const name = newCommunity.name.trim();
      const description = newCommunity.description.trim();
      const photo = newCommunity.photo?.trim();
      if (!name || !description) {
        setError("Name and description are required.");
        return;
      }
      setCreating(true);
      setError(null);
      try {
        const response = await userCreateCommunity({
          body: {
            name,
            description,
            photo: photo ? photo : undefined,
          },
        });
        if (response.data) {
          setCommunities((prev) => [...prev, response.data]);
          setNewCommunity(INITIAL_COMMUNITY);
        }
      } catch (err) {
        console.error("Failed to create community", err);
        setError("Unable to create community. Please try again.");
      } finally {
        setCreating(false);
      }
    },
    [newCommunity]
  );

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-4">
      {error && (
        <div className="w-full max-w-5xl">
          <p className="text-sm text-red-500">{error}</p>
        </div>
      )}

      <div className="w-full max-w-5xl flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold">Groups</h2>
            <p className="text-sm text-zinc-500">
              Manage member-facing groups and their details.
            </p>
          </div>
        </div>

        {loading ? (
          <p className="text-sm text-zinc-500">Loading groups…</p>
        ) : sortedCommunities.length ? (
          <List>
            {sortedCommunities.map((community) => (
              <CommunityCard key={community.id} community={community} />
            ))}
          </List>
        ) : (
          <p className="text-sm text-zinc-500">No groups yet.</p>
        )}
      </div>

      <Card className="w-full max-w-5xl" style={CardStyle.White}>
        <p className="font-bold mb-4">Create group</p>
        <form className="flex flex-col gap-3" onSubmit={handleCreateCommunity}>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-zinc-700"
              htmlFor="group-name"
            >
              Name
            </label>
            <input
              id="group-name"
              type="text"
              className="border border-zinc-300 rounded px-3 py-2 text-sm"
              value={newCommunity.name}
              onChange={(event) => {
                setError(null);
                setNewCommunity((prev) => ({
                  ...prev,
                  name: event.target.value,
                }));
              }}
              placeholder="Member-visible title"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label
              className="text-sm font-medium text-zinc-700"
              htmlFor="group-description"
            >
              Description
            </label>
            <textarea
              id="community-description"
              className="border border-zinc-300 rounded px-3 py-2 text-sm min-h-[80px]"
              value={newCommunity.description}
              onChange={(event) => {
                setError(null);
                setNewCommunity((prev) => ({
                  ...prev,
                  description: event.target.value,
                }));
              }}
              placeholder="What is this group for?"
            />
          </div>
          <Button
            type="submit"
            color={ButtonColor.Blue}
            className="self-start"
            disabled={creating}
          >
            {creating ? "Creating…" : "Create group"}
          </Button>
        </form>
      </Card>
    </div>
  );
};

type CommunityCardProps = {
  community: CommunityDto;
};

const CommunityCard: React.FC<CommunityCardProps> = ({ community }) => {
  const memberCount = community.users.length;
  const leaderCount = community.leaders.length;

  return (
    <Link
      to={href("/groups/:id", { id: community.id.toString() })}
      className="p-4 hover:bg-zinc-100 cursor-pointer"
    >
      <div className="flex flex-col gap-4">
        <div className="flex flex-row items-center justify-between gap-3">
          <div className="flex flex-col gap-1">
            <h3 className="font-semibold">{community.name}</h3>
            <p className="text-sm text-zinc-600">
              {community.description || "No description yet."}
            </p>
          </div>
          <div className="flex flex-row items-center gap-3">
            {leaderCount !== 1 && (
              <p className="text-sm text-zinc-600">
                {leaderCount} leader{leaderCount === 1 ? "" : "s"}
              </p>
            )}
            <p className="text-sm mr-4 font-medium">{memberCount}</p>
          </div>
        </div>
      </div>
    </Link>
  );
};

export default GroupsPage;
