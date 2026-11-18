import { existsSync } from "node:fs";
import { setTimeout } from "node:timers/promises";
import { z } from "zod";
import { ImageMediaType } from "../../session";
import { RpcConnection } from "../rpc";

const turnStartImages = z.object({
  input: z.array(z.object({ type: z.string(), path: z.string().optional() })),
});

export function watchSentImages() {
  const sent: string[] = [];
  const existedWhenSent: boolean[] = [];
  const request = RpcConnection.prototype.request;
  RpcConnection.prototype.request = function (method, params) {
    if (method === "turn/start")
      for (const input of turnStartImages.parse(params).input)
        if (input.type === "localImage" && input.path) {
          sent.push(input.path);
          existedWhenSent.push(existsSync(input.path));
        }
    return request.call(this, method, params);
  };
  return {
    async afterTurn() {
      RpcConnection.prototype.request = request;
      for (let tries = 0; tries < 50 && sent.some(existsSync); tries++)
        await setTimeout(20);
      return { existedWhenSent, remaining: sent.filter(existsSync) };
    },
  };
}

export const redPixel = {
  text: "What colour?",
  images: [{ mediaType: ImageMediaType.Png, data: new Uint8Array([1]) }],
};
