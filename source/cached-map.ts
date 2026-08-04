import {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {
	type CacheValue,
	readItem,
	writeItem,
	deleteItem,
} from './shared.js';

export default class CachedMap<ScopedValue extends CacheValue> {
	readonly name: string;
	readonly maxAge: TimeDescriptor;

	constructor(
		name: string,
		options: {
			maxAge?: TimeDescriptor;
		} = {},
	) {
		this.name = name;
		this.maxAge = options.maxAge ?? {days: 30};
	}

	protected getStorageKey(key: string): string {
		return `${this.name}:${key}`;
	}

	async get(key: string): Promise<ScopedValue | undefined> {
		const item = await readItem<ScopedValue>(this.getStorageKey(key));
		return item?.data;
	}

	async set(key: string, value: ScopedValue): Promise<ScopedValue> {
		if (arguments.length < 2) {
			throw new TypeError('Expected a value to be stored');
		}

		return writeItem(this.getStorageKey(key), value, this.maxAge);
	}

	async delete(key: string): Promise<void> {
		await deleteItem(this.getStorageKey(key));
	}

	async has(key: string): Promise<boolean> {
		return (await readItem<ScopedValue>(this.getStorageKey(key))) !== undefined;
	}
}
