import fs from "node:fs";
import path from "node:path";
import sharp from "sharp";
import { z } from "zod";
import { FAKES_DIR, FakeKind, loadFakeFiles } from "./lib/fakes";
import { actionIdByName, api, firstAdminId } from "./lib/local-api";
import { queryLocalDb } from "./lib/local-db";

enum Slot {
  Thumbnail = "thumbnail",
  Cover = "cover",
}

enum MarkPosition {
  BottomRight = "bottom-right",
  Center = "center",
}

const MODEL = "gpt-image-2";
const STYLE =
  "Candid smartphone photo, as if a volunteer snapped it while doing the task. Natural light, true-to-life color, shallow depth of field, slightly imperfect framing. No text, captions, logos or watermarks.";

const SLOTS: Record<
  Slot,
  {
    dir: string;
    size: string;
    framing: string;
    mark: MarkPosition;
    column: "squareThumbnailImage" | "image";
    fields: (key: string, alt: string) => Record<string, string>;
  }
> = {
  [Slot.Thumbnail]: {
    dir: path.join(FAKES_DIR, "thumbnails"),
    size: "1024x1024",
    framing: "Square frame.",
    mark: MarkPosition.BottomRight,
    column: "squareThumbnailImage",
    fields: (key, alt) => ({
      squareThumbnailImage: key,
      squareThumbnailImageAlt: alt,
    }),
  },
  // The cover renders as a short, full-width banner cropped around its middle.
  [Slot.Cover]: {
    dir: path.join(FAKES_DIR, "covers"),
    size: "1536x1024",
    framing:
      "Wide landscape frame with the subject in a horizontal band across the middle, so a thin strip cropped from the center still shows it.",
    mark: MarkPosition.Center,
    column: "image",
    fields: (key) => ({ image: key }),
  },
};

const imageResponse = z.object({
  data: z.array(z.object({ b64_json: z.string() })).length(1),
});

async function generate(params: {
  prompt: string;
  slot: Slot;
}): Promise<Buffer> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) throw new Error("OPENAI_API_KEY is not set");
  const { size, framing } = SLOTS[params.slot];
  const response = await fetch("https://api.openai.com/v1/images/generations", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      prompt: `${params.prompt}\n\n${STYLE} ${framing}`,
      size,
      n: 1,
    }),
  });
  const text = await response.text();
  if (!response.ok) throw new Error(`${response.status} ${text}`);
  const [image] = imageResponse.parse(JSON.parse(text)).data;
  return Buffer.from(image.b64_json, "base64");
}

function markSvg(params: {
  width: number;
  height: number;
  position: MarkPosition;
}): string {
  const { width, height } = params;
  const text = (attrs: string, size: number, opacity: number) =>
    `<text ${attrs} font-family="Helvetica, Arial, sans-serif" font-weight="700" font-size="${size}" fill="white" fill-opacity="${opacity}" stroke="black" stroke-opacity="0.25" stroke-width="${size / 30}">AI</text>`;
  switch (params.position) {
    case MarkPosition.BottomRight: {
      const size = Math.round(width * 0.06);
      return text(
        `x="${width - size * 0.6}" y="${height - size * 0.6}" text-anchor="end"`,
        size,
        0.6,
      );
    }
    case MarkPosition.Center:
      return text(
        `x="${width / 2}" y="${height / 2}" text-anchor="middle" dominant-baseline="central"`,
        Math.round(height * 0.12),
        0.45,
      );
    default:
      throw new Error(
        `unknown mark position: ${params.position satisfies never}`,
      );
  }
}

async function watermark(params: {
  png: Buffer;
  position: MarkPosition;
}): Promise<Buffer> {
  const { width, height } = await sharp(params.png).metadata();
  if (!width || !height) throw new Error("image has no dimensions");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">${markSvg({ width, height, position: params.position })}</svg>`;
  return sharp(params.png)
    .composite([{ input: Buffer.from(svg) }])
    .png()
    .toBuffer();
}

async function attach(params: {
  admin: number;
  actionId: number;
  slot: Slot;
  png: string;
  alt: string;
}): Promise<string> {
  const { column, mark, fields } = SLOTS[params.slot];
  const [action] = queryLocalDb<{ current: string | null }>(
    `SELECT "${column}" AS current FROM action WHERE id = ${params.actionId}`,
  );
  if (action?.current) return "already set";
  const marked = await watermark({
    png: fs.readFileSync(params.png),
    position: mark,
  });
  const { key } = await api<{ key: string }>({
    as: params.admin,
    method: "POST",
    route: "/images/uploadImage",
    body: { file: `data:image/png;base64,${marked.toString("base64")}` },
  });
  await api({
    as: params.admin,
    method: "PATCH",
    route: `/actions/${params.actionId}`,
    body: fields(key, params.alt),
  });
  return "attached";
}

const admin = firstAdminId();
let failed = false;
for (const { file, fake } of loadFakeFiles()) {
  if (fake.kind !== FakeKind.Fake) continue;
  const actionId = actionIdByName(fake.action.name);
  for (const slot of Object.values(Slot)) {
    const { dir } = SLOTS[slot];
    fs.mkdirSync(dir, { recursive: true });
    const png = path.join(dir, file.replace(/\.yml$/, ".png"));
    try {
      const generated = !fs.existsSync(png);
      if (generated) {
        fs.writeFileSync(
          png,
          await generate({ prompt: fake.imagePrompt, slot }),
        );
      }
      const attached =
        actionId === null
          ? "no action in the local db, not attached"
          : `action ${actionId} ${await attach({ admin, actionId, slot, png, alt: fake.imagePrompt })}`;
      console.log(
        `${file} ${slot}: ${generated ? "generated" : "cached"}, ${attached}`,
      );
    } catch (error) {
      failed = true;
      console.error(
        `${file} ${slot}: ${error instanceof Error ? error.message : error}`,
      );
    }
  }
}
if (failed) process.exit(1);
