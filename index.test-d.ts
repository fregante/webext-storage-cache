import {expectType, expectNotAssignable, expectAssignable} from 'tsd';
import cache from './index.js';

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, any>;

expectType<Promise<boolean>>(cache.has('key'));
expectType<Promise<void>>(cache.delete('key'));

expectType<Promise<Value | undefined>>(cache.get('key'));
expectType<Promise<string | undefined>>(cache.get<string>('key'));
expectNotAssignable<Promise<number | undefined>>(cache.get<string>('key'));

expectAssignable<Promise<number>>(cache.set('key', 1));
expectAssignable<Promise<boolean>>(cache.set('key', true));
expectAssignable<Promise<[boolean, string]>>(cache.set('key', [true, 'string']));
expectAssignable<Promise<Record<string, any[]>>>(cache.set('key', {wow: [true, 'string']}));
expectAssignable<Promise<number>>(cache.set('key', 1, {days: 1}));

const cachedPower = cache.function('power', async (n: number) => n ** 1000);
expectType<((n: number) => Promise<number>) & {fresh: (n: number) => Promise<number>}>(cachedPower);
expectType<number>(await cachedPower(1));

expectType<((n: string) => Promise<number>) & {fresh: (n: string) => Promise<number>}>(
	cache.function('number', async (n: string) => Number(n)),
);

async function identity(x: string): Promise<string>;
async function identity(x: number): Promise<number>;
async function identity(x: number | string): Promise<number | string> {
	return x;
}

expectType<Promise<number>>(cache.function('identity', identity)(1));
expectType<Promise<string>>(cache.function('identity', identity)('1'));
expectNotAssignable<Promise<string>>(cache.function('identity', identity)(1));
expectNotAssignable<Promise<number>>(cache.function('identity', identity)('1'));

expectType<((n: string) => Promise<number>) & {fresh: (n: string) => Promise<number>}>(
	cache.function('number', async (n: string) => Number(n), {
		maxAge: {days: 20},
	}),
);

expectType<((n: string) => Promise<number>) & {fresh: (n: string) => Promise<number>}>(
	cache.function('number', async (n: string) => Number(n), {
		maxAge: {days: 20},
		staleWhileRevalidate: {days: 5},
	}),
);

expectType<((date: Date) => Promise<string>) & {fresh: (date: Date) => Promise<string>}>(
	cache.function('number', async (date: Date) => String(date.getHours()), {
		cacheKey: ([date]) => date.toLocaleString(),
	}),
);

expectType<((date: Date) => Promise<string>) & {fresh: (date: Date) => Promise<string>}>(
	cache.function('number', async (date: Date) => String(date.getHours()), {
		shouldRevalidate: date => typeof date === 'string',
	}),
);

// This function won't be cached
expectType<((n: undefined[]) => Promise<undefined>) & {fresh: (n: undefined[]) => Promise<undefined>}>(
	cache.function('first', async (n: undefined[]) => n[1]),
);
