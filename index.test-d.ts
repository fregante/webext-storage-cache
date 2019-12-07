import {expectType, expectNotAssignable, expectAssignable} from 'tsd';
import cache from '.';

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, unknown>;

expectType<Promise<boolean>>(cache.has('key'));
expectType<Promise<void>>(cache.delete('key'));

expectType<Promise<Value | undefined>>(cache.get('key'));
expectType<Promise<string | undefined>>(cache.get<string>('key'));
expectNotAssignable<Promise<number | undefined>>(cache.get<string>('key'));

expectAssignable<Promise<number>>(cache.set('key', 1));
expectAssignable<Promise<boolean>>(cache.set('key', true));
expectAssignable<Promise<[boolean, string]>>(cache.set('key', [true, 'string']));
expectAssignable<Promise<Record<string, any[]>>>(cache.set('key', {wow: [true, 'string']}));
expectAssignable<Promise<number>>(cache.set('key', 1, 1));

const cachedPower = cache.function((n: number) => n ** 1000);
expectType<(n: number) => Promise<number>>(cachedPower);
expectType<number>(await cachedPower(1));

expectType<(n: string) => Promise<number>>(
	cache.function((n: string) => Number(n))
);

expectType<(n: string) => Promise<number>>(
	cache.function(async (n: string) => Number(n))
);

function identity(x: string): string;
function identity(x: number): number;
function identity(x: number | string): number | string {
	return x;
}

// TODO: Overloads are failing
expectType<Promise<number>>(cache.function(identity)(1));
/// expectType<Promise<string>>(cache.function(identity)('1'));
expectNotAssignable<Promise<string>>(cache.function(identity)(1));
/// expectNotAssignable<Promise<number>>(cache.function(identity)('1'));

expectType<(n: string) => Promise<number>>(
	cache.function((n: string) => Number(n), {
		expiration: 20
	})
);

expectType<(date: Date) => Promise<string>>(
	cache.function((date: Date) => String(date.getHours()), {
		cacheKey: ([date]) => date.toLocaleString()
	})
);
