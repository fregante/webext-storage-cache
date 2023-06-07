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

// @ts-expect-error -- If a function returns undefined, it's not cacheable
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
