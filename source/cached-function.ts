import {type AsyncReturnType} from 'type-fest';
import toMilliseconds, {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {type CacheValue} from './cached-value.js';
import cache, {type CacheKey, _get, timeInTheFuture} from './legacy.js';

function getUserKey<Arguments extends any[]>(
	name: string,
	cacheKey: CacheKey<Arguments> | undefined,
	arguments_: Arguments,
): string {
	if (!cacheKey) {
		if (arguments_.length === 0) {
			return name;
		}

		cacheKey = JSON.stringify;
	}

	return `${name}:${cacheKey(arguments_)}`;
}

export default class CachedFunction<
	// TODO: Review this type. While `undefined/null` can't be stored, the `updater` can return it to clear the cache
	Updater extends ((...arguments_: any[]) => Promise<CacheValue>),
	ScopedValue extends AsyncReturnType<Updater>,
	Arguments extends Parameters<Updater>,
> {
	readonly maxAge: TimeDescriptor;
	readonly staleWhileRevalidate: TimeDescriptor;

	// The only reason this is not a constructor method is TypeScript: `get` must be `typeof Updater`
	get = (async (...arguments_: Arguments) => {
		const getSet = async (
			userKey: string,
			arguments__: Arguments,
		): Promise<ScopedValue | undefined> => {
			const freshValue = await this.#updater(...arguments__);
			if (freshValue === undefined) {
				await cache.delete(userKey);
				return;
			}

			const milliseconds = toMilliseconds(this.maxAge) + toMilliseconds(this.staleWhileRevalidate);

			return cache.set(userKey, freshValue, {milliseconds}) as Promise<ScopedValue>;
		};

		const memoizeStorage = async (userKey: string, ...arguments__: Arguments) => {
			const cachedItem = await _get<ScopedValue>(userKey, false);
			if (cachedItem === undefined || this.#shouldRevalidate?.(cachedItem.data)) {
				return getSet(userKey, arguments__);
			}

			// When the expiration is earlier than the number of days specified by `staleWhileRevalidate`, it means `maxAge` has already passed and therefore the cache is stale.
			if (timeInTheFuture(this.staleWhileRevalidate) > cachedItem.maxAge) {
				setTimeout(getSet, 0, userKey, arguments__);
			}

			return cachedItem.data;
		};

		const userKey = getUserKey(this.name, this.#cacheKey, arguments_);
		const cached = this.#inFlightCache.get(userKey);
		if (cached) {
			// Avoid calling the same function twice while pending
			return cached as Promise<ScopedValue>;
		}

		const promise = memoizeStorage(userKey, ...arguments_);
		this.#inFlightCache.set(userKey, promise);
		const del = () => {
			this.#inFlightCache.delete(userKey);
		};

		// eslint-disable-next-line promise/prefer-await-to-then -- Just dealing with the primise
		promise.then(del, del);
		return promise as Promise<ScopedValue>;
	}) as unknown as Updater;

	readonly #updater: Updater;
	readonly #cacheKey: CacheKey<Arguments> | undefined;
	readonly #shouldRevalidate: ((cachedValue: ScopedValue) => boolean) | undefined;
	readonly #inFlightCache = new Map<string, Promise<ScopedValue | undefined>>();

	constructor(
		public name: string,
		readonly options: {
			updater: Updater;
			maxAge?: TimeDescriptor;
			staleWhileRevalidate?: TimeDescriptor;
			cacheKey?: CacheKey<Arguments>;
			shouldRevalidate?: (cachedValue: ScopedValue) => boolean;
		},
	) {
		this.#cacheKey = options.cacheKey;
		this.#updater = options.updater;
		this.#shouldRevalidate = options.shouldRevalidate;
		this.maxAge = options.maxAge ?? {days: 30};
		this.staleWhileRevalidate = options.staleWhileRevalidate ?? {days: 0};
	}

	async getCached(...arguments_: Arguments): Promise<ScopedValue | undefined> {
		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, arguments_);
		return cache.get(userKey) as Promise<ScopedValue>;
	}

	async applyOverride(arguments_: Arguments, value: ScopedValue) {
		if (arguments.length === 0) {
			throw new TypeError('Expected a value to be stored');
		}

		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, arguments_);
		return cache.set(userKey, value, this.maxAge);
	}

	async getFresh(...arguments_: Arguments): Promise<ScopedValue> {
		if (this.#updater === undefined) {
			throw new TypeError('Cannot get fresh value without updater');
		}

		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, arguments_);
		return cache.set(userKey, await this.#updater(...arguments_)) as Promise<ScopedValue>;
	}

	async delete(...arguments_: Arguments) {
		const userKey = getUserKey<Arguments>(this.name, this.#cacheKey, arguments_);
		return cache.delete(userKey);
	}

	async isCached(...arguments_: Arguments) {
		return (await this.get(...arguments_)) !== undefined;
	}
}
