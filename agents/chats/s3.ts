import {
  GetObjectCommand,
  type GetObjectCommandOutput,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from "@aws-sdk/client-s3";
import { HttpsProxyAgent } from "https-proxy-agent";
import { Readable, Transform, pipeline } from "node:stream";
import { R, type Result } from "../../common/src/result";

export type S3Credentials = {
  accessKeyId: string;
  secretAccessKey: string;
  sessionToken?: string;
};

const bucket = "alliance-agent-chats";
const conflictTries = 5;

// The handler's idle timeout stops at the response's headers, so a body that
// stalls after them would hang its request forever.
function idleBounded(body: Readable, idleTimeoutMs: number): Readable {
  let timer: Timer | undefined;
  const arm = () => {
    clearTimeout(timer);
    timer = setTimeout(
      () =>
        body.destroy(
          Object.assign(
            new Error(`the response body was idle for ${idleTimeoutMs} ms`),
            { name: "TimeoutError" },
          ),
        ),
      idleTimeoutMs,
    );
  };
  const out = new Transform({
    transform(chunk, _encoding, done) {
      arm();
      done(null, chunk);
    },
  });
  arm();
  pipeline(body, out, () => clearTimeout(timer));
  return out;
}

// Only HTTPS_PROXY and NO_PROXY count, the variables the AWS CLI documents,
// and both are read as the CLI's Python urllib reads them: a NO_PROXY entry
// matches its host and every subdomain, and a value without a scheme is a plain
// HTTP proxy. Another scheme fails where the CLI would mistake it for a host.
function proxyAgent(): Result<HttpsProxyAgent<string> | undefined, string> {
  const variable =
    process.env.https_proxy === undefined ? "HTTPS_PROXY" : "https_proxy";
  const proxy = process.env[variable];
  if (!proxy || bypassesProxy(`${bucket}.s3.us-west-2.amazonaws.com`))
    return R.success(undefined);
  const http = /^https?:/i.test(proxy);
  const scheme = /^([a-z][a-z0-9+.-]*):\/\//i.exec(proxy)?.[1];
  if (!http && scheme)
    return R.failure(
      `${variable} uses ${scheme}:, which transcript uploads can't use; set an http or https proxy, or unset it`,
    );
  const url = http ? proxy : `http://${proxy.replace(/^\/\//, "")}`;
  return R.success(new HttpsProxyAgent(url, { keepAlive: true }));
}

function bypassesProxy(host: string): boolean {
  const noProxy = process.env.no_proxy ?? process.env.NO_PROXY ?? "";
  if (noProxy.trim() === "*") return true;
  return noProxy.split(",").some((entry) => {
    const domain = entry.trim().replace(/^\.+/, "").toLowerCase();
    return domain !== "" && (host === domain || host.endsWith(`.${domain}`));
  });
}

export function chatsClient(
  credentials: S3Credentials,
  { idleTimeoutMs = 30_000 } = {},
): Result<S3Client, string> {
  const override = process.env.ALLIANCE_AGENT_CHATS_S3_ENDPOINT;
  if (
    override &&
    !["127.0.0.1", "localhost"].includes(new URL(override).hostname)
  )
    return R.failure(
      "ALLIANCE_AGENT_CHATS_S3_ENDPOINT must be a loopback URL; it is for tests",
    );
  const agent = override ? R.success(undefined) : proxyAgent();
  if (!agent.ok) return agent;
  const s3 = new S3Client({
    region: "us-west-2",
    credentials,
    // AWS_MAX_ATTEMPTS or a profile's max_attempts would stretch the timeouts below.
    maxAttempts: 3,
    // A connection gone silent, as after a laptop sleeps, never settles alone.
    requestHandler: {
      connectionTimeout: 5_000,
      socketTimeout: idleTimeoutMs,
      httpsAgent: agent.value,
    },
    // An explicit endpoint outranks AWS_ENDPOINT_URL_S3, AWS_ENDPOINT_URL and a
    // profile's endpoint_url, which would send transcripts elsewhere.
    endpoint: override || "https://s3.us-west-2.amazonaws.com",
    forcePathStyle: Boolean(override),
    // The SDK rejects an explicit endpoint alongside a FIPS or dual-stack setting.
    useFipsEndpoint: false,
    useDualstackEndpoint: false,
  });
  s3.middlewareStack.add(
    (next) => async (args) => {
      const out = await next(args);
      const { response } = out;
      if (
        typeof response === "object" &&
        response &&
        "body" in response &&
        response.body instanceof Readable
      )
        response.body = idleBounded(response.body, idleTimeoutMs);
      return out;
    },
    { step: "deserialize", priority: "low" },
  );
  return R.success(s3);
}

const status = (error: unknown) =>
  error instanceof S3ServiceException
    ? error.$metadata.httpStatusCode
    : undefined;

function s3Failure(error: unknown): string {
  const { name, message } = R.toError(error);
  const code = status(error);
  return `${name}${code ? ` (${code})` : ""}: ${message}`;
}

function readBody(output: GetObjectCommandOutput) {
  return R.fromPromise(
    output.Body?.transformToByteArray() ?? Promise.resolve(new Uint8Array()),
  );
}

// A HEAD error response has no body, so S3's code and message come from a GET
// that fails with the same status.
async function headFailure(params: {
  s3: S3Client;
  key: string;
  error: unknown;
}): Promise<string> {
  const { s3, key, error } = params;
  if (status(error) === undefined) return s3Failure(error);
  const got = await R.fromPromise(
    s3.send(
      new GetObjectCommand({ Bucket: bucket, Key: key, Range: "bytes=0-0" }),
    ),
  );
  if (!got.ok)
    return s3Failure(status(got.error) === status(error) ? got.error : error);
  await readBody(got.value);
  return s3Failure(error);
}

/** Puts `file`'s bytes, read after a HEAD of `key`, only while `key` still
 * holds what that HEAD saw, starting over when it changed meanwhile, so a
 * delayed put of older bytes never replaces newer ones. */
export async function putLatest(params: {
  s3: S3Client;
  key: string;
  file: string;
}): Promise<Result<void, string>> {
  const { s3, key, file } = params;
  for (let tries = 0; tries < conflictTries; tries++) {
    const head = await R.fromPromise(
      s3.send(new HeadObjectCommand({ Bucket: bucket, Key: key })),
    );
    if (!head.ok && status(head.error) !== 404)
      return R.failure(await headFailure({ s3, key, error: head.error }));
    const etag = head.ok ? head.value.ETag : undefined;
    if (head.ok && !etag) return R.failure(`HEAD of ${key} returned no ETag`);
    const body = await R.fromPromise(Bun.file(file).bytes());
    if (!body.ok)
      return R.failure(`could not read ${file}: ${body.error.message}`);
    const put = await R.fromPromise(
      s3.send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: body.value,
          ...(etag ? { IfMatch: etag } : { IfNoneMatch: "*" }),
        }),
      ),
    );
    if (put.ok) return R.success(undefined);
    const code = status(put.error);
    // 404 under If-Match is a concurrent delete; otherwise a missing bucket.
    const conflict = code === 409 || code === 412 || (etag && code === 404);
    if (!conflict) return R.failure(s3Failure(put.error));
  }
  return R.failure(`${key} changed during each of ${conflictTries} tries`);
}

export async function getObject(params: {
  s3: S3Client;
  key: string;
}): Promise<Result<Uint8Array, string>> {
  const got = await R.fromPromise(
    params.s3.send(new GetObjectCommand({ Bucket: bucket, Key: params.key })),
  );
  if (!got.ok) return R.failure(s3Failure(got.error));
  const bytes = await readBody(got.value);
  return bytes.ok ? bytes : R.failure(s3Failure(bytes.error));
}
