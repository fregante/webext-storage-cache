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
type Value = Primitive | Primitive[] | Record<string, unknown>;
// No circular references: Record<string, Value> https://github.com/Microsoft/TypeScript/issues/14174
// No index signature: {[key: string]: Value} https://github.com/microsoft/TypeScript/issues/15300#issuecomment-460226926

const defaultCacheKey = (args: string[]): string => args[0];
const defaultExpiration = 30; /* Days */

interface CacheItem<TValue> {
	data: TValue;
	expiration: number;
}

type Cache<TValue extends Value = Value> = Record<string, CacheItem<TValue>>;

const _get = chrome.storage.local.get.bind(chrome.storage.local);
const _set = chrome.storage.local.set.bind(chrome.storage.local);
const _remove = chrome.storage.local.remove.bind(chrome.storage.local);

async function has(key: string): Promise<boolean> {
	const cachedKey = `cache:${key}`;
	const values = await p<Cache>(_get, cachedKey);
	return values[cachedKey] !== undefined;
}

async function get<TValue extends Value>(key: string): Promise<TValue | undefined> {
	const cachedKey = `cache:${key}`;
	const values = await p<Cache<TValue>>(_get, cachedKey);
	const value = values[cachedKey];
	// If it's not in the cache, it's best to return "undefined"
	if (value === undefined) {
		return undefined;
	}

	if (Date.now() > value.expiration) {
		await p(_remove, cachedKey);
		return undefined;
	}

	return value.data;
}

async function set<TValue extends Value>(key: string, value: TValue, expiration: number = defaultExpiration /* days */): Promise<void> {
	const cachedKey = `cache:${key}`;
	return p(_set, {
		[cachedKey]: {
			data: value,
			expiration: Date.now() + (1000 * 3600 * 24 * expiration)
		}
	});
}

async function delete_(key: string): Promise<void> {
	const cachedKey = `cache:${key}`;
	return p(_remove, cachedKey);
}

async function purge(): Promise<void> {
	const values = await p<Cache>(_get);
	const removableItems = [];
	for (const [key, value] of Object.entries(values)) {
		if (key.startsWith('cache:') && Date.now() > value.expiration) {
			removableItems.push(key);
		}
	}

	if (removableItems.length > 0) {
		await p(_remove, removableItems);
	}
}

// Automatically clear cache every day
if (isBackgroundPage()) {
	setTimeout(purge, 60000); // Purge cache on launch, but wait a bit
	setInterval(purge, 1000 * 3600 * 24);
}

interface MemoizedFunctionOptions<TFunction extends (...args: any[]) => any> {
	expiration?: number;
	cacheKey?: (args: Parameters<TFunction>) => string;
}

type PromisedFunction<T extends (...args: any[]) => any> =
	(...args: Parameters<T>) => Promise<ReturnType<T>>;

function function_<TFunction extends(...args: any[]) => any>(
	function_: TFunction,
	{
		cacheKey = defaultCacheKey,
		expiration = defaultExpiration
	}: MemoizedFunctionOptions<TFunction> = {}
): PromisedFunction<TFunction> {
	return async (...args) => {
		const key = cacheKey(args);
		const cachedValue = await get(key);
		if (cachedValue) {
			return cachedValue;
		}

		const freshValue = await function_(...args);
		await set(cacheKey(args), freshValue, expiration);
		return freshValue;
	};
}

export default {
	has,
	get,
	set,
	function: function_,
	delete: delete_
};
