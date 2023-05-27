import {type JsonValue} from 'type-fest';
import {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import cache from './legacy.js';

// eslint-disable-next-line @typescript-eslint/ban-types -- It is a JSON value
export type CacheValue = Exclude<JsonValue, null>;

export default class CacheItem<ScopedValue extends CacheValue> {
	readonly maxAge: TimeDescriptor;
	constructor(
		public name: string,
		options: {
			maxAge?: TimeDescriptor;
		} = {},
	) {
		this.maxAge = options.maxAge ?? {days: 30};
	}

	async get(): Promise<ScopedValue | undefined> {
		return cache.get<ScopedValue>(this.name);
	}

	async set(value: ScopedValue): Promise<ScopedValue> {
		if (arguments.length === 0) {
			throw new TypeError('Expected a value to be stored');
		}

		return cache.set(this.name, value, this.maxAge);
	}

	async delete(): Promise<void> {
		return cache.delete(this.name);
	}

	async isCached() {
		return (await this.get()) !== undefined;
	}
}
