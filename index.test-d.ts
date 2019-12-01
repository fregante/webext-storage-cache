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
