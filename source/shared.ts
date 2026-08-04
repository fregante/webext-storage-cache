import toMilliseconds, {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {type JsonValue} from 'type-fest';

export type CacheValue = JsonValue | undefined;

export type CachedItem<Value> = {
	data: Value;
	maxAge: number;
};

export function timeInTheFuture(time: TimeDescriptor): number {
	return Date.now() + toMilliseconds(time);
}

export async function readItem<Value extends CacheValue>(userKey: string): Promise<CachedItem<Value> | undefined> {
	const internalKey = `cache:${userKey}`;
	const storageData: Record<string, CachedItem<Value>> = await chrome.storage.local.get(internalKey);
	const item = storageData[internalKey];
	return item !== undefined && Date.now() <= item.maxAge ? item : undefined;
}

export async function writeItem<Value extends CacheValue>(userKey: string, data: Value, maxAge: TimeDescriptor): Promise<Value> {
	const internalKey = `cache:${userKey}`;
	await chrome.storage.local.set({
		[internalKey]: {data, maxAge: timeInTheFuture(maxAge)},
	});
	return data;
}

export async function deleteItem(userKey: string): Promise<void> {
	await chrome.storage.local.remove(`cache:${userKey}`);
}

export async function has(userKey: string): Promise<boolean> {
	return (await readItem(userKey)) !== undefined;
}

/**
Deletes every cache entry, expired or not.
@param shouldDelete - Optional function to determine which items to delete. If not provided, all items will be deleted.
*/
export async function deleteWithLogic(shouldDelete?: (item: CachedItem<CacheValue>) => boolean): Promise<void> {
	const storageKeys: string[] = await chrome.storage.local.getKeys();
	const cacheKeys = storageKeys.filter(key => key.startsWith('cache:'));

	if (cacheKeys.length === 0) {
		return;
	}

	if (shouldDelete === undefined) {
		await chrome.storage.local.remove(cacheKeys);
		return;
	}

	const wholeCache: Record<string, CachedItem<CacheValue>> = await chrome.storage.local.get(cacheKeys);
	const removableKeys: string[] = [];
	for (const [key, item] of Object.entries(wholeCache)) {
		if ((shouldDelete(item))) {
			removableKeys.push(key);
		}
	}

	if (removableKeys.length > 0) {
		await chrome.storage.local.remove(removableKeys);
	}
}

/** Deletes every expired entry. Runs automatically in the background context; call manually elsewhere. */
export async function deleteExpired(): Promise<void> {
	await deleteWithLogic(item => Date.now() > item.maxAge);
}

const ALARM_NAME = 'webext-storage-cache';

export function init(): void {
	// eslint-disable-next-line @typescript-eslint/strict-boolean-expressions -- Wrong, env-dependent
	if (chrome.alarms) {
		void chrome.alarms.create(ALARM_NAME, {
			delayInMinutes: 1,
			periodInMinutes: 60 * 24,
		});

		let lastRun = 0; // Homemade debouncing due to `chrome.alarms` potentially queueing this function
		chrome.alarms.onAlarm.addListener(alarm => {
			if (!(alarm.name === ALARM_NAME && lastRun < Date.now() - 1000)) {
				return;
			}

			lastRun = Date.now();
			void deleteExpired();
		});
	} else {
		setTimeout(deleteExpired, 60_000); // Purge cache on launch, but wait a bit
		setInterval(deleteExpired, 1000 * 3600 * 24);
	}
}
