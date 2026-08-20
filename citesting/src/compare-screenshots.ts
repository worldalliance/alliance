import { promises as fs } from "fs";
import path from "path";
import pixelmatch from "pixelmatch";
import { PNG } from "pngjs";

const logPrefix = "[citesting:compare]";

const main = async () => {
  const [baselineDir, currentDir, diffDir] = process.argv.slice(2);

  if (!baselineDir || !currentDir || !diffDir) {
    console.error(
      `Usage: ts-node compare-screenshots.ts <baselineDir> <currentDir> <diffDir>`,
    );
    process.exit(1);
  }

  await fs.mkdir(diffDir, { recursive: true });

  const currentFiles = (await fs.readdir(currentDir)).filter((f) =>
    f.endsWith(".png"),
  );

  if (currentFiles.length === 0) {
    console.log(`${logPrefix} No PNG files found in ${currentDir}`);
    process.exit(0);
  }

  let totalDiffs = 0;
  const stats: Record<
    string,
    { diffPixels: number; totalPixels: number; pct: number }
  > = {};

  const padToSize = (img: PNG, w: number, h: number): PNG => {
    if (img.width === w && img.height === h) return img;
    const padded = new PNG({ width: w, height: h, fill: true });
    for (let i = 0; i < padded.data.length; i += 4) {
      padded.data[i] = 255;
      padded.data[i + 1] = 255;
      padded.data[i + 2] = 255;
      padded.data[i + 3] = 255;
    }
    PNG.bitblt(img, padded, 0, 0, img.width, img.height, 0, 0);
    return padded;
  };

  for (const file of currentFiles) {
    const baselinePath = path.join(baselineDir, file);
    const currentPath = path.join(currentDir, file);

    const baselineExists = await fs
      .access(baselinePath)
      .then(() => true)
      .catch(() => false);

    if (!baselineExists) {
      console.log(`${logPrefix} [NEW] ${file} — no baseline, skipping`);
      continue;
    }

    const baselineImg = PNG.sync.read(await fs.readFile(baselinePath));
    const currentImg = PNG.sync.read(await fs.readFile(currentPath));

    const width = Math.max(baselineImg.width, currentImg.width);
    const height = Math.max(baselineImg.height, currentImg.height);

    const paddedBaseline = padToSize(baselineImg, width, height);
    const paddedCurrent = padToSize(currentImg, width, height);

    const diff = new PNG({ width, height });
    const diffPixels = pixelmatch(
      paddedBaseline.data,
      paddedCurrent.data,
      diff.data,
      width,
      height,
      { threshold: 0.1 },
    );

    const totalPixels = width * height;
    const pct = Number(((diffPixels / totalPixels) * 100).toFixed(4));

    if (diffPixels > 0) {
      const diffPath = path.join(diffDir, file);
      await fs.writeFile(diffPath, PNG.sync.write(diff));
      console.log(
        `${logPrefix} [DIFF] ${file} — ${diffPixels} pixels (${pct}%)`,
      );
      stats[file] = { diffPixels, totalPixels, pct };
      totalDiffs++;
    } else {
      console.log(`${logPrefix} [OK]   ${file} — identical`);
    }
  }

  // Write stats JSON so ai-review can skip trivial diffs
  const statsPath = path.join(diffDir, "stats.json");
  await fs.writeFile(statsPath, JSON.stringify(stats, null, 2));

  console.log(
    `${logPrefix} Done. ${totalDiffs} of ${currentFiles.length} images have diffs.`,
  );
  // Always exit 0 — the AI review step decides pass/fail
  process.exit(0);
};

void main();
