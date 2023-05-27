/* eslint-disable no-new  */
import { expectType, expectNotAssignable, expectNotType } from 'tsd';
import { CacheItem, UpdatableCacheItem } from './cache-item.js';
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
const itemWithUpdater = new UpdatableCacheItem('key', {
    updater: async (one) => String(one).toUpperCase(),
});
expectType(itemWithUpdater.get);
expectNotAssignable(itemWithUpdater.get);
async function identity(x) {
    return x;
}
expectType(new UpdatableCacheItem('identity', { updater: identity }).get(1));
expectType(new UpdatableCacheItem('identity', { updater: identity }).get('1'));
// @ts-expect-error -- If a function returns undefined, it's not cacheable
new UpdatableCacheItem('identity', { updater: async (n) => n[1] });
// TODO: These expectation assertions are not working…
expectNotAssignable(new UpdatableCacheItem('identity', { updater: identity }).get(1));
expectNotType(new UpdatableCacheItem('identity', { updater: identity }).get('1'));
new UpdatableCacheItem('number', {
    updater: async (n) => Number(n),
    maxAge: { days: 20 },
});
new UpdatableCacheItem('number', {
    updater: async (n) => Number(n),
    maxAge: { days: 20 },
    staleWhileRevalidate: { days: 5 },
});
new UpdatableCacheItem('number', {
    updater: async (date) => String(date.getHours()),
    cacheKey: ([date]) => date.toLocaleString(),
});
new UpdatableCacheItem('number', {
    updater: async (date) => String(date.getHours()),
    shouldRevalidate: date => typeof date === 'string',
});
