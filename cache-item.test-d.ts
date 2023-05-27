/* eslint-disable no-new  */
import {expectType, expectNotAssignable, expectNotType} from 'tsd';
import {CacheItem, UpdatableCacheItem} from './cache-item.js';

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, any>;

const item = new CacheItem<string>('key');

expectType<Promise<boolean>>(item.isCached());
expectType<Promise<void>>(item.delete());

expectType<Promise<Value | undefined>>(item.get());
expectType<Promise<string | undefined>>(item.get());
expectNotAssignable<Promise<number | undefined>>(item.get());
expectNotType<Promise<string>>(item.set('string'));

// @ts-expect-error Type is string
await item.set(1);

// @ts-expect-error Type is string
await item.set(true);

// @ts-expect-error Type is string
await item.set([true, 'string']);

// @ts-expect-error Type is string
await item.set({wow: [true, 'string']});

// @ts-expect-error Type is string
await item.set(1, {days: 1});

const itemWithUpdater = new UpdatableCacheItem('key', {
	updater: async (one: number): Promise<string> => String(one).toUpperCase(),
});

expectType<((n: number) => Promise<string>)>(itemWithUpdater.get);
expectNotAssignable<((n: number) => Promise<string>)>(itemWithUpdater.get);

async function identity(x: string): Promise<string>;
async function identity(x: number): Promise<number>;
async function identity(x: number | string): Promise<number | string> {
	return x;
}

expectType<Promise<number>>(new UpdatableCacheItem('identity', {updater: identity}).get(1));
expectType<Promise<string>>(new UpdatableCacheItem('identity', {updater: identity}).get('1'));

// @ts-expect-error -- If a function returns undefined, it's not cacheable
new UpdatableCacheItem('identity', {updater: async (n: undefined[]) => n[1]});

// TODO: These expectation assertions are not working…
expectNotAssignable<Promise<symbol>>(new UpdatableCacheItem('identity', {updater: identity}).get(1));
expectNotType<Promise<symbol>>(new UpdatableCacheItem('identity', {updater: identity}).get('1'));

new UpdatableCacheItem('number', {
	updater: async (n: string) => Number(n),
	maxAge: {days: 20},
});

new UpdatableCacheItem('number', {
	updater: async (n: string) => Number(n),
	maxAge: {days: 20},
	staleWhileRevalidate: {days: 5},
});

new UpdatableCacheItem('number', {
	updater: async (date: Date) => String(date.getHours()),
	cacheKey: ([date]) => date.toLocaleString(),
});

new UpdatableCacheItem('number', {
	updater: async (date: Date) => String(date.getHours()),
	shouldRevalidate: date => typeof date === 'string',
});
