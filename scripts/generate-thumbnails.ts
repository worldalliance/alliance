import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { FAKES_DIR, FakeKind, loadFakeFiles } from "./lib/fakes";
import { actionIdByName, api, firstAdminId } from "./lib/local-api";
import { queryLocalDb } from "./lib/local-db";

const THUMBNAILS_DIR = path.join(FAKES_DIR, "thumbnails");
const MODEL = "gpt-image-2";
const STYLE =
  "Candid square smartphone photo, as if a volunteer snapped it while doing the task. Natural light, true-to-life color, shallow depth of field, slightly imperfect framing. No text, captions, logos or watermarks.";

const imageResponse = z.object({
  data: z.array(z.object({ b64_json: z.string() })).length(1),
});

async function generate(prompt: string): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${prompt}\n\n${STYLE}`,
      size: "1024x1024",
      n: 1,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  const [image] = imageResponse.parse(JSON.parse(text)).data;
  return Buffer.from(image.b64_json, "base64");
}

async function watermark(png: Buffer): Promise<Buffer> {
  const { width, height } = await sharp(png).metadata();
  if (!width || !height) throw new Error("thumbnail has no dimensions");
  const size = Math.round(width * 0.06);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <text x="${width - size * 0.6}" y="${height - size * 0.6}" text-anchor="end"
      font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size}"
      fill="white" fill-opacity="0.6" stroke="black" stroke-opacity="0.25" stroke-width="${size / 30}">AI</text>
  </svg>`;
  return sharp(png)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}

async function attach(params: {
  admin: number;
  actionName: string;
  png: string;
  alt: string;
}): Promise<string> {
  const actionId = actionIdByName(params.actionName);
  if (actionId === null) return "no action in the local db, not attached";
  const [action] = queryLocalDb<{ squareThumbnailImage: string | null }>(
    `SELECT "squareThumbnailImage" FROM action WHERE id = ${actionId}`,
  );
  if (action?.squareThumbnailImage) return `action ${actionId} already has one`;
  const marked = await watermark(fs.readFileSync(params.png));
  const { key } = await api<{ key: string }>({
    as: params.admin,
    method: "POST",
    route: "/images/uploadImage",
    body: { file: `data:image/png;base64,${marked.toString("base64")}` },
  });
  await api({
    as: params.admin,
    method: "PATCH",
    route: `/actions/${actionId}`,
    body: { squareThumbnailImage: key, squareThumbnailImageAlt: params.alt },
  });
  return `attached to action ${actionId}`;
}

const admin = firstAdminId();
fs.mkdirSync(THUMBNAILS_DIR, { recursive: true });
let failed = false;
for (const { file, fake } of loadFakeFiles()) {
  if (fake.kind !== FakeKind.Fake) continue;
  const png = path.join(THUMBNAILS_DIR, file.replace(/\.yml$/, ".png"));
  try {
    const generated = !fs.existsSync(png);
    if (generated) fs.writeFileSync(png, await generate(fake.thumbnailPrompt));
    const attached = await attach({
      admin,
      actionName: fake.action.name,
      png,
      alt: fake.thumbnailPrompt,
    });
    console.log(`${file}: ${generated ? "generated" : "cached"}, ${attached}`);
  } catch (error) {
    failed = true;
    console.error(`${file}: ${error instanceof Error ? error.message : error}`);
  }
}
if (failed) process.exit(1);
