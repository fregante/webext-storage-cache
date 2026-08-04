/* eslint-disable no-new  */
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

// .applyOverride() takes the args tuple and a matching value, resolves to that value
expectType<Promise<string>>(stringItem.applyOverride([1], 'override'));

// @ts-expect-error value must match ScopedValue
void stringItem.applyOverride([1], 123);
