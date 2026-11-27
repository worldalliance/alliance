import type { ClusterAdminDto } from "@alliance/shared/client/types.gen";
import { memberProfileUrl } from "../../lib/config";
import { clustermatesByMember, matchingClusters } from "./clustermates";

const cluster = (
  id: number,
  displayName: string,
  members: ClusterAdminDto["members"],
): ClusterAdminDto => ({
  id,
  displayName,
  createdAt: "2026-01-02T00:00:00.000Z",
  updatedAt: "2026-01-02T00:00:00.000Z",
  members,
});

const north = cluster(1, "North", [
  { id: 30, displayName: "Ren" },
  { id: 10, displayName: "Ada_*" },
  { id: 20, displayName: "Sam" },
]);
const solo = cluster(2, "Solo", [{ id: 40, displayName: "Lee" }]);

it("lists each member's clustermates by id, with markdown escaped", () => {
  const payload = clustermatesByMember([north, solo]);

  expect(Object.keys(payload).sort()).toEqual(["10", "20", "30", "40"]);
  expect(payload["30"]).toBe(
    "The other members of your introduction group (North) are:\n\n" +
      `- [Ada\\_\\*](${memberProfileUrl(10)})\n` +
      `- [Sam](${memberProfileUrl(20)})`,
  );
  expect(payload["40"]).toBe(
    "You are the only member of your introduction group (Solo).",
  );
});

it("finds a cluster by its name or a member's name", () => {
  expect(matchingClusters([north, solo], "sol")).toEqual([solo]);
  expect(matchingClusters([north, solo], "SAM")).toEqual([north]);
  expect(matchingClusters([north, solo], " ")).toEqual([north, solo]);
});
