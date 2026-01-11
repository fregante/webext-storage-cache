import {type AsyncReturnType} from 'type-fest';
import {type TimeDescriptor} from '@sindresorhus/to-milliseconds';
import {type CacheValue} from './cached-value.js';
import CachedFunction from './cached-function.js';

export default class CachedMap<ScopedValue extends CacheValue> {
	readonly maxAge: TimeDescriptor;
	readonly #cachedFunction: CachedFunction<
	(key: string) => Promise<ScopedValue>,
	AsyncReturnType<(key: string) => Promise<ScopedValue>>,
	[string]
	>;

	constructor(
		public name: string,
		options: {
			maxAge?: TimeDescriptor;
		} = {},
	) {
		this.maxAge = options.maxAge ?? {days: 30};

		// Create a CachedFunction with a dummy updater that throws
		// This is intentional - CachedMap is for manual caching only
		this.#cachedFunction = new CachedFunction(name, {
			async updater(_key: string): Promise<ScopedValue> {
				throw new Error('CachedMap does not support automatic updates. Use .set() to cache values.');
			},
			maxAge: this.maxAge,
		});
	}

	async get(key: string): Promise<ScopedValue | undefined> {
		return this.#cachedFunction.getCached(key);
	}

	async set(key: string, value: ScopedValue): Promise<ScopedValue> {
		if (arguments.length < 2) {
			throw new TypeError('Expected a value to be stored');
		}

		// The type assertion is necessary because CachedFunction's ScopedValue type parameter
		// is AsyncReturnType<Updater> which TypeScript treats as Awaited<ScopedValue>.
		// Since our ScopedValue extends CacheValue (not Promise<CacheValue>), the cast is safe.
		return this.#cachedFunction.applyOverride([key], value as AsyncReturnType<(key: string) => Promise<ScopedValue>>);
	}

	async delete(key: string): Promise<void> {
		return this.#cachedFunction.delete(key);
	}

	async has(key: string): Promise<boolean> {
		return (await this.#cachedFunction.getCached(key)) !== undefined;
	}
}
