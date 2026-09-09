import { isUploadKey } from "@alliance/common/image-src";
import { withCount } from "@alliance/common/plural";
import { R } from "@alliance/common/result";
import { GetObjectCommand, S3Client } from "@aws-sdk/client-s3";
import { Inject, Injectable, Logger } from "@nestjs/common";
import { format } from "date-fns";
import escapeHtml from "escape-html";
import { readFileSync } from "fs";
import { join } from "path";
import { remark } from "remark";
import remarkGfm from "remark-gfm";
import remarkHtml from "remark-html";
import { getImageSource } from "src/images/images.service";
import { postUrl } from "src/search/approutes";
import type { User } from "src/user/entities/user.entity";
import type { Comment } from "./entities/comment.entity";
import type { EditableContent } from "./entities/editablecontent.entity";
import type { ParsedPost } from "./entities/post.entity";
import { ForumService } from "./forum.service";

export type PostExport = {
  filename: string;
  html: string;
};

@Injectable()
export class ForumExportService {
  private readonly logger = new Logger(ForumExportService.name);
  private readonly bucket = process.env.ASSETS_BUCKET!;

  constructor(
    private readonly forumService: ForumService,
    @Inject("S3_CLIENT") private readonly s3: S3Client,
  ) {}

  async exportPost(postId: number): Promise<PostExport> {
    const post = await this.forumService.findPostForAdmin(postId);
    const comments = await this.forumService.findCommentsForPost(postId);
    const contents = [
      contentOf(post.editableContent, `Post ${post.id}`),
      ...flattenComments(comments).map((comment) =>
        contentOf(comment.editableContent, `Comment ${comment.id}`),
      ),
    ];
    const attachments = await this.fetchAttachments(
      contents.flatMap((content) => content.attachments).filter(isUploadKey),
    );
    const bodies = new Map(
      await Promise.all(
        contents.map(
          async (content) =>
            [content.id, await markdownToHtml(content.body)] as const,
        ),
      ),
    );

    return {
      filename: exportFilename(post),
      html: renderPostPage({
        post,
        comments,
        bodies,
        attachments,
        editModeScript: readEditModeScript(),
      }),
    };
  }

  private async fetchAttachments(keys: string[]): Promise<Map<string, string>> {
    const results = await Promise.all(
      [...new Set(keys)].map(
        async (key) =>
          [key, await R.fromPromise(this.getAttachment(key))] as const,
      ),
    );
    const fetched = new Map<string, string>();
    for (const [key, result] of results) {
      if (result.ok) {
        fetched.set(key, result.value);
      } else {
        this.logger.warn(
          `Post export: could not read attachment ${key}: ${result.error.message}`,
        );
      }
    }
    return fetched;
  }

  /** The bytes as a data uri, so the page carries the image itself. */
  private async getAttachment(key: string): Promise<string> {
    const object = await this.s3.send(
      new GetObjectCommand({ Bucket: this.bucket, Key: key }),
    );
    if (!object.Body) {
      throw new Error("no body in the S3 response");
    }
    const bytes = await object.Body.transformToByteArray();
    const type = object.ContentType ?? "image/webp";
    return `data:${type};base64,${Buffer.from(bytes).toString("base64")}`;
  }
}

function contentOf(
  content: EditableContent | undefined,
  owner: string,
): EditableContent {
  if (!content) {
    throw new Error(`${owner} was loaded without editableContent`);
  }
  return content;
}

function flattenComments(comments: Comment[]): Comment[] {
  return comments.flatMap((comment) => [
    comment,
    ...flattenComments(comment.children ?? []),
  ]);
}

async function markdownToHtml(body: string): Promise<string> {
  const file = await remark().use(remarkGfm).use(remarkHtml).process(body);
  return String(file);
}

function exportFilename(post: ParsedPost): string {
  const slug = post.title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 60);
  return `post-${post.id}${slug ? `-${slug}` : ""}.html`;
}

type PageInput = {
  post: ParsedPost;
  comments: Comment[];
  /** Rendered body html, keyed by editable content id. */
  bodies: Map<number, string>;
  /** Data uri per attachment key the page embeds. */
  attachments: Map<string, string>;
  editModeScript: string;
};

const EDIT_MODE_SCRIPT_PATH = join(__dirname, "forum-export-edit-mode.js");

