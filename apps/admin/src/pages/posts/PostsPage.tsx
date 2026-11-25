import type { PostDto } from "@alliance/shared/client";
import { useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router";
import { formatDate } from "../../lib/formatDate";
import { formatCount } from "../../lib/formatNumber";
import { LAUNCH_TIME_ZONE } from "../../lib/launchTimeZone";
import { usePostsAdmin } from "../../lib/usePostsAdmin";
import { PlaceId } from "../../places";
import { PersonCell } from "../../ui/PersonCell";
import { nameLinkClass } from "../../ui/styles";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../../ui/Table";
import {
  FilterBar,
  ListContent,
  listCount,
  SearchField,
  useListSearch,
} from "../../ui/templates/List";
import { Page } from "../../ui/templates/Page";
import {
  ContentState,
  RefreshFailedBanner,
  TableSkeleton,
} from "../../ui/templates/States";
import { matchesSearch, parsePostId, postHref } from "./postRules";
import { PostSheet } from "./PostSheet";

const COLUMNS = 8;

export default function PostsPage() {
  const { posts } = usePostsAdmin();
  const [q, setQ] = useListSearch();
  const { postId } = useParams();
  const { search } = useLocation();
  const navigate = useNavigate();

  const all = posts.data;
  const rows = useMemo(
    () => (all ?? []).filter((post) => matchesSearch(post, q)),
    [all, q],
  );
  const openId = parsePostId(postId);
  const open = all?.find((post) => post.id === openId) ?? null;
  const openIndex = open ? rows.indexOf(open) : -1;

  const sheetOpen = postId !== undefined && all !== undefined;
  const close = () => void navigate(postHref() + search);
  const step = (to: PostDto) =>
    void navigate(postHref(to.id) + search, { replace: true });

  return (
    <Page
      fill
      place={PlaceId.ForumPosts}
      description="Each post's authors, Q&A mode, notifications and comment tags."
      banner={<RefreshFailedBanner things="posts" query={posts} />}
    >
      <FilterBar
        count={listCount({
          shown: rows.length,
          total: all?.length,
          noun: "post",
        })}
      >
        <SearchField label="Filter posts" value={q} onChange={setQ} />
      </FilterBar>
      <ListContent>
        <ContentState
          things="posts"
          query={posts}
          refreshBanner={false}
          skeleton={<TableSkeleton bleed columns={COLUMNS} />}
          empty={rows.length === 0}
          filtered={q !== ""}
          onClearFilters={() => setQ("")}
          emptyTitle="No forum posts yet"
        >
          <Table bleed>
            <TableHeader>
              <TableRow>
                <TableHead>Post</TableHead>
                <TableHead>Author</TableHead>
                <TableHead>Created</TableHead>
                <TableHead className="text-right">Authors</TableHead>
                <TableHead>Q&A mode</TableHead>
                <TableHead className="text-right">Experts</TableHead>
                <TableHead>Reply notifications</TableHead>
                <TableHead>Cluster tags</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((post) => (
                <PostRow
                  key={post.id}
                  post={post}
                  selected={post.id === openId}
                  search={search}
                />
              ))}
            </TableBody>
          </Table>
        </ContentState>
      </ListContent>
      {sheetOpen && (
        <PostSheet
          post={open}
          onClose={close}
          onStep={step}
          position={{
            previous: openIndex > 0 ? rows[openIndex - 1] : undefined,
            next: openIndex >= 0 ? rows[openIndex + 1] : undefined,
          }}
        />
      )}
    </Page>
  );
}

const onOff = (on: boolean) =>
  on ? "On" : <span className="text-fg-muted">Off</span>;

function PostRow({
  post,
  selected,
  search,
}: {
  post: PostDto;
  selected: boolean;
  search: string;
}) {
  return (
    <TableRow aria-selected={selected}>
      <TableCell truncate title={post.title}>
        <Link to={postHref(post.id) + search} className={nameLinkClass}>
          {post.title}
        </Link>
      </TableCell>
      <PersonCell
        userId={post.author.id}
        name={post.author.displayName}
        profilePicture={post.author.profilePicture}
      />
      <TableCell className="whitespace-nowrap">
        {formatDate(post.createdAt, { timeZone: LAUNCH_TIME_ZONE })}
      </TableCell>
      <TableCell className="text-right tabular-nums">
        {formatCount(post.authorIds.length)}
      </TableCell>
      <TableCell>{onOff(post.qaMode)}</TableCell>
      <TableCell className="text-right tabular-nums">
        {post.qaMode ? formatCount(post.expertIds.length) : "—"}
      </TableCell>
      <TableCell>{onOff(post.notifyForReplies)}</TableCell>
      <TableCell>{onOff(post.showClusterTags)}</TableCell>
    </TableRow>
  );
}
