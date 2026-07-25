import chromeP from 'webext-polyfill-kinda';
import toMilliseconds, {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {type CacheValue} from './cached-value.js';

export type CacheKey<Arguments extends unknown[]> = (arguments_: Arguments) => string;

type CachedItem<Value> = {
	data: Value;
	maxAge: number;
};

function timeInTheFuture(time: TimeDescriptor): number {
	return Date.now() + toMilliseconds(time);
}

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

async function readItem<Value extends CacheValue>(userKey: string): Promise<CachedItem<Value> | undefined> {
	const internalKey = `cache:${userKey}`;
	const storageData: Record<string, CachedItem<Value>> = await chromeP.storage.local.get(internalKey);
	const item = storageData[internalKey];
	return item !== undefined && Date.now() <= item.maxAge ? item : undefined;
}

async function writeItem<Value extends CacheValue>(userKey: string, data: Value, maxAge: TimeDescriptor): Promise<Value> {
	const internalKey = `cache:${userKey}`;
	await chromeP.storage.local.set({
		[internalKey]: {data, maxAge: timeInTheFuture(maxAge)},
	});
	return data;
}

async function deleteItem(userKey: string): Promise<void> {
	await chromeP.storage.local.remove(`cache:${userKey}`);
}

export default class CachedFunction<
	Updater extends (...arguments_: any[]) => Promise<CacheValue>,
	ScopedValue extends Awaited<ReturnType<Updater>> = Awaited<ReturnType<Updater>>,
	Arguments extends Parameters<Updater> = Parameters<Updater>,
> {
	readonly maxAge: TimeDescriptor;
	readonly staleWhileRevalidate: TimeDescriptor;

	readonly #totalMaxAge: TimeDescriptor;
	readonly #updater: Updater;
	readonly #cacheKey: CacheKey<Arguments> | undefined;
	readonly #shouldRevalidate: ((cachedValue: ScopedValue) => boolean) | undefined;
	readonly #inFlight = new Map<string, Promise<ScopedValue | undefined>>();

	constructor(
		public name: string,
		options: {
			updater: Updater;
			maxAge?: TimeDescriptor;
			staleWhileRevalidate?: TimeDescriptor;
			cacheKey?: CacheKey<Arguments>;
			shouldRevalidate?: (cachedValue: ScopedValue) => boolean;
		},
	) {
		this.#updater = options.updater;
		this.#cacheKey = options.cacheKey;
		this.#shouldRevalidate = options.shouldRevalidate;
		this.maxAge = options.maxAge ?? {days: 30};
		this.staleWhileRevalidate = options.staleWhileRevalidate ?? {days: 0};
		this.#totalMaxAge = {milliseconds: toMilliseconds(this.maxAge) + toMilliseconds(this.staleWhileRevalidate)};
	}

	get = (async (...arguments_: Arguments): Promise<ScopedValue | undefined> => {
		const userKey = getUserKey(this.name, this.#cacheKey, arguments_);
		const cached = await readItem<ScopedValue>(userKey);

		if (cached === undefined || this.#shouldRevalidate?.(cached.data)) {
			return this.#updateOnce(userKey, arguments_);
		}

		if (timeInTheFuture(this.staleWhileRevalidate) > cached.maxAge) {
			setTimeout(() => {
				this.#updateOnce(userKey, arguments_).catch(() => {});
			}, 0);
		}

		return cached.data;
	}) as unknown as Updater;

	async getCached(...arguments_: Arguments): Promise<ScopedValue | undefined> {
		const userKey = getUserKey(this.name, this.#cacheKey, arguments_);
		return (await readItem<ScopedValue>(userKey))?.data;
	}

	async applyOverride(arguments_: Arguments, value: ScopedValue): Promise<ScopedValue> {
		if (arguments_.length === 0) {
			throw new TypeError('Expected a value to be stored');
		}

		const userKey = getUserKey(this.name, this.#cacheKey, arguments_);
		return writeItem(userKey, value, this.#totalMaxAge);
	}

	async getFresh(...arguments_: Arguments): Promise<ScopedValue> {
		const userKey = getUserKey(this.name, this.#cacheKey, arguments_);
		const value = await this.#updater(...arguments_) as ScopedValue;
		return writeItem(userKey, value, this.#totalMaxAge);
	}

	async delete(...arguments_: Arguments): Promise<void> {
		const userKey = getUserKey(this.name, this.#cacheKey, arguments_);
		await deleteItem(userKey);
	}

	async isCached(...arguments_: Arguments): Promise<boolean> {
		const userKey = getUserKey(this.name, this.#cacheKey, arguments_);
		return (await readItem<ScopedValue>(userKey)) !== undefined;
	}

	#updateOnce(userKey: string, arguments_: Arguments): Promise<ScopedValue | undefined> {
		let promise = this.#inFlight.get(userKey);
		if (!promise) {
			promise = this.#update(userKey, arguments_);
			this.#inFlight.set(userKey, promise);
			promise.finally(() => this.#inFlight.delete(userKey)).catch(() => {});
		}

		return promise;
	}

	async #update(userKey: string, arguments_: Arguments): Promise<ScopedValue | undefined> {
		const freshValue = await this.#updater(...arguments_) as ScopedValue | undefined;
		if (freshValue === undefined) {
			await deleteItem(userKey);
			return undefined;
		}

		return writeItem(userKey, freshValue, this.#totalMaxAge);
	}
}
