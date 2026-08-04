import toMilliseconds, {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {
	type CacheValue,
	readItem,
	writeItem,
	deleteItem,
	timeInTheFuture,
} from './shared.js';

export type CacheKey<Arguments extends unknown[]> = (arguments_: Arguments) => string;

function getUserKey<Arguments extends unknown[]>(
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
	Updater extends (...arguments_: any[]) => Promise<CacheValue>,
	ScopedValue extends CacheValue = Awaited<ReturnType<Updater>>,
	Arguments extends Parameters<Updater> = Parameters<Updater>,
> {
	readonly #updater: Updater;
	readonly #cacheKey: CacheKey<Arguments> | undefined;
	readonly #shouldRevalidate: ((cachedValue: ScopedValue) => boolean) | undefined;
	readonly #inFlight = new Map<string, Promise<ScopedValue>>();
	readonly #totalMaxAge: TimeDescriptor;
	readonly maxAge: TimeDescriptor;
	readonly staleWhileRevalidate: TimeDescriptor;

	// The only reason this is not a constructor method is TypeScript: `get` must be `typeof Updater`
	get = (async (...arguments_: Arguments) => {
		const {userKey, cached} = await this.#readCached(arguments_);

		if (!cached || this.#shouldRevalidate?.(cached.data)) {
			return this.#updateOnce(userKey, arguments_);
		}

		// When the expiration is earlier than the number of days specified by `staleWhileRevalidate`, it means `maxAge` has already passed and therefore the cache is stale.
		if (timeInTheFuture(this.staleWhileRevalidate) > cached.maxAge) {
			setTimeout(() => {
				this.#updateOnce(userKey, arguments_).catch(() => undefined);
			}, 0);
		}

		return cached.data;
	}) as unknown as Updater;

	readonly name: string;

	constructor(
		name: string,
		options: {
			updater: Updater;
			maxAge?: TimeDescriptor;
			staleWhileRevalidate?: TimeDescriptor;
			cacheKey?: CacheKey<Arguments>;
			shouldRevalidate?: (cachedValue: ScopedValue) => boolean;
		},
	) {
		this.name = name;
		this.#cacheKey = options.cacheKey;
		this.#updater = options.updater;
		this.#shouldRevalidate = options.shouldRevalidate;
		this.maxAge = options.maxAge ?? {days: 30};
		this.staleWhileRevalidate = options.staleWhileRevalidate ?? {days: 0};
		this.#totalMaxAge = {milliseconds: toMilliseconds(this.maxAge) + toMilliseconds(this.staleWhileRevalidate)};
	}

	async getCached(...arguments_: Arguments): Promise<ScopedValue | undefined> {
		const {cached} = await this.#readCached(arguments_);
		return cached?.data;
	}

	async applyOverride(arguments_: Arguments, value: ScopedValue) {
		if (arguments.length < 2) {
			throw new TypeError('Expected a value to be stored');
		}

		const userKey = this.#getUserKey(arguments_);
		return writeItem(userKey, value, this.#totalMaxAge);
	}

	async getFresh(...arguments_: Arguments): Promise<ScopedValue> {
		const userKey = this.#getUserKey(arguments_);
		return this.#refresh(userKey, arguments_);
	}

	async delete(...arguments_: Arguments) {
		const userKey = this.#getUserKey(arguments_);
		await deleteItem(userKey);
	}

	async isCached(...arguments_: Arguments) {
		const {cached} = await this.#readCached(arguments_);
		return cached !== undefined;
	}

	#getUserKey(arguments_: Arguments): string {
		return getUserKey(this.name, this.#cacheKey, arguments_);
	}

	async #readCached(arguments_: Arguments) {
		const userKey = this.#getUserKey(arguments_);
		return {userKey, cached: await readItem<ScopedValue>(userKey)};
	}

	async #refresh(userKey: string, arguments_: Arguments): Promise<ScopedValue> {
		const freshValue = await this.#updater(...arguments_) as ScopedValue;
		return writeItem(userKey, freshValue, this.#totalMaxAge);
	}

	async #updateOnce(userKey: string, arguments_: Arguments): Promise<ScopedValue> {
		let promise = this.#inFlight.get(userKey);
		if (!promise) {
			promise = this.#refresh(userKey, arguments_);
			this.#inFlight.set(userKey, promise);
			const clear = () => {
				this.#inFlight.delete(userKey);
			};

			promise.then(clear, clear);
		}

		return promise;
	}
}
