import {
	test, vi, assert, expect, beforeEach,
} from 'vitest';
import CachedFunction from './cached-function.ts';
import {
	createCache,
	timeInTheFuture,
} from './test-utils.js';

const getUsernameDemo = async name => name.slice(1).toUpperCase();
const storage = chrome.storage.local;

beforeEach(() => {
	vi.resetAllMocks();
	createCache(30, {});
});

test('getCached() with empty cache', async () => {
	const spy = vi.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});

	assert.equal(await testItem.getCached(), undefined);

	expect(spy).not.toHaveBeenCalled();
});

test('getCached() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});

	const spy = vi.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});

	assert.equal(await testItem.getCached(), 'Rico');

	expect(spy).not.toHaveBeenCalled();
});

test('getCached() with expired cache', async () => {
	createCache(-10, {
		'cache:name': 'Rico',
	});

	const spy = vi.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});

	assert.equal(await testItem.getCached(), undefined);

	expect(spy).not.toHaveBeenCalled();
});

test('`updater` with empty cache', async () => {
	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	expect(storage.get).toHaveBeenCalledWith('cache:spy:["@anne"]');
	expect(spy).toHaveBeenNthCalledWith(1, '@anne');

	expect(storage.set).toHaveBeenCalledTimes(1);

	const argument = storage.set.mock.calls.at(-1)[0];

	assert.equal(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` with cache', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	expect(storage.get).toHaveBeenCalledWith('cache:spy:["@anne"]');
	expect(storage.set).not.toHaveBeenCalled();
	expect(spy).not.toHaveBeenCalled();
});

test('`updater` with expired cache', async () => {
	createCache(-10, {
		'cache:spy:["@anne"]': 'ONNA-expired-name',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	expect(storage.get).toHaveBeenCalledWith('cache:spy:["@anne"]');
	expect(spy).toHaveBeenNthCalledWith(1, '@anne');

	const argument = storage.set.mock.calls.at(-1)[0];

	assert.equal(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` with empty cache and staleWhileRevalidate', async () => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	expect(storage.get).toHaveBeenCalledWith('cache:spy:["@anne"]');
	expect(storage.set).toHaveBeenCalledTimes(1);

	const argument = storage.set.mock.calls.at(-1)[0];

	assert.deepEqual(Object.keys(argument), ['cache:spy:["@anne"]']);
	assert.equal(argument['cache:spy:["@anne"]'].data, 'ANNE');

	const expectedExpiration = maxAge + staleWhileRevalidate;
	assert.ok(argument['cache:spy:["@anne"]'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	assert.ok(argument['cache:spy:["@anne"]'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('`updater` with fresh cache and staleWhileRevalidate', async () => {
	createCache(30, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	// Cache is still fresh, it should be used
	expect(spy).not.toHaveBeenCalled();
	expect(storage.set).not.toHaveBeenCalled();

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// Cache is still fresh, it should never be revalidated
	expect(spy).not.toHaveBeenCalled();
});

test('`updater` with stale cache and staleWhileRevalidate', async () => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	expect(storage.get).toHaveBeenCalledWith('cache:spy:["@anne"]');
	expect(storage.set).not.toHaveBeenCalled();

	// It shouldn’t be called yet
	expect(spy).not.toHaveBeenCalled();

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// It should be revalidated
	expect(spy).toHaveBeenCalledOnce();
	expect(storage.set).toHaveBeenCalledTimes(1);

	const argument = storage.set.mock.calls.at(-1)[0];

	assert.equal(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` varies cache by function argument', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');
	expect(spy).not.toHaveBeenCalled();

	assert.equal(await updaterItem.get('@mari'), 'MARI');
	expect(spy).toHaveBeenCalledOnce();
});

test('`updater` accepts custom cache key generator', async () => {
	createCache(10, {
		'cache:spy:["@anne",1]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await updaterItem.get('@anne', 1);
	expect(spy).not.toHaveBeenCalled();

	await updaterItem.get('@anne', 2);
	expect(spy).toHaveBeenCalledOnce();

	assert.equal(storage.get.mock.calls[0][0], 'cache:spy:["@anne",1]');
	assert.equal(storage.get.mock.calls.at(-1)[0], 'cache:spy:["@anne",2]');
});

test('`updater` accepts custom string-based cache key', async () => {
	createCache(10, {
		'cache:CUSTOM:["@anne",1]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('CUSTOM', {updater: spy});

	await updaterItem.get('@anne', 1);
	expect(spy).not.toHaveBeenCalled();

	await updaterItem.get('@anne', 2);
	expect(spy).toHaveBeenCalledOnce();

	assert.equal(storage.get.mock.calls[0][0], 'cache:CUSTOM:["@anne",1]');
	assert.equal(storage.get.mock.calls.at(-1)[0], 'cache:CUSTOM:["@anne",2]');
});

test('`updater` accepts custom string-based with non-primitive parameters', async () => {
	createCache(10, {
		'cache:CUSTOM:["@anne",{"user":[1]}]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('CUSTOM', {updater: spy});

	await updaterItem.get('@anne', {user: [1]});
	expect(spy).not.toHaveBeenCalled();

	await updaterItem.get('@anne', {user: [2]});
	expect(spy).toHaveBeenCalledOnce();

	assert.equal(storage.get.mock.calls[0][0], 'cache:CUSTOM:["@anne",{"user":[1]}]');
	assert.equal(storage.get.mock.calls.at(-1)[0], 'cache:CUSTOM:["@anne",{"user":[2]}]');
});

test('`updater` verifies cache with shouldRevalidate callback', async () => {
	createCache(10, {
		'cache:@anne': 'anne@',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		shouldRevalidate: value => value.endsWith('@'),
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	expect(storage.get).toHaveBeenCalledWith('cache:spy:["@anne"]');

	const argument = storage.set.mock.calls.at(-1)[0];

	assert.equal(argument['cache:spy:["@anne"]'].data, 'ANNE');
	expect(spy).toHaveBeenCalledOnce();
});

test('`updater` avoids concurrent function calls', async () => {
	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	expect(spy).not.toHaveBeenCalled();

	// Parallel calls
	updaterItem.get('@anne');
	updaterItem.get('@anne');
	await updaterItem.get('@anne');

	expect(spy).toHaveBeenCalledOnce();

	// Parallel calls
	updaterItem.get('@new');
	updaterItem.get('@other');
	await updaterItem.get('@idk');

	expect(spy).toHaveBeenCalledTimes(4);
});

test('`updater` avoids concurrent function calls with complex arguments via cacheKey', async () => {
	const spy = vi.fn(async (transform, user) => transform(user.name));

	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		cacheKey: ([function_, user]) => JSON.stringify([function_.name, user]),
	});

	expect(spy).not.toHaveBeenCalled();

	const cacheMePlease = name => name.slice(1).toUpperCase();

	// Parallel calls
	updaterItem.get(cacheMePlease, {name: '@anne'});
	updaterItem.get(cacheMePlease, {name: '@anne'});

	await updaterItem.get(cacheMePlease, {name: '@anne'});

	expect(spy).toHaveBeenCalledOnce();

	// Parallel calls
	updaterItem.get(cacheMePlease, {name: '@new'});
	updaterItem.get(cacheMePlease, {name: '@other'});

	await updaterItem.get(cacheMePlease, {name: '@idk'});

	expect(spy).toHaveBeenCalledTimes(4);
});

test('`updater` uses cacheKey at every call, regardless of arguments', async () => {
	const cacheKey = vi.fn(arguments_ => arguments_.length);

	const updaterItem = new CachedFunction('spy', {
		updater() {},
		cacheKey,
	});

	await updaterItem.get();
	await updaterItem.get();

	expect(cacheKey).toHaveBeenCalledTimes(2);

	await updaterItem.get('@anne');
	await updaterItem.get('@anne');

	expect(cacheKey).toHaveBeenCalledTimes(4);
});

test('`updater` always loads the data from storage, not memory', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	expect(storage.get).toHaveBeenCalledTimes(1);
	expect(storage.get).toHaveBeenLastCalledWith('cache:spy:["@anne"]');

	createCache(10, {
		'cache:spy:["@anne"]': 'NEW ANNE',
	});

	assert.equal(await updaterItem.get('@anne'), 'NEW ANNE');

	expect(storage.get).toHaveBeenCalledTimes(2);
	expect(storage.get).toHaveBeenLastCalledWith('cache:spy:["@anne"]');
});

test('.getFresh() ignores cached value', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'OVERWRITE_ME',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.getFresh('@anne'), 'ANNE');

	expect(spy).toHaveBeenNthCalledWith(1, '@anne');
	expect(storage.get).not.toHaveBeenCalled();

	const argument = storage.set.mock.calls.at(-1)[0];

	assert.equal(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('.getFresh() stores using maxAge + staleWhileRevalidate', async () => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	await updaterItem.getFresh('@anne');

	const argument = storage.set.mock.calls.at(-1)[0];
	const expectedExpiration = maxAge + staleWhileRevalidate;

	assert.ok(argument['cache:spy:["@anne"]'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	assert.ok(argument['cache:spy:["@anne"]'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('.applyOverride() throws without arguments', async () => {
	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await expect(updaterItem.applyOverride()).rejects.toThrow(TypeError);

	expect(storage.set).not.toHaveBeenCalled();
});

test('.applyOverride() stores the value under the computed key', async () => {
	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await updaterItem.applyOverride(['@anne'], 'OVERRIDDEN');

	const argument = storage.set.mock.calls.at(-1)[0];

	assert.equal(argument['cache:spy:["@anne"]'].data, 'OVERRIDDEN');
	expect(spy).not.toHaveBeenCalled();
});

test('.applyOverride() stores using maxAge + staleWhileRevalidate', async () => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	await updaterItem.applyOverride(['@anne'], 'OVERRIDDEN');

	const argument = storage.set.mock.calls.at(-1)[0];
	const expectedExpiration = maxAge + staleWhileRevalidate;

	assert.ok(argument['cache:spy:["@anne"]'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	assert.ok(argument['cache:spy:["@anne"]'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('.isCached() is false for empty cache and never calls the updater', async () => {
	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.isCached('@anne'), false);

	expect(spy).not.toHaveBeenCalled();
	expect(storage.set).not.toHaveBeenCalled();
});

test('.isCached() is true for a cached value', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.isCached('@anne'), true);

	expect(spy).not.toHaveBeenCalled();
});

test('.isCached() is false for an expired cache', async () => {
	createCache(-10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.isCached('@anne'), false);

	expect(spy).not.toHaveBeenCalled();
});

test('background revalidation is deduped across overlapping calls', async () => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	// A slow updater keeps the first revalidation in flight long enough
	// for the second one's trigger to observe it and dedupe against it.
	const spy = vi.fn(async () => new Promise(resolve => {
		setTimeout(() => resolve('ANNE'), 20);
	}));

	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');
	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	expect(spy).toHaveBeenCalledOnce();
	expect(storage.set).toHaveBeenCalledTimes(1);
});

test('background revalidation failure does not crash or wedge the cache', async () => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn()
		.mockRejectedValueOnce(new Error('boom'))
		.mockImplementation(getUsernameDemo);

	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// The failed revalidation must not have touched the cache
	expect(spy).toHaveBeenCalledOnce();
	expect(storage.set).not.toHaveBeenCalled();

	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	assert.equal(await updaterItem.get('@anne'), 'ANNE');

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// A later call must be able to revalidate again, not be stuck
	expect(spy).toHaveBeenCalledTimes(2);
	expect(storage.set).toHaveBeenCalledTimes(1);
});

test('`updater` returning undefined caches the entry', async () => {
	const spy = vi.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await updaterItem.get('@anne');

	assert.equal(await updaterItem.isCached('@anne'), true);
	assert.equal(await updaterItem.getCached('@anne'), undefined);
	expect(spy).toHaveBeenCalledOnce();
});

test('`updater` returning undefined overwrites an existing cache entry', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		shouldRevalidate: () => true,
	});

	assert.equal(await updaterItem.isCached('@anne'), true);

	await updaterItem.get('@anne');

	assert.equal(await updaterItem.isCached('@anne'), true);
	assert.equal(await updaterItem.getCached('@anne'), undefined);
});

test('background revalidation returning undefined overwrites the stale entry', async () => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = vi.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	// Stale cache is still served synchronously
	assert.equal(await updaterItem.get('@anne'), 'ANNE');
	assert.equal(await updaterItem.isCached('@anne'), true);

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	expect(spy).toHaveBeenCalledOnce();
	assert.equal(await updaterItem.isCached('@anne'), true);
	assert.equal(await updaterItem.getCached('@anne'), undefined);
});

test('.getFresh() returning undefined overwrites any existing cache entry', async () => {
	createCache(10, {
		'cache:spy:["@anne"]': 'OLD',
	});

	const spy = vi.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	assert.equal(await updaterItem.isCached('@anne'), true);

	await updaterItem.getFresh('@anne');

	assert.equal(await updaterItem.isCached('@anne'), true);
	assert.equal(await updaterItem.getCached('@anne'), undefined);
});

test('caches undefined values', async () => {
	const updater = vi.fn().mockResolvedValue(undefined);
	const cache = new CachedFunction('test', {updater});

	await expect(cache.get()).resolves.toBeUndefined();
	await expect(cache.get()).resolves.toBeUndefined();

	expect(updater).toHaveBeenCalledTimes(1);
});

test('considers cached undefined values as cached', async () => {
	const updater = vi.fn().mockResolvedValue(undefined);
	const cache = new CachedFunction('test', {updater});

	await cache.get();

	await expect(cache.isCached()).resolves.toBe(true);

	await cache.delete();

	await expect(cache.isCached()).resolves.toBe(false);
});
