import {isBackgroundPage} from 'webext-detect-page';

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

function millisecondsFromNow(milliseconds: number): number {
	return Date.now() + milliseconds;
}

function days(days: number): number {
	return days * 24 * 3600;
}

function hours(hours: number): number {
	return hours * 3600;
}

// @ts-ignore
const _get = getPromise((...args) => chrome.storage.local.get(...args));
// @ts-ignore
const _set = getPromise((...args) => chrome.storage.local.set(...args));
// @ts-ignore
const _remove = getPromise((...args) => chrome.storage.local.remove(...args));

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
	const internalKey = `cache:${key}`;
	return internalKey in await _get<Cache>(internalKey);
}

async function get<TValue extends Value>(key: string): Promise<TValue | undefined> {
	const internalKey = `cache:${key}`;
	const storageData = await _get<Cache<TValue>>(internalKey);
	const cachedItem = storageData[internalKey];

	if (cachedItem === undefined) {
		// `undefined` means not in cache
		return;
	}

	if (Date.now() > cachedItem.maxAge) {
		await _remove(internalKey);
		return;
	}

	return cachedItem.data;
}

async function set<TValue extends Value>(key: string, value: TValue, maxAge = days(30)): Promise<TValue> {
	if (typeof value === 'undefined') {
		// @ts-ignore This never happens in TS because `value` can't be undefined
		return;
	}

	const internalKey = `cache:${key}`;
	await _set({
		[internalKey]: {
			data: value,
			maxAge: millisecondsFromNow(maxAge)
		}
	});

	return value;
}

async function delete_(key: string): Promise<void> {
	const internalKey = `cache:${key}`;
	return _remove(internalKey);
}

async function deleteWithLogic(logic?: (x: CacheItem<Value>) => boolean): Promise<void> {
	const wholeCache = await _get<Record<string, any>>();
	const removableItems = [];
	for (const [key, value] of Object.entries(wholeCache)) {
		if (key.startsWith('cache:') && (logic?.(value) ?? true)) {
			removableItems.push(key);
		}
	}

	if (removableItems.length > 0) {
		await _remove(removableItems);
	}
}

async function deleteExpired(): Promise<void> {
	await deleteWithLogic(cachedItem => Date.now() > cachedItem.maxAge);
}

async function clear(): Promise<void> {
	await deleteWithLogic();
}

interface MemoizedFunctionOptions<TArgs extends any[], TValue> {
	maxAge?: number;
	staleWhileRevalidate?: number;
	cacheKey?: (args: TArgs) => string;
	shouldRevalidate?: (cachedValue: TValue) => boolean;
}

function function_<
	TValue extends Value,
	TFunction extends (...args: any[]) => Promise<TValue | undefined>,
	TArgs extends Parameters<TFunction>
>(
	getter: TFunction,
	{cacheKey, maxAge = days(30), staleWhileRevalidate = 0, shouldRevalidate}: MemoizedFunctionOptions<TArgs, TValue> = {}
): TFunction {
	const getSet = async (key: string, args: TArgs): Promise<TValue | undefined> => {
		const freshValue = await getter(...args);
		if (freshValue === undefined) {
			await delete_(key);
			return;
		}

		return set<TValue>(key, freshValue, maxAge + staleWhileRevalidate);
	};

	return (async (...args: TArgs) => {
		const userKey = cacheKey ? cacheKey(args) : args[0] as string;
		const internalKey = `cache:${userKey}`;
		const storageData = await _get<Cache<TValue>>(internalKey);
		const cachedItem = storageData[internalKey];
		if (cachedItem === undefined || shouldRevalidate?.(cachedItem.data)) {
			return getSet(userKey, args);
		}

		// When the expiration is earlier than the number of days specified by `staleWhileRevalidate`, it means `maxAge` has already passed and therefore the cache is stale.
		if (millisecondsFromNow(staleWhileRevalidate) > cachedItem.maxAge) {
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
	delete: delete_,
	days,
	hours
};

function init(): void {
	// Automatically clear cache every day
	if (isBackgroundPage()) {
		setTimeout(deleteExpired, 60000); // Purge cache on launch, but wait a bit
		setInterval(deleteExpired, 1000 * 3600 * 24);
	}

	(window as any).webextStorageCache = cache;
}

init();

export default cache;
