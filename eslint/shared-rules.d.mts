import type { Linter } from "eslint";

declare const sharedRules: Linter.Config[];
export default sharedRules;

export declare function envReadsOnlyIn(params: {
  files: string[];
  ignores?: string[];
  selector: string;
  reader: string;
}): Linter.Config;
type EnvReads = { selector: string; reader: string };
export declare const serverEnvReads: EnvReads;
export declare const webEnvReads: EnvReads;
export declare const mobileEnvReads: EnvReads;
export declare const sharedEnvReads: EnvReads;
export declare const frontendBlockerImport: {
  name: string;
  importNames: string[];
  message: string;
};
