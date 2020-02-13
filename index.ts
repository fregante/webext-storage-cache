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
	expiration: number;
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

	if (Date.now() > cachedItem.expiration) {
		await _remove(internalKey);
		return;
	}

	return cachedItem.data;
}

async function set<TValue extends Value>(key: string, value: TValue, expiration = 30 /* days */): Promise<TValue> {
	if (typeof value === 'undefined') {
		// @ts-ignore This never happens in TS because `value` can't be undefined
		return;
	}

	const internalKey = `cache:${key}`;
	await _set({
		[internalKey]: {
			data: value,
			expiration: Date.now() + (1000 * 3600 * 24 * expiration)
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
	await deleteWithLogic(cachedItem => Date.now() > cachedItem.expiration);
}

async function clear(): Promise<void> {
	await deleteWithLogic();
}

interface MemoizedFunctionOptions<TArgs extends any[], TValue> {
	expiration?: number;
	cacheKey?: (args: TArgs) => string;
	isExpired?: (cachedValue: TValue) => boolean;
}

function function_<
	TValue extends Value,
	TFunction extends (...args: any[]) => Promise<TValue | undefined>,
	TArgs extends Parameters<TFunction>
>(
	getter: TFunction,
	{cacheKey, expiration, isExpired}: MemoizedFunctionOptions<TArgs, TValue> = {}
): TFunction {
	const getSet = async (key: string, args: TArgs): Promise<TValue | undefined> => {
		const freshValue = await getter(...args);
		if (freshValue === undefined) {
			await delete_(key);
			return;
		}

		return set<TValue>(key, freshValue, expiration);
	};

	return (async (...args: TArgs) => {
		const userKey = cacheKey ? cacheKey(args) : args[0] as string;
		const internalKey = `cache:${userKey}`;
		const storageData = await _get<Cache<TValue>>(internalKey);
		const cachedItem = storageData[internalKey];
		if (cachedItem === undefined || isExpired?.(cachedItem.data)) {
			return getSet(userKey, args);
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
	// Automatically clear cache every day
	if (isBackgroundPage()) {
		setTimeout(deleteExpired, 60000); // Purge cache on launch, but wait a bit
		setInterval(deleteExpired, 1000 * 3600 * 24);
	}

	(window as any).webextStorageCache = cache;
}

init();

export default cache;
