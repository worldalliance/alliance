import type { ClusterAdminDto } from "@alliance/shared/client/types.gen";
import { memberProfileUrl } from "../../lib/config";

const escapeMarkdownLabel = (text: string) =>
  text.replace(/[\\[\]*_`~<>]/g, "\\$&");

/** Each member's id mapped to a markdown note naming the others in their cluster. */
export function clustermatesByMember(
  clusters: readonly ClusterAdminDto[],
): Record<string, string> {
  const payload: Record<string, string> = {};
  for (const cluster of clusters) {
    for (const member of cluster.members) {
      const others = cluster.members
        .filter((m) => m.id !== member.id)
        .sort((a, b) => a.id - b.id);
      if (others.length === 0) {
        payload[String(member.id)] =
          `You are the only member of your introduction group (${cluster.displayName}).`;
        continue;
      }
      const list = others
        .map(
          (m) =>
            `- [${escapeMarkdownLabel(m.displayName)}](${memberProfileUrl(m.id)})`,
        )
        .join("\n");
      payload[String(member.id)] =
        `The other members of your introduction group (${cluster.displayName}) are:\n\n${list}`;
    }
  }
  return payload;
}

/** Clusters whose name or a member's name contains the search text. */
export function matchingClusters(
  clusters: readonly ClusterAdminDto[],
  q: string,
): ClusterAdminDto[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [...clusters];
  return clusters.filter(
    (cluster) =>
      cluster.displayName.toLowerCase().includes(needle) ||
      cluster.members.some((m) => m.displayName.toLowerCase().includes(needle)),
  );
}
