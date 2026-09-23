export function captureErrors(fn: () => void): unknown[][] {
  const original = console.error;
  const logged: unknown[][] = [];
  console.error = (...args: unknown[]) => logged.push(args);
  try {
    fn();
    return logged;
  } finally {
    console.error = original;
  }
}
