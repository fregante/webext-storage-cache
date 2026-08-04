import {expectType, expectNotAssignable, expectAssignable} from 'tsd';
import CachedMap from './cached-map.js';

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, any>;

const item = new CachedMap<string>('key');

expectType<Promise<boolean>>(item.has('sindresorhus'));
expectType<Promise<void>>(item.delete('sindresorhus'));

expectAssignable<Promise<Value | undefined>>(item.get('sindresorhus'));
expectNotAssignable<Promise<number | undefined>>(item.get('sindresorhus'));
expectType<Promise<string | undefined>>(item.get('sindresorhus'));
expectType<Promise<string>>(item.set('sindresorhus', 'some string'));

// @ts-expect-error Type is string
await item.set('sindresorhus', 1);

// @ts-expect-error Type is string
await item.set('sindresorhus', true);

// @ts-expect-error Type is string
await item.set('sindresorhus', [true, 'string']);

// @ts-expect-error Type is string
await item.set('sindresorhus', {wow: [true, 'string']});

// @ts-expect-error Type is string
await item.set('sindresorhus', 1, {days: 1});
