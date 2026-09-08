type FontScaleSource = {
  read: () => number;
  watch: (onChange: () => void) => void;
};

export function createFontScaleStore(source: FontScaleSource) {
  const listeners = new Set<() => void>();
  let fontScale = source.read();
  let watching = false;

  function refresh() {
    const next = source.read();
    if (next === fontScale) return;
    fontScale = next;
    listeners.forEach((listener) => listener());
  }

  return {
    subscribe(notify: () => void) {
      listeners.add(notify);

      if (!watching) {
        watching = true;
        source.watch(refresh);
      }

      // A change can land before `watch` registers, so catch up rather than
      // trust the initial read. On iOS that is the accessibility manager
      // coming up after the scale of 1 the app starts with.
      refresh();

      return () => {
        listeners.delete(notify);
      };
    },
    getSnapshot: () => fontScale,
  };
}
