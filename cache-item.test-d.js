import { expectType, expectNotAssignable, expectNotType } from 'tsd';
import { CacheItem } from './cache-item.js';
const item = new CacheItem('key');
expectType(item.isCached());
expectType(item.delete());
expectType(item.get());
expectType(item.get());
expectNotAssignable(item.get());
expectNotType(item.set('string'));
// @ts-expect-error Type is string
await item.set(1);
// @ts-expect-error Type is string
await item.set(true);
// @ts-expect-error Type is string
await item.set([true, 'string']);
// @ts-expect-error Type is string
await item.set({ wow: [true, 'string'] });
// @ts-expect-error Type is string
await item.set(1, { days: 1 });
