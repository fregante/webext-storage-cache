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

export type MemoizedFunction<
	Updater extends (...arguments_: any[]) => Promise<CacheValue>,
	ScopedValue extends CacheValue = Awaited<ReturnType<Updater>>,
	Arguments extends Parameters<Updater> = Parameters<Updater>,
> = Updater & {
	getFresh: (...arguments_: Arguments) => Promise<ScopedValue>;
	getCached: (...arguments_: Arguments) => Promise<ScopedValue | undefined>;
	isCached: (...arguments_: Arguments) => Promise<boolean>;
	delete: (...arguments_: Arguments) => Promise<void>;
	setCached: (value: ScopedValue, ...arguments_: Arguments) => Promise<ScopedValue>;
};

export default function memoize<
	Updater extends (...arguments_: any[]) => Promise<CacheValue>,
	ScopedValue extends CacheValue = Awaited<ReturnType<Updater>>,
	Arguments extends Parameters<Updater> = Parameters<Updater>,
>(
	updater: Updater,
	options: {
		key: string;
		maxAge?: TimeDescriptor;
		staleWhileRevalidate?: TimeDescriptor;
		cacheKey?: CacheKey<Arguments>;
		shouldRevalidate?: (cachedValue: ScopedValue) => boolean;
	},
): MemoizedFunction<Updater, ScopedValue, Arguments> {
	const name = options.key;
	const customCacheKey = options.cacheKey;
	const {shouldRevalidate} = options;
	const maxAge = options.maxAge ?? {days: 30};
	const staleWhileRevalidate = options.staleWhileRevalidate ?? {days: 0};
	const totalMaxAge = {milliseconds: toMilliseconds(maxAge) + toMilliseconds(staleWhileRevalidate)};

	const inFlight = new Map<string, Promise<ScopedValue>>();

	async function updateOnce(userKey: string, arguments_: Arguments): Promise<ScopedValue> {
		let promise = inFlight.get(userKey);
		if (!promise) {
			promise = update(userKey, arguments_);
			inFlight.set(userKey, promise);
			const clear = () => {
				inFlight.delete(userKey);
			};

			promise.then(clear, clear);
		}

		return promise;
	}

	async function update(userKey: string, arguments_: Arguments): Promise<ScopedValue> {
		const freshValue = await updater(...arguments_) as ScopedValue;
		return writeItem(userKey, freshValue, totalMaxAge);
	}

	const memoized = (async (...arguments_: Arguments) => {
		const userKey = getUserKey(name, customCacheKey, arguments_);
		const cached = await readItem<ScopedValue>(userKey);

		if (!cached || shouldRevalidate?.(cached.data)) {
			return updateOnce(userKey, arguments_);
		}

		if (timeInTheFuture(staleWhileRevalidate) > cached.maxAge) {
			setTimeout(() => {
				updateOnce(userKey, arguments_).catch(() => undefined);
			}, 0);
		}

		return cached.data;
	}) as unknown as MemoizedFunction<Updater, ScopedValue, Arguments>;

	return Object.assign(memoized, {
		async getFresh(...arguments_: Arguments): Promise<ScopedValue> {
			const userKey = getUserKey(name, customCacheKey, arguments_);
			const freshValue = await updater(...arguments_) as ScopedValue;
			return writeItem(userKey, freshValue, totalMaxAge);
		},
		async getCached(...arguments_: Arguments): Promise<ScopedValue | undefined> {
			const userKey = getUserKey(name, customCacheKey, arguments_);
			const cached = await readItem<ScopedValue>(userKey);
			return cached?.data;
		},
		async isCached(...arguments_: Arguments): Promise<boolean> {
			const userKey = getUserKey(name, customCacheKey, arguments_);
			return (await readItem<ScopedValue>(userKey)) !== undefined;
		},
		async delete(...arguments_: Arguments): Promise<void> {
			const userKey = getUserKey(name, customCacheKey, arguments_);
			await deleteItem(userKey);
		},
		async setCached(value: ScopedValue, ...arguments_: Arguments): Promise<ScopedValue> {
			const userKey = getUserKey(name, customCacheKey, arguments_);
			return writeItem(userKey, value, totalMaxAge);
		},
	});
}
