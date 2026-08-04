import {expectType, expectNotAssignable, expectAssignable} from 'tsd';
import CachedValue from './cached-value.js';

type Primitive = boolean | number | string;
type Value = Primitive | Primitive[] | Record<string, any>;

const item = new CachedValue<string>('key');

expectType<Promise<boolean>>(item.isCached());
expectType<Promise<void>>(item.delete());

expectAssignable<Promise<Value | undefined>>(item.get());
expectNotAssignable<Promise<number | undefined>>(item.get());
expectType<Promise<string | undefined>>(item.get());
expectType<Promise<'some string'>>(item.set('some string'));

// @ts-expect-error Type is string
await item.set(1);

// @ts-expect-error Type is string
await item.set(true);

// @ts-expect-error Type is string
await item.set([true, 'string']);

// @ts-expect-error Type is string
await item.set({wow: [true, 'string']});

// @ts-expect-error Type is string
await item.set(1, {days: 1});

// Stores `undefined`
const undefinedItem = new CachedValue<string | undefined>('key');

expectType<Promise<string | undefined>>(undefinedItem.get());
expectType<Promise<undefined>>(undefinedItem.set(undefined));

// .set preserves the input value
const maybeString = new CachedValue<string | undefined>('key');

expectType<Promise<'hello'>>(maybeString.set('hello'));
expectType<Promise<undefined>>(maybeString.set(undefined));
expectType<Promise<'x' | undefined>>(maybeString.set(Math.random() > 0.5 ? 'x' : undefined));
