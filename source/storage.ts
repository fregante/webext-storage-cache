import toMilliseconds, {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {type JsonValue} from 'type-fest';

// eslint-disable-next-line @typescript-eslint/ban-types -- It is a JSON value
export type CacheValue = Exclude<JsonValue, null>;

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
