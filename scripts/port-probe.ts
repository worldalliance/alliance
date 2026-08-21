/*
 * Exit 0 when any port answers, 1 when all are free, and 2 on invalid input or
 * failure. Connect to IPv4 and IPv6 because Vite may bind either; binding a test
 * socket is unreliable with BSD SO_REUSEADDR.
 */
import net from "node:net";

const HOSTNAMES = ["127.0.0.1", "::1"];

function parsePorts(args: string[]): number[] | null {
  if (args.length === 0) return null;

  const ports = args.map(Number);
  const valid = ports.every(
    (port) => Number.isInteger(port) && port >= 1 && port <= 65535,
  );

  return valid ? ports : null;
}

function reachable(host: string, port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = net.connect({ host, port });

    const settle = (inUse: boolean) => {
      socket.destroy();
      resolve(inUse);
    };

    socket.once("connect", () => settle(true));
    socket.once("error", () => settle(false));
  });
}

async function anyInUse(ports: number[]): Promise<boolean> {
  for (const port of ports) {
    for (const hostname of HOSTNAMES) {
      if (await reachable(hostname, port)) return true;
    }
  }

  return false;
}

function main(): void {
  const ports = parsePorts(process.argv.slice(2));

  if (!ports) {
    console.error("usage: bun scripts/port-probe.ts <port>...");
    process.exit(2);
  }

  anyInUse(ports).then(
    (inUse) => process.exit(inUse ? 0 : 1),
    (error: unknown) => {
      console.error(error);
      process.exit(2);
    },
  );
}

main();
