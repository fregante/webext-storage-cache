import {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {
	type CacheValue,
	readItem,
	writeItem,
	deleteItem,
} from './shared.js';

export {type CacheValue} from './shared.js';

export default class CachedValue<ScopedValue extends CacheValue> {
	readonly maxAge: TimeDescriptor;

	constructor(
		public readonly name: string,
		options: {
			maxAge?: TimeDescriptor;
		} = {},
	) {
		this.maxAge = options.maxAge ?? {days: 30};
	}

	async get(): Promise<ScopedValue | undefined> {
		const item = await readItem<ScopedValue>(this.name);
		return item?.data;
	}

	async set<Value extends ScopedValue>(value: Value): Promise<Value> {
		if (arguments.length === 0) {
			throw new TypeError('Expected a value to be stored');
		}

		return writeItem(this.name, value, this.maxAge);
	}

	async delete(): Promise<void> {
		await deleteItem(this.name);
	}

	async isCached(): Promise<boolean> {
		return (await readItem<ScopedValue>(this.name)) !== undefined;
	}
}
