import {
  analyticsGetTimeSpentPerUser,
  analyticsGetTimeSpentPerUserTotal,
  userList,
} from "@alliance/shared/client";
import { TimeSpentForUserDto, User } from "@alliance/shared/client/types.gen";
import React, { useEffect, useState } from "react";
import UserCard from "../components/UserCard";
import { FilterMode } from "@alliance/shared/lib/actionUtils";
import DropdownSelect from "@alliance/shared/ui/DropdownSelect";

const UsersList: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [timeSpentPerUserLast7, setTimeSpentPerUserLast7] = useState<
    TimeSpentForUserDto[]
  >([]);
  const [timeSpentPerUserTotal, setTimeSpentPerUserTotal] = useState<
    TimeSpentForUserDto[]
  >([]);
  useEffect(() => {
    analyticsGetTimeSpentPerUser().then((res) => {
      if (res.data) {
        setTimeSpentPerUserLast7(res.data);
      }
    });
    analyticsGetTimeSpentPerUserTotal().then((res) => {
      if (res.data) {
        setTimeSpentPerUserTotal(res.data);
      }
    });
  }, []);

  useEffect(() => {
    userList().then((res) => setUsers(res.data || []));
  }, []);

  const userToTimeSpent = timeSpentPerUserLast7.reduce((acc, time) => {
    acc[time.userId] = time.timeSpent;
    return acc;
  }, {} as Record<number, number>);

  const userToTimeSpentTotal = timeSpentPerUserTotal.reduce((acc, time) => {
    acc[time.userId] = time.timeSpent;
    return acc;
  }, {} as Record<number, number>);

  const sorted = users.sort((a, b) => {
    return (
      (userToTimeSpentTotal[b.id] ?? 0) - (userToTimeSpentTotal[a.id] ?? 0)
    );
  });

  const filterModes = ["All", "Signed", "Suspended", "Not signed"];

  const [filterMode, setFilterMode] = useState("All");

  const modeToUsers = filterModes.reduce((acc, mode) => {
    acc[mode] = sorted.filter((user) => {
      if (mode === "All") return true;
      if (mode === "Signed") return user.contractDateSigned;
      if (mode === "Suspended") return user.contractDateSuspended;
      return !user.contractDateSigned;
    });
    return acc;
  }, {} as Record<string, User[]>);

  return (
    <div className="h-full p-5 pt-20 flex flex-col items-center gap-y-3">
      <div className="flex flex-row gap-3 justify-between w-full items-center">
        <DropdownSelect
          options={filterModes}
          secondaryLabels={filterModes.map((mode) =>
            modeToUsers[mode].length.toString()
          )}
          value={filterMode}
          onChange={(mode) => setFilterMode(mode as FilterMode)}
        />
        {window.location.href.includes("localhost") && (
          <p className="text-sm text-gray-500">
            note: activity data is prod-only
          </p>
        )}
      </div>
      <div className="flex flex-row flex-wrap gap-3 w-full">
        {modeToUsers[filterMode].map((user) => (
          <UserCard
            key={user.id}
            user={user}
            timeSpent={userToTimeSpent[user.id]}
            timeSpentTotal={userToTimeSpentTotal[user.id]}
          />
        ))}
      </div>
    </div>
  );
};

export default UsersList;
