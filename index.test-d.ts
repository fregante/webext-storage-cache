import {expectType, expectNotAssignable} from 'tsd';
import cache from '.';

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, unknown>;

expectType<Promise<boolean>>(cache.has('key'));
expectType<Promise<void>>(cache.delete('key'));

expectType<Promise<Value | undefined>>(cache.get('key'));
expectType<Promise<string | undefined>>(cache.get<string>('key'));
expectNotAssignable<Promise<number | undefined>>(cache.get<string>('key'));

expectType<Promise<void>>(cache.set('key', 1));
expectType<Promise<void>>(cache.set('key', true));
expectType<Promise<void>>(cache.set('key', [true, 'string']));
expectType<Promise<void>>(cache.set('key', {wow: [true, 'string']}));
expectType<Promise<void>>(cache.set('key', 1, 1));

const cachedPower = cache.function((n: number) => n ** 1000);
expectType<(n: number) => Promise<number>>(cachedPower);
expectType<number>(await cachedPower(1));

expectType<(n: string) => Promise<number>>(cache.function(
	(n: string) => Number(n)
));

expectType<(n: string) => Promise<number>>(cache.function(
	(n: string) => Number(n)
	, {
		expiration: 20
	}));

expectType<(date: Date) => Promise<string | undefined>>(cache.function(
	(date: Date) => date.getHours() > 6 ? String(date) : undefined
	, {
		cacheKey: ([date]) => date.toLocaleString()
	}));

