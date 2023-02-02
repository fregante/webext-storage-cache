import chromeP from 'webext-polyfill-kinda';
import {isBackgroundPage, isExtensionContext} from 'webext-detect-page';
import toMilliseconds, {type TimeDescriptor} from '@sindresorhus/to-milliseconds';

const cacheDefault = {days: 30};

function timeInTheFuture(time: TimeDescriptor): number {
	return Date.now() + toMilliseconds(time);
}

export function defaultSerializer(arguments_: unknown[]): string {
	if (arguments_.every(arg => typeof arg === 'string')) {
		return arguments_.join(',');
	}

	return JSON.stringify(arguments_);
}

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, any>;
// No circular references: Record<string, Value> https://github.com/Microsoft/TypeScript/issues/14174
// No index signature: {[key: string]: Value} https://github.com/microsoft/TypeScript/issues/15300#issuecomment-460226926

type CacheItem<Value> = {
	data: Value;
	maxAge: number;
};

type Cache<ScopedValue extends Value = Value> = Record<string, CacheItem<ScopedValue>>;

function getUserKey<Arguments extends unknown[]>(
	name: string,
	cacheKey: CacheKey<Arguments>,
	args: Arguments,
): string {
	return `${name}:${cacheKey(args)}`;
}

async function has(key: string): Promise<boolean> {
	return (await _get(key, false)) !== undefined;
}

async function _get<ScopedValue extends Value>(
	key: string,
	remove: boolean,
): Promise<CacheItem<ScopedValue> | undefined> {
	const internalKey = `cache:${key}`;
	const storageData = await chromeP.storage.local.get(internalKey) as Cache<ScopedValue>;
	const cachedItem = storageData[internalKey];

	if (cachedItem === undefined) {
		// `undefined` means not in cache
		return;
	}

	if (Date.now() > cachedItem.maxAge) {
		if (remove) {
			await chromeP.storage.local.remove(internalKey);
		}

		return;
	}

	return cachedItem;
}

async function get<ScopedValue extends Value>(
	key: string,
): Promise<ScopedValue | undefined> {
	const cacheItem = await _get<ScopedValue>(key, true);
	return cacheItem?.data;
}

async function set<ScopedValue extends Value>(
	key: string,
	value: ScopedValue,
	maxAge: TimeDescriptor = cacheDefault,
): Promise<ScopedValue> {
	if (arguments.length < 2) {
		throw new TypeError('Expected a value as the second argument');
	}

	if (typeof value === 'undefined') {
		await delete_(key);
	} else {
		const internalKey = `cache:${key}`;
		await chromeP.storage.local.set({
			[internalKey]: {
				data: value,
				maxAge: timeInTheFuture(maxAge),
			},
		});
	}

	return value;
}

async function delete_(key: string): Promise<void> {
	const internalKey = `cache:${key}`;
	return chromeP.storage.local.remove(internalKey);
}

async function deleteWithLogic(
	logic?: (x: CacheItem<Value>) => boolean,
): Promise<void> {
	const wholeCache = (await chromeP.storage.local.get()) as Record<string, any>;
	const removableItems: string[] = [];
	for (const [key, value] of Object.entries(wholeCache)) {
		if (key.startsWith('cache:') && (logic?.(value) ?? true)) {
			removableItems.push(key);
		}
	}

	if (removableItems.length > 0) {
		await chromeP.storage.local.remove(removableItems);
	}
}

async function deleteExpired(): Promise<void> {
	await deleteWithLogic(cachedItem => Date.now() > cachedItem.maxAge);
}

async function clear(): Promise<void> {
	await deleteWithLogic();
}

type CacheKey<Arguments> = (args: Arguments) => string;

type MemoizedFunctionOptions<Arguments extends unknown[], ScopedValue> = {
	name: string;
	maxAge?: TimeDescriptor;
	staleWhileRevalidate?: TimeDescriptor;
	cacheKey?: CacheKey<Arguments>;
	shouldRevalidate?: (cachedValue: ScopedValue) => boolean;
};

function function_<
	ScopedValue extends Value,
	Getter extends (...args: any[]) => Promise<ScopedValue | undefined>,
	Arguments extends Parameters<Getter>,
>(
	getter: Getter,
	{
		name,
		cacheKey = defaultSerializer,
		maxAge = {days: 30},
		staleWhileRevalidate = {days: 0},
		shouldRevalidate,
	}: MemoizedFunctionOptions<Arguments, ScopedValue>,
): Getter & {fresh: Getter} {
	const inFlightCache = new Map<string, Promise<ScopedValue | undefined>>();
	const getSet = async (
		key: string,
		args: Arguments,
	): Promise<ScopedValue | undefined> => {
		const freshValue = await getter(...args);
		if (freshValue === undefined) {
			await delete_(key);
			return;
		}

		const milliseconds = toMilliseconds(maxAge) + toMilliseconds(staleWhileRevalidate);

		return set<ScopedValue>(key, freshValue, {milliseconds});
	};

	const memoizeStorage = async (userKey: string, ...args: Arguments) => {
		const cachedItem = await _get<ScopedValue>(userKey, false);
		if (cachedItem === undefined || shouldRevalidate?.(cachedItem.data)) {
			return getSet(userKey, args);
		}

		// When the expiration is earlier than the number of days specified by `staleWhileRevalidate`, it means `maxAge` has already passed and therefore the cache is stale.
		if (timeInTheFuture(staleWhileRevalidate) > cachedItem.maxAge) {
			setTimeout(getSet, 0, userKey, args);
		}

		return cachedItem.data;
	};

	function memoizePending(...args: Arguments) {
		const userKey = getUserKey(name, cacheKey, args);
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

	return Object.assign(memoizePending as Getter, {
		fresh: (
			async (...args: Arguments) => getSet(getUserKey(name, cacheKey, args), args)
		) as Getter,
	});
}

const cache = {
	has,
	get,
	set,
	clear,
	function: function_,
	delete: delete_,
};

function init(): void {
	// Make it available globally for ease of use
	if (isExtensionContext()) {
		(globalThis as any).webextStorageCache = cache;
	}

	// Automatically clear cache every day
	if (!isBackgroundPage()) {
		return;
	}

	if (chrome.alarms) {
		chrome.alarms.create('webext-storage-cache', {
			delayInMinutes: 1,
			periodInMinutes: 60 * 24,
		});

		let lastRun = 0; // Homemade debouncing due to `chrome.alarms` potentially queueing this function
		chrome.alarms.onAlarm.addListener(alarm => {
			if (
				alarm.name === 'webext-storage-cache'
				&& lastRun < Date.now() - 1000
			) {
				lastRun = Date.now();
				void deleteExpired();
			}
		});
	} else {
		setTimeout(deleteExpired, 60_000); // Purge cache on launch, but wait a bit
		setInterval(deleteExpired, 1000 * 3600 * 24);
	}
}

init();

export default cache;
