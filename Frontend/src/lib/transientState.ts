const transientState = new Map<string, unknown>();

export const readTransientState = <T>(key: string): T | null => {
  return transientState.has(key) ? (transientState.get(key) as T) : null;
};

export const writeTransientState = <T>(key: string, value: T): void => {
  transientState.set(key, value);
};

export const takeTransientState = <T>(key: string): T | null => {
  const value = readTransientState<T>(key);
  transientState.delete(key);
  return value;
};

export const removeTransientState = (key: string): void => {
  transientState.delete(key);
};
