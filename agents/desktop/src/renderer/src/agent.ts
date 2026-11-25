import type { AgentApi } from "../../shared/ipc";

declare global {
  interface Window {
    agent?: AgentApi;
  }
}

const exposed = window.agent;
if (!exposed) throw new Error("the preload didn't expose window.agent");
export const agent = exposed;
