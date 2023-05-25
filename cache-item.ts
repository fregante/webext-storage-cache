import {type JsonValue} from 'type-fest';
import toMilliseconds, {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import cache, {getUserKey, type CacheKey, defaultSerializer, _get, timeInTheFuture} from './index.js';

// eslint-disable-next-line @typescript-eslint/ban-types -- It is a JSON value
export type CacheValue = Exclude<JsonValue, null>;

export type CacheOptions <
	ScopedValue,
	Updater extends ((...args: unknown[]) => Promise<ScopedValue>) = ((...args: unknown[]) => Promise<ScopedValue>),
	Arguments extends unknown[] = Parameters<Updater>,
> = {
	maxAge?: TimeDescriptor;
	staleWhileRevalidate?: TimeDescriptor;
	cacheKey?: CacheKey<Arguments>;
	shouldRevalidate?: (cachedValue: ScopedValue) => boolean;
	updater?: Updater;
};

export default class CacheItem<
	ScopedValue extends CacheValue,
	Updater extends ((...args: unknown[]) => Promise<ScopedValue>) = ((...args: unknown[]) => Promise<ScopedValue>),
	Arguments extends unknown[] = Parameters<Updater>,
> {
	#cacheKey: CacheKey<Arguments>;
	#updater: Updater | undefined;
	#shouldRevalidate: ((cachedValue: ScopedValue) => boolean) | undefined;
	readonly maxAge: TimeDescriptor;
	readonly staleWhileRevalidate: TimeDescriptor;

	constructor(
		public name: string,
		readonly options: CacheOptions<ScopedValue> = {},
	) {
		this.#cacheKey = options.cacheKey ?? defaultSerializer;
		this.#updater = options.updater as Updater | undefined;
		this.#shouldRevalidate = options.shouldRevalidate;
		this.maxAge = options.maxAge ?? {days: 30};
		this.staleWhileRevalidate = options.staleWhileRevalidate ?? {days: 0};
		console.log('done');
	}

	async getCached(...args: Arguments) {
		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, args);
		return cache.get(userKey);
	}

	async set(value: ScopedValue, ...args: Arguments) {
		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, args);
		return cache.set(userKey, value, this.maxAge);
	}

	async getFresh(...args: Arguments) {
		if (this.#updater === undefined) {
			throw new TypeError('Cannot get fresh value without updater');
		}

		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, args);
		return cache.set(userKey, await this.#updater(...args));
	}

	async delete(...args: Arguments) {
		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, args);
		return cache.delete(userKey);
	}

	async get(...args: Arguments) {
		const inFlightCache = new Map<string, Promise<ScopedValue | undefined>>();
		const getSet = async (
			userKey: string,
			args: Arguments,
		): Promise<ScopedValue | undefined> => {
			const freshValue = await this.#updater!(...args);
			if (freshValue === undefined) {
				await cache.delete(userKey);
				return;
			}

			const milliseconds = toMilliseconds(this.maxAge) + toMilliseconds(this.staleWhileRevalidate);

			return cache.set<ScopedValue>(userKey, freshValue, {milliseconds});
		};

		const memoizeStorage = async (userKey: string, ...args: Arguments) => {
			const cachedItem = await _get<ScopedValue>(userKey, false);
			if (cachedItem === undefined || this.#shouldRevalidate?.(cachedItem.data)) {
				return getSet(userKey, args);
			}

			// When the expiration is earlier than the number of days specified by `staleWhileRevalidate`, it means `maxAge` has already passed and therefore the cache is stale.
			if (timeInTheFuture(this.staleWhileRevalidate) > cachedItem.maxAge) {
				setTimeout(getSet, 0, userKey, args);
			}

			return cachedItem.data;
		};

		const userKey = getUserKey(this.name, this.#cacheKey, args);
		if (inFlightCache.has(userKey)) {
			// Avoid calling the same function twice while pending
			return inFlightCache.get(userKey);
		}

		const promise = memoizeStorage(userKey, ...args);
		inFlightCache.set(userKey, promise);
		const del = () => {
			inFlightCache.delete(userKey);
		};

		promise.then(del, del);
		return promise;
	}
}
