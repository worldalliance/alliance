/** Makes `window.localStorage` throw as a browser blocking site data does, and returns the undo. */
export const blockStorage = () => {
  const real = Object.getOwnPropertyDescriptor(window, "localStorage");
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get: () => {
      throw new DOMException("blocked", "SecurityError");
    },
  });
  return () => {
    if (real) Object.defineProperty(window, "localStorage", real);
  };
};
