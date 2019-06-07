declare const webextStorageCache: {
  get<TValue extends unknown = unknown>(key: string): Promise<TValue | undefined>;
  has(key: string): Promise<boolean>;
  set<TValue extends unknown = unknown>(key: string, value: TValue, expiration: number): Promise<void>;
}

export default webextStorageCache;