/* eslint-disable no-new -- testing */
import {expectType, expectNotAssignable, expectNotType} from 'tsd';
import CachedFunction from './cached-function.js';

const itemWithUpdater = new CachedFunction('key', {
	updater: async (one: number): Promise<string> => String(one).toUpperCase(),
});

expectType<((n: number) => Promise<string>)>(itemWithUpdater.get);
expectNotAssignable<((n: string) => Promise<string>)>(itemWithUpdater.get);

async function identity(x: string): Promise<string>;
async function identity(x: number): Promise<number>;
async function identity(x: number | string): Promise<number | string> {
	return x;
}

expectType<Promise<number>>(new CachedFunction('identity', {updater: identity}).get(1));
expectType<Promise<string>>(new CachedFunction('identity', {updater: identity}).get('1'));

new CachedFunction('identity', {updater: async (n: undefined[]) => n[1]});

expectNotAssignable<Promise<string>>(new CachedFunction('identity', {updater: identity}).get(1));
expectNotType<Promise<number>>(new CachedFunction('identity', {updater: identity}).get('1'));

new CachedFunction('number', {
	updater: async (n: string) => Number(n),
	maxAge: {days: 20},
});

new CachedFunction('number', {
	updater: async (n: string) => Number(n),
	maxAge: {days: 20},
	staleWhileRevalidate: {days: 5},
});

new CachedFunction('number', {
	updater: async (date: Date) => String(date.getHours()),
	cacheKey: ([date]) => date.toLocaleString(),
});

new CachedFunction('number', {
	updater: async (date: Date) => String(date.getHours()),
	shouldRevalidate: date => typeof date === 'string',
});

// .getCached() resolves to the value or undefined, never the args
const stringItem = new CachedFunction('str', {updater: async (n: number) => String(n)});
expectType<Promise<string | undefined>>(stringItem.getCached(1));
expectNotAssignable<Promise<string>>(stringItem.getCached(1));

// .getFresh() always resolves to the scoped value, bypassing the cache
expectType<Promise<string>>(stringItem.getFresh(1));

// .delete() resolves to void regardless of updater return type
expectType<Promise<void>>(stringItem.delete(1));

// .isCached() always resolves to a boolean
expectType<Promise<boolean>>(stringItem.isCached(1));

// .setCached() takes the new value and then the arguments
expectType<Promise<string>>(stringItem.setCached('override', 1));

// @ts-expect-error value must match ScopedValue
void stringItem.setCached(123, 1);

// Caches `undefined`
const undefinedItem = new CachedFunction('undefined', {
	updater: async () => undefined,
});

expectType<Promise<undefined>>(undefinedItem.get());
expectType<Promise<undefined>>(undefinedItem.getFresh());
expectType<Promise<undefined>>(undefinedItem.getCached());
expectType<Promise<boolean>>(undefinedItem.isCached());