/** Read per export, so editing the script shows up on the next download. */
function readEditModeScript(): string {
  return readFileSync(EDIT_MODE_SCRIPT_PATH, "utf8");
}

function renderPostPage(input: PageInput): string {
  const { post } = input;
  const threads = input.comments.filter(isWorthRendering);
  const commentCount = flattenComments(threads).length;
  const authors = post.authors?.length
    ? post.authors
    : post.author
      ? [post.author]
      : [];
  const byline = [
    authors.map(displayName).join(", "),
    format(post.visibleAt ?? post.createdAt, "d MMMM yyyy"),
    withCount(commentCount, "comment"),
  ].filter(Boolean);

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${escapeHtml(post.title)}</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Source+Sans+3:ital,wght@0,400;0,600;1,400&display=swap">
<style>${pageStyles}</style>
</head>
<body>
<main>
<header class="masthead">
<p class="brand">The Alliance <a class="domain" href="https://thealliance.org"><small>thealliance.org</small></a></p>
<p class="notice">A private post from the members' forum, shared with Alliance members only.</p>
</header>
<article class="post">
<h1>${escapeHtml(post.title)}</h1>
<p class="byline">${renderAvatar(authors[0], "post")}<span class="author">${escapeHtml(byline[0])}</span> · ${escapeHtml(byline.slice(1).join(" · "))}</p>
${post.action ? `<p class="action">Action: ${escapeHtml(post.action.name)}</p>` : ""}
${renderContent(post.editableContent, input)}
</article>
<section class="comments">
<h2>${escapeHtml(withCount(commentCount, "comment"))}</h2>
${threads.length ? renderThread(threads, input) : `<p class="empty">No comments yet.</p>`}
</section>
<footer><a href="${escapeHtml(`${process.env.APP_URL}${postUrl(post.id)}`)}">View this post on the site</a></footer>
</main>
<script>
${closeScriptSafe(input.editModeScript)}</script>
</body>
</html>
`;
}

/** A `</script` inside the script would end the tag early. The escape is
 * inert in the js string and regex literals that can hold one. */
function closeScriptSafe(script: string): string {
  return script.replace(/<\/script/gi, "<\\/script");
}

function isWorthRendering(comment: Comment): boolean {
  return !comment.deleted || (comment.children?.length ?? 0) > 0;
}

function renderThread(comments: Comment[], input: PageInput): string {
  const items = comments
    .map((comment) => renderComment(comment, input))
    .join("\n");
  return `<ol class="thread">\n${items}\n</ol>`;
}

function renderComment(comment: Comment, input: PageInput): string {
  const { post } = input;
  const tag = post.tags?.find((candidate) => candidate.id === comment.tagId);
  const isExpert = post.qaMode && post.expertIds.includes(comment.authorId);
  const badges = [
    comment.pinned ? "Pinned" : undefined,
    isExpert ? (post.expertLabel ?? "Expert") : undefined,
    tag?.name,
  ].filter((badge): badge is string => badge !== undefined);
  const children = (comment.children ?? []).filter(isWorthRendering);

  return `<li class="comment">
<p class="byline">${renderAvatar(comment.author, "comment")}<span class="author">${escapeHtml(displayName(comment.author))}</span> · ${escapeHtml(format(comment.createdAt, "d MMMM yyyy"))}${badges.map((badge) => ` <span class="badge">${escapeHtml(badge)}</span>`).join("")}${renderLikes(comment.likesCount)}</p>
${comment.deleted ? `<p class="deleted">Content has been deleted</p>` : renderContent(comment.editableContent, input)}
${children.length ? renderThread(children, input) : ""}
</li>`;
}

/** Avatars stay hard links to the bucket the site serves them from. The initial
 * sits under the image, and dropping an image that fails to load uncovers it, so
 * a key the bucket no longer has shows a monogram rather than a broken image. */
function renderAvatar(
  user: Pick<User, "name" | "anonymous" | "profilePicture"> | undefined,
  size: "post" | "comment",
): string {
  if (!user) {
    return "";
  }
  const initial = displayName(user).trim().charAt(0).toUpperCase();
  const image = user.profilePicture
    ? `<img src="${escapeHtml(getImageSource(user.profilePicture))}" alt="" onerror="this.remove()">`
    : "";
  return `<span class="avatar avatar-${size}">${escapeHtml(initial)}${image}</span>`;
}

function renderLikes(count: number): string {
  if (count === 0) {
    return "";
  }
  return ` <span class="likes" title="${escapeHtml(withCount(count, "like"))}">${HEART_SVG}${count}</span>`;
}

/** lucide-react's `Heart`, the icon the forum itself uses. */
const HEART_SVG = `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>`;

function renderContent(
  content: EditableContent | undefined,
  input: PageInput,
): string {
  if (!content) {
    return "";
  }
  const attachments = content.attachments.map((attachment) => {
    if (!isUploadKey(attachment)) {
      return `<img src="${escapeHtml(attachment)}" alt="">`;
    }
    const dataUri = input.attachments.get(attachment);
    return dataUri
      ? `<img src="${dataUri}" alt="">`
      : `<p class="missing">Attachment ${escapeHtml(attachment)} could not be read from storage.</p>`;
  });
  return `<div class="body">${input.bodies.get(content.id) ?? ""}${attachments.join("\n")}</div>`;
}

function displayName(user: Pick<User, "name" | "anonymous">): string {
  return user.anonymous ? "Someone" : user.name;
}

const pageStyles = `
:root { color-scheme: light; --link: rgb(98, 161, 36); --ink: #14181d;
  --muted: #71717a; --line: #e4e4e7; }
body { margin: 0; background: #fafafa; color: var(--ink);
  font: 15px/1.6 "Source Sans 3", system-ui, sans-serif; }
main { max-width: 44rem; margin: 0 auto; padding: 2rem 1.25rem 4rem; }
a { color: var(--link); text-decoration: underline; }
.masthead { border-bottom: 1px solid var(--line); margin: 0 0 2rem;
  padding-bottom: 1rem; }
.brand { font-size: 1.375rem; font-weight: 600; letter-spacing: .01em;
  margin: 0; }
.domain { color: var(--muted); font-weight: 400; text-decoration: none; }
.domain:hover { color: var(--ink); }
.notice { color: var(--muted); font-size: .8125rem; margin: .15rem 0 0; }
h1 { font-size: 1.75rem; line-height: 1.25; margin: 0 0 .5rem; }
h2 { font-size: 1.05rem; margin: 2.5rem 0 1.25rem; padding-top: 1.5rem;
  border-top: 1px solid var(--line); }
.byline { display: flex; align-items: center; gap: .35rem; flex-wrap: wrap;
  color: var(--muted); font-size: .8125rem; margin: 0 0 1rem; }
.author { color: var(--ink); font-weight: 600; }
.avatar { position: relative; flex: none; display: inline-flex;
  align-items: center; justify-content: center; overflow: hidden;
  border-radius: .25rem; background: #fff; box-shadow: inset 0 0 0 1px #d4d4d8;
  color: var(--muted); font-size: .75rem; }
.avatar img { position: absolute; inset: 0; width: 100%; height: 100%;
  object-fit: cover; }
.avatar-post { width: 2.25rem; height: 2.25rem; font-size: .875rem; }
.avatar-comment { width: 1.5rem; height: 1.5rem; }
.action { color: #52525b; font-size: .8125rem; margin: 0 0 1rem; }
.badge { background: var(--line); border-radius: 999px; padding: .05rem .5rem;
  font-size: .75rem; color: #3f3f46; }
.likes { display: inline-flex; align-items: center; gap: .15rem;
  color: #a1a1aa; font-size: .75rem; }
.likes svg { width: .85em; height: .85em; }
.post .body { font-size: 1.0625rem; }
.body img { max-width: 100%; height: auto; border-radius: .375rem;
  margin: .5rem 0; display: block; }
.body p { margin: 0 0 .75rem; }
.body pre { background: #f4f4f5; padding: .75rem; overflow-x: auto;
  border-radius: .375rem; }
.body blockquote { margin: 0 0 .75rem; padding-left: .75rem;
  border-left: 3px solid #d4d4d8; color: #52525b; }
.thread { list-style: none; margin: 0; padding-left: 1.25rem; }
.thread .thread { margin-top: 1rem; border-left: 2px solid var(--line); }
.comment { margin-bottom: 1.5rem; font-size: .9375rem; }
.comment .byline { margin-bottom: .35rem; }
.deleted, .missing, .empty { color: #a1a1aa; font-style: italic; }
footer { margin-top: 3rem; font-size: .8125rem; }
`;
