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
