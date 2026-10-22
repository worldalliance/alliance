import { publicDisplayName } from "@alliance/common/displayName";
import type {
  CampaignDto,
  OnetimeInviteEdgeDto,
  UserDto,
} from "@alliance/shared/client";
import type { ForceGraphLink, ForceGraphNode } from "../force-graph/ForceGraph";

export enum NodeKind {
  User = "user",
  /**
   * Hub every user with no referral attribution hangs off, so the graph stays
   * one connected component instead of a scatter of free-floating trees.
   */
  Unattributed = "unattributed",
  Campaign = "campaign",
}

export interface GraphNode extends ForceGraphNode {
  kind: NodeKind;
  userId?: number;
}

export type GraphLink = ForceGraphLink<GraphNode>;

export function buildInviteGraph({
  users,
  campaigns,
  inviteEdges,
}: {
  users: UserDto[];
  campaigns: CampaignDto[];
  inviteEdges: OnetimeInviteEdgeDto[];
}) {
  const UNATTRIBUTED_ID = "unattributed";
  const userNodeId = (userId: number) => `user-${userId}`;
  const campaignNodeId = (campaignId: number) => `campaign-${campaignId}`;

  const nodes: GraphNode[] = users.map((u) => ({
    id: userNodeId(u.id),
    kind: NodeKind.User,
    userId: u.id,
    displayName: publicDisplayName(u),
    profilePicture: u.profilePicture,
  }));

  // A campaign gets a node only once someone is attributed to it
  const attributedCampaignIds = new Set(
    users
      .map((u) => u.referredByCampaignId)
      .filter((id): id is number => id != null),
  );
  const graphedCampaigns = campaigns.filter((c) =>
    attributedCampaignIds.has(c.id),
  );
  const graphedCampaignIds = new Set(graphedCampaigns.map((c) => c.id));
  for (const campaign of graphedCampaigns) {
    nodes.push({
      id: campaignNodeId(campaign.id),
      kind: NodeKind.Campaign,
      displayName: campaign.name,
      profilePicture: campaign.picture,
    });
  }

  const nodeIds = new Set(nodes.map((n) => n.id));

  // Build links from the invite system, referredBy and campaigns, deduplicating
  const linkSet = new Set<string>(); // "sourceId->targetId"
  const links: GraphLink[] = [];

  // A link to a node we never built throws inside d3's force layout and takes
  // the page down, so drop it — a partial load should draw a partial graph.
  const addLink = (sourceId: string, targetId: string) => {
    if (!nodeIds.has(sourceId) || !nodeIds.has(targetId)) return;
    const key = `${sourceId}->${targetId}`;
    if (linkSet.has(key)) return;
    linkSet.add(key);
    links.push({ source: sourceId, target: targetId });
  };

  // Links from OnetimeInvite data
  for (const edge of inviteEdges) {
    if (edge.invitingUserId === edge.invitedUserId) continue;
    addLink(userNodeId(edge.invitingUserId), userNodeId(edge.invitedUserId));
  }

  // Links from referredBy and referredByCampaign
  for (const u of users) {
    const referredById = u.referredById;
    if (referredById != null && referredById !== u.id) {
      addLink(userNodeId(referredById), userNodeId(u.id));
    }
    const campaignId = u.referredByCampaignId;
    if (campaignId != null && graphedCampaignIds.has(campaignId)) {
      addLink(campaignNodeId(campaignId), userNodeId(u.id));
    }
  }

  // Track which users have an incoming link (were referred/invited)
  const linkedTargets = new Set<string>();
  for (const l of links) {
    const tgt = typeof l.target === "string" ? l.target : l.target.id;
    linkedTargets.add(tgt);
  }

  // Whatever is left came from nowhere we can name — the earliest accounts
  // included, so their trees read as their own rather than as one blob
  const unattributedUsers = users.filter(
    (u) => !linkedTargets.has(userNodeId(u.id)),
  );
  if (unattributedUsers.length > 0) {
    nodes.push({
      id: UNATTRIBUTED_ID,
      kind: NodeKind.Unattributed,
      displayName: `No attribution (${unattributedUsers.length})`,
      profilePicture: null,
    });
    nodeIds.add(UNATTRIBUTED_ID);
    for (const u of unattributedUsers) {
      addLink(UNATTRIBUTED_ID, userNodeId(u.id));
    }
  }

  // Build adjacency lists (source -> targets, target -> source)
  const childrenMap = new Map<string, Set<string>>();
  const parentMap = new Map<string, string>();
  for (const l of links) {
    const src = typeof l.source === "string" ? l.source : l.source.id;
    const tgt = typeof l.target === "string" ? l.target : l.target.id;
    if (!childrenMap.has(src)) childrenMap.set(src, new Set());
    childrenMap.get(src)!.add(tgt);
    parentMap.set(tgt, src);
  }

  // Collect all descendants (children, grandchildren, etc.)
  function getDescendants(nodeId: string): Set<string> {
    const result = new Set<string>();
    const stack = [nodeId];
    while (stack.length) {
      const current = stack.pop()!;
      const children = childrenMap.get(current);
      if (!children) continue;
      for (const child of children) {
        if (!result.has(child)) {
          result.add(child);
          stack.push(child);
        }
      }
    }
    return result;
  }

  // Walk up the parent chain to root
  function getAncestors(nodeId: string): Set<string> {
    const result = new Set<string>();
    let current = parentMap.get(nodeId);
    while (current && !result.has(current)) {
      result.add(current);
      current = parentMap.get(current);
    }
    return result;
  }

  return { nodes, links, getDescendants, getAncestors };
}
