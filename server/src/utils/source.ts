export type AsyncSource<T> = Promise<T> | (() => Promise<T>);

export function cachedSource<T>(value: AsyncSource<T>): AsyncSource<T> {
  if (typeof value !== 'function') {
    return value;
  }

  let cachedValue: Promise<T> | null = null;
  return () => {
    if (cachedValue === null) {
      cachedValue = value();
    }
    return cachedValue;
  };
}

export function getSourceValue<T>(source: AsyncSource<T>): Promise<T> {
  if (typeof source === 'function') {
    return source();
  }
  return source;
}
