/** Sets `key`, or deletes it for `undefined`, which assignment would store as the string "undefined". */
export function setEnv(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}
