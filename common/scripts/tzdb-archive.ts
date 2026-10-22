export async function download(url: string): Promise<Uint8Array> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`${url} answered ${response.status}`);
  }
  return new Uint8Array(await response.arrayBuffer());
}

export const sha512 = (bytes: Uint8Array) =>
  new Bun.CryptoHasher("sha512").update(bytes).digest("hex");

export async function readMember(
  archive: Uint8Array,
  member: string,
): Promise<string> {
  const tar = Bun.spawn(["tar", "-xzOf", "-", member], {
    stdin: archive,
    stderr: "inherit",
  });
  const text = await new Response(tar.stdout).text();
  if ((await tar.exited) !== 0) {
    throw new Error(`could not read ${member} out of the archive`);
  }
  return text;
}
