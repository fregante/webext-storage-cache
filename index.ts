import {isBackgroundPage} from 'webext-detect-page';

// @ts-ignore
async function p<T>(fn, ...args): Promise<T> {
	return new Promise((resolve, reject) => {
		// @ts-ignore
		fn(...args, result => {
			if (chrome.runtime.lastError) {
				reject(chrome.runtime.lastError);
			} else {
				resolve(result);
			}
		});
	});
}

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, any>;
// No circular references: Record<string, Value> https://github.com/Microsoft/TypeScript/issues/14174
// No index signature: {[key: string]: Value} https://github.com/microsoft/TypeScript/issues/15300#issuecomment-460226926

interface CacheItem<TValue> {
	data: TValue;
	expiration: number;
}

type Cache<TValue extends Value = Value> = Record<string, CacheItem<TValue>>;

const _get = chrome.storage.local.get.bind(chrome.storage.local);
const _set = chrome.storage.local.set.bind(chrome.storage.local);
const _remove = chrome.storage.local.remove.bind(chrome.storage.local);

async function has(key: string): Promise<boolean> {
	const internalKey = `cache:${key}`;
	return internalKey in await p<Cache>(_get, internalKey);
}

async function get<TValue extends Value>(key: string): Promise<TValue | undefined> {
	const internalKey = `cache:${key}`;
	const storageData = await p<Cache<TValue>>(_get, internalKey);
	const cachedItem = storageData[internalKey];

	if (cachedItem === undefined) {
		// `undefined` means not in cache
		return;
	}

	if (Date.now() > cachedItem.expiration) {
		await p(_remove, internalKey);
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
	await p(_set, {
		[internalKey]: {
			data: value,
			expiration: Date.now() + (1000 * 3600 * 24 * expiration)
		}
	});

	return value;
}

async function delete_(key: string): Promise<void> {
	const internalKey = `cache:${key}`;
	return p(_remove, internalKey);
}

async function deleteWithLogic(logic?: (x: CacheItem<Value>) => boolean): Promise<void> {
	const wholeCache = await p<Cache>(_get);
	const removableItems = [];
	for (const [key, value] of Object.entries(wholeCache)) {
		if (key.startsWith('cache:') && (logic?.(value) ?? true)) {
			removableItems.push(key);
		}
	}

	if (removableItems.length > 0) {
		await p(_remove, removableItems);
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
		const storageData = await p<Cache<TValue>>(_get, internalKey);
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
