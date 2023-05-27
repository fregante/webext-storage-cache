/* eslint-disable no-new  */
import {expectType, expectNotAssignable, expectNotType} from 'tsd';
import UpdatableCacheItem from './updatable-cache-item.js';

const itemWithUpdater = new UpdatableCacheItem('key', {
	updater: async (one: number): Promise<string> => String(one).toUpperCase(),
});

expectType<((n: number) => Promise<string>)>(itemWithUpdater.get);
expectNotAssignable<((n: string) => Promise<string>)>(itemWithUpdater.get);

async function identity(x: string): Promise<string>;
async function identity(x: number): Promise<number>;
async function identity(x: number | string): Promise<number | string> {
	return x;
}

expectType<Promise<number>>(new UpdatableCacheItem('identity', {updater: identity}).get(1));
expectType<Promise<string>>(new UpdatableCacheItem('identity', {updater: identity}).get('1'));

// @ts-expect-error -- If a function returns undefined, it's not cacheable
new UpdatableCacheItem('identity', {updater: async (n: undefined[]) => n[1]});

expectNotAssignable<Promise<string>>(new UpdatableCacheItem('identity', {updater: identity}).get(1));
expectNotType<Promise<number>>(new UpdatableCacheItem('identity', {updater: identity}).get('1'));

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
