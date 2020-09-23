import {isBackgroundPage} from 'webext-detect-page';
import toMilliseconds, {TimeDescriptor} from '@sindresorhus/to-milliseconds';

// @ts-ignore
// eslint-disable-next-line @typescript-eslint/promise-function-async
const getPromise = (executor: () => void) => <T>(key?): Promise<T> => new Promise((resolve, reject) => {
	// @ts-ignore
	executor(key, result => {
		if (chrome.runtime.lastError) {
			reject(chrome.runtime.lastError);
		} else {
			resolve(result);
		}
	});
});

function timeInTheFuture(time: TimeDescriptor): number {
	return Date.now() + toMilliseconds(time);
}

// @ts-ignore
const storageGet = getPromise((...args) => chrome.storage.local.get(...args));
// @ts-ignore
const storageSet = getPromise((...args) => chrome.storage.local.set(...args));
// @ts-ignore
const storageRemove = getPromise((...args) => chrome.storage.local.remove(...args));

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, any>;
// No circular references: Record<string, Value> https://github.com/Microsoft/TypeScript/issues/14174
// No index signature: {[key: string]: Value} https://github.com/microsoft/TypeScript/issues/15300#issuecomment-460226926

interface CacheItem<TValue> {
	data: TValue;
	maxAge: number;
}

type Cache<TValue extends Value = Value> = Record<string, CacheItem<TValue>>;

async function has(key: string): Promise<boolean> {
	return await _get(key, false) !== undefined;
}

async function _get<TValue extends Value>(key: string, remove: boolean): Promise<CacheItem<TValue> | undefined> {
	const internalKey = `cache:${key}`;
	const storageData = await storageGet<Cache<TValue>>(internalKey);
	const cachedItem = storageData[internalKey];

	if (cachedItem === undefined) {
		// `undefined` means not in cache
		return;
	}

	if (Date.now() > cachedItem.maxAge) {
		if (remove) {
			await storageRemove(internalKey);
		}

		return;
	}

	return cachedItem;
}

async function get<TValue extends Value>(key: string): Promise<TValue | undefined> {
	return (await _get<TValue>(key, true))?.data;
}

async function set<TValue extends Value>(key: string, value: TValue, maxAge: TimeDescriptor = {days: 30}): Promise<TValue> {
	if (typeof value === 'undefined') {
		await delete_(key);
		return value;
	}

	const internalKey = `cache:${key}`;
	await storageSet({
		[internalKey]: {
			data: value,
			maxAge: timeInTheFuture(maxAge)
		}
	});

	return value;
}

async function delete_(key: string): Promise<void> {
	const internalKey = `cache:${key}`;
	return storageRemove(internalKey);
}

async function deleteWithLogic(logic?: (x: CacheItem<Value>) => boolean): Promise<void> {
	const wholeCache = await storageGet<Record<string, any>>();
	const removableItems = [];
	for (const [key, value] of Object.entries(wholeCache)) {
		if (key.startsWith('cache:') && (logic?.(value) ?? true)) {
			removableItems.push(key);
		}
	}

	if (removableItems.length > 0) {
		await storageRemove(removableItems);
	}
}

async function deleteExpired(): Promise<void> {
	await deleteWithLogic(cachedItem => Date.now() > cachedItem.maxAge);
}

async function clear(): Promise<void> {
	await deleteWithLogic();
}

interface MemoizedFunctionOptions<TArgs extends any[], TValue> {
	maxAge?: TimeDescriptor;
	staleWhileRevalidate?: TimeDescriptor;
	cacheKey?: (args: TArgs) => string;
	shouldRevalidate?: (cachedValue: TValue) => boolean;
}

function function_<
	TValue extends Value,
	TFunction extends (...args: any[]) => Promise<TValue | undefined>,
	TArgs extends Parameters<TFunction>
>(
	getter: TFunction,
	{cacheKey, maxAge = {days: 30}, staleWhileRevalidate = {days: 0}, shouldRevalidate}: MemoizedFunctionOptions<TArgs, TValue> = {}
): TFunction {
	const getSet = async (key: string, args: TArgs): Promise<TValue | undefined> => {
		const freshValue = await getter(...args);
		if (freshValue === undefined) {
			await delete_(key);
			return;
		}

		const milliseconds = toMilliseconds(maxAge) + toMilliseconds(staleWhileRevalidate);

		return set<TValue>(key, freshValue, {milliseconds});
	};

	return (async (...args: TArgs) => {
		const userKey = cacheKey ? cacheKey(args) : args[0] as string;
		const cachedItem = await _get<TValue>(userKey, false);
		if (cachedItem === undefined || shouldRevalidate?.(cachedItem.data)) {
			return getSet(userKey, args);
		}

		// When the expiration is earlier than the number of days specified by `staleWhileRevalidate`, it means `maxAge` has already passed and therefore the cache is stale.
		if (timeInTheFuture(staleWhileRevalidate) > cachedItem.maxAge) {
			setTimeout(getSet, 0, userKey, args);
		}

		return cachedItem.data;
	}) as TFunction;
}

const cache = {
	has,
	get,
	set,
	clear,
	function: function_,
	delete: delete_
};

function init(): void {
	// Make it available globally for ease of use
	(window as any).webextStorageCache = cache;

	// Automatically clear cache every day
	if (!isBackgroundPage()) {
		return;
	}

	if (chrome.alarms) {
		chrome.alarms.create('webext-storage-cache', {
			delayInMinutes: 1,
			periodInMinutes: 60 * 24
		});

		let lastRun = 0; // Homemade debouncing due to `chrome.alarms` potentially queueing this function
		chrome.alarms.onAlarm.addListener(alarm => {
			if (alarm.name === 'webext-storage-cache' && lastRun < Date.now() - 1000) {
				lastRun = Date.now();
				deleteExpired();
			}
		});
	} else {
		setTimeout(deleteExpired, 60000); // Purge cache on launch, but wait a bit
		setInterval(deleteExpired, 1000 * 3600 * 24);
	}
}

init();

export default cache;
