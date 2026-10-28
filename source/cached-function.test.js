import {
	beforeEach,
	test,
} from 'node:test';
import CachedFunction from './cached-function.ts';
import {
	calledWith,
	createCache,
	resetMocks,
	timeInTheFuture,
} from './testing-utils.js';

const getUsernameDemo = async name => name.slice(1).toUpperCase();
const storage = chrome.storage.local;

beforeEach(() => {
	resetMocks();
	createCache(30, {});
});

test('getCached() with empty cache', async t => {
	const spy = t.mock.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});

	t.assert.strictEqual(await testItem.getCached(), undefined);

	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('getCached() with cache', async t => {
	createCache(10, {
		'cache:name': 'Rico',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});

	t.assert.strictEqual(await testItem.getCached(), 'Rico');

	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('getCached() with expired cache', async t => {
	createCache(-10, {
		'cache:name': 'Rico',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const testItem = new CachedFunction('name', {updater: spy});

	t.assert.strictEqual(await testItem.getCached(), undefined);

	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('`updater` with empty cache', async t => {
	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	t.assert.ok(calledWith(storage.get, 'cache:spy:["@anne"]'));
	t.assert.deepStrictEqual(spy.mock.calls[0]?.arguments, ['@anne']);

	t.assert.strictEqual(storage.set.mock.callCount(), 1);

	const argument = storage.set.mock.calls.at(-1).arguments[0];

	t.assert.strictEqual(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` with cache', async t => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	t.assert.ok(calledWith(storage.get, 'cache:spy:["@anne"]'));
	t.assert.strictEqual(storage.set.mock.callCount(), 0);
	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('`updater` with expired cache', async t => {
	createCache(-10, {
		'cache:spy:["@anne"]': 'ONNA-expired-name',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	t.assert.ok(calledWith(storage.get, 'cache:spy:["@anne"]'));
	t.assert.deepStrictEqual(spy.mock.calls[0]?.arguments, ['@anne']);

	const argument = storage.set.mock.calls.at(-1).arguments[0];

	t.assert.strictEqual(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` with empty cache and staleWhileRevalidate', async t => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	t.assert.ok(calledWith(storage.get, 'cache:spy:["@anne"]'));
	t.assert.strictEqual(storage.set.mock.callCount(), 1);

	const argument = storage.set.mock.calls.at(-1).arguments[0];

	t.assert.deepStrictEqual(Object.keys(argument), ['cache:spy:["@anne"]']);
	t.assert.strictEqual(argument['cache:spy:["@anne"]'].data, 'ANNE');

	const expectedExpiration = maxAge + staleWhileRevalidate;
	t.assert.ok(argument['cache:spy:["@anne"]'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	t.assert.ok(argument['cache:spy:["@anne"]'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('`updater` with fresh cache and staleWhileRevalidate', async t => {
	createCache(30, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	// Cache is still fresh, it should be used
	t.assert.strictEqual(spy.mock.callCount(), 0);
	t.assert.strictEqual(storage.set.mock.callCount(), 0);

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// Cache is still fresh, it should never be revalidated
	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('`updater` with stale cache and staleWhileRevalidate', async t => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	t.assert.ok(calledWith(storage.get, 'cache:spy:["@anne"]'));
	t.assert.strictEqual(storage.set.mock.callCount(), 0);

	// It shouldn’t be called yet
	t.assert.strictEqual(spy.mock.callCount(), 0);

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// It should be revalidated
	t.assert.strictEqual(spy.mock.callCount(), 1);
	t.assert.strictEqual(storage.set.mock.callCount(), 1);

	const argument = storage.set.mock.calls.at(-1).arguments[0];

	t.assert.strictEqual(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('`updater` varies cache by function argument', async t => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');
	t.assert.strictEqual(spy.mock.callCount(), 0);

	t.assert.strictEqual(await updaterItem.get('@mari'), 'MARI');
	t.assert.strictEqual(spy.mock.callCount(), 1);
});

test('`updater` accepts custom cache key generator', async t => {
	createCache(10, {
		'cache:spy:["@anne",1]': 'ANNE,1',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await updaterItem.get('@anne', 1);
	t.assert.strictEqual(spy.mock.callCount(), 0);

	await updaterItem.get('@anne', 2);
	t.assert.strictEqual(spy.mock.callCount(), 1);

	t.assert.strictEqual(storage.get.mock.calls[0].arguments[0], 'cache:spy:["@anne",1]');
	t.assert.strictEqual(storage.get.mock.calls.at(-1).arguments[0], 'cache:spy:["@anne",2]');
});

test('`updater` accepts custom string-based cache key', async t => {
	createCache(10, {
		'cache:CUSTOM:["@anne",1]': 'ANNE,1',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('CUSTOM', {updater: spy});

	await updaterItem.get('@anne', 1);
	t.assert.strictEqual(spy.mock.callCount(), 0);

	await updaterItem.get('@anne', 2);
	t.assert.strictEqual(spy.mock.callCount(), 1);

	t.assert.strictEqual(storage.get.mock.calls[0].arguments[0], 'cache:CUSTOM:["@anne",1]');
	t.assert.strictEqual(storage.get.mock.calls.at(-1).arguments[0], 'cache:CUSTOM:["@anne",2]');
});

test('`updater` accepts custom string-based with non-primitive parameters', async t => {
	createCache(10, {
		'cache:CUSTOM:["@anne",{"user":[1]}]': 'ANNE,1',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('CUSTOM', {updater: spy});

	await updaterItem.get('@anne', {user: [1]});
	t.assert.strictEqual(spy.mock.callCount(), 0);

	await updaterItem.get('@anne', {user: [2]});
	t.assert.strictEqual(spy.mock.callCount(), 1);

	t.assert.strictEqual(storage.get.mock.calls[0].arguments[0], 'cache:CUSTOM:["@anne",{"user":[1]}]');
	t.assert.strictEqual(storage.get.mock.calls.at(-1).arguments[0], 'cache:CUSTOM:["@anne",{"user":[2]}]');
});

test('`updater` verifies cache with shouldRevalidate callback', async t => {
	createCache(10, {
		'cache:@anne': 'anne@',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		shouldRevalidate: value => value.endsWith('@'),
	});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	t.assert.ok(calledWith(storage.get, 'cache:spy:["@anne"]'));

	const argument = storage.set.mock.calls.at(-1).arguments[0];

	t.assert.strictEqual(argument['cache:spy:["@anne"]'].data, 'ANNE');
	t.assert.strictEqual(spy.mock.callCount(), 1);
});

test('`updater` avoids concurrent function calls', async t => {
	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(spy.mock.callCount(), 0);

	// Parallel calls
	updaterItem.get('@anne');
	updaterItem.get('@anne');
	await updaterItem.get('@anne');

	t.assert.strictEqual(spy.mock.callCount(), 1);

	// Parallel calls
	updaterItem.get('@new');
	updaterItem.get('@other');
	await updaterItem.get('@idk');

	t.assert.strictEqual(spy.mock.callCount(), 4);
});

test('`updater` avoids concurrent function calls with complex arguments via cacheKey', async t => {
	const spy = t.mock.fn(async (transform, user) => transform(user.name));

	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		cacheKey: ([function_, user]) => JSON.stringify([function_.name, user]),
	});

	t.assert.strictEqual(spy.mock.callCount(), 0);

	const cacheMePlease = name => name.slice(1).toUpperCase();

	// Parallel calls
	updaterItem.get(cacheMePlease, {name: '@anne'});
	updaterItem.get(cacheMePlease, {name: '@anne'});

	await updaterItem.get(cacheMePlease, {name: '@anne'});

	t.assert.strictEqual(spy.mock.callCount(), 1);

	// Parallel calls
	updaterItem.get(cacheMePlease, {name: '@new'});
	updaterItem.get(cacheMePlease, {name: '@other'});

	await updaterItem.get(cacheMePlease, {name: '@idk'});

	t.assert.strictEqual(spy.mock.callCount(), 4);
});

test('`updater` uses cacheKey at every call, regardless of arguments', async t => {
	const cacheKey = t.mock.fn(arguments_ => arguments_.length);

	const updaterItem = new CachedFunction('spy', {
		updater() {},
		cacheKey,
	});

	await updaterItem.get();
	await updaterItem.get();

	t.assert.strictEqual(cacheKey.mock.callCount(), 2);

	await updaterItem.get('@anne');
	await updaterItem.get('@anne');

	t.assert.strictEqual(cacheKey.mock.callCount(), 4);
});

test('`updater` always loads the data from storage, not memory', async t => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	t.assert.strictEqual(storage.get.mock.callCount(), 1);
	t.assert.deepStrictEqual(storage.get.mock.calls.at(-1)?.arguments, ['cache:spy:["@anne"]']);

	createCache(10, {
		'cache:spy:["@anne"]': 'NEW ANNE',
	});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'NEW ANNE');

	t.assert.strictEqual(storage.get.mock.callCount(), 2);
	t.assert.deepStrictEqual(storage.get.mock.calls.at(-1)?.arguments, ['cache:spy:["@anne"]']);
});

test('.getFresh() ignores cached value', async t => {
	createCache(10, {
		'cache:spy:["@anne"]': 'OVERWRITE_ME',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.getFresh('@anne'), 'ANNE');

	t.assert.deepStrictEqual(spy.mock.calls[0]?.arguments, ['@anne']);
	t.assert.strictEqual(storage.get.mock.callCount(), 0);

	const argument = storage.set.mock.calls.at(-1).arguments[0];

	t.assert.strictEqual(argument['cache:spy:["@anne"]'].data, 'ANNE');
});

test('.getFresh() stores using maxAge + staleWhileRevalidate', async t => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	await updaterItem.getFresh('@anne');

	const argument = storage.set.mock.calls.at(-1).arguments[0];
	const expectedExpiration = maxAge + staleWhileRevalidate;

	t.assert.ok(argument['cache:spy:["@anne"]'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	t.assert.ok(argument['cache:spy:["@anne"]'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('.setCached() throws without arguments', async t => {
	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await t.assert.rejects(updaterItem.setCached(), TypeError);

	t.assert.strictEqual(storage.set.mock.callCount(), 0);
});

test('.setCached() stores the value under the computed key', async t => {
	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await updaterItem.setCached('OVERRIDDEN', '@anne');

	const argument = storage.set.mock.calls.at(-1).arguments[0];

	t.assert.strictEqual(argument['cache:spy:["@anne"]'].data, 'OVERRIDDEN');
	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('.setCached() stores using maxAge + staleWhileRevalidate', async t => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	await updaterItem.setCached('OVERRIDDEN', '@anne');

	const argument = storage.set.mock.calls.at(-1).arguments[0];
	const expectedExpiration = maxAge + staleWhileRevalidate;

	t.assert.ok(argument['cache:spy:["@anne"]'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	t.assert.ok(argument['cache:spy:["@anne"]'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('.isCached() is false for empty cache and never calls the updater', async t => {
	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.isCached('@anne'), false);

	t.assert.strictEqual(spy.mock.callCount(), 0);
	t.assert.strictEqual(storage.set.mock.callCount(), 0);
});

test('.isCached() is true for a cached value', async t => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);

	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('.isCached() is false for an expired cache', async t => {
	createCache(-10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.isCached('@anne'), false);

	t.assert.strictEqual(spy.mock.callCount(), 0);
});

test('background revalidation is deduped across overlapping calls', async t => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	// A slow updater keeps the first revalidation in flight long enough
	// for the second one's trigger to observe it and dedupe against it.
	const spy = t.mock.fn(async () => new Promise(resolve => {
		setTimeout(() => resolve('ANNE'), 20);
	}));

	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	t.assert.deepStrictEqual([await updaterItem.get('@anne'), await updaterItem.get('@anne')], ['ANNE', 'ANNE']);

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	t.assert.strictEqual(spy.mock.callCount(), 1);
	t.assert.strictEqual(storage.set.mock.callCount(), 1);
});

test('background revalidation failure does not crash or wedge the cache', async t => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(getUsernameDemo);
	spy.mock.mockImplementationOnce(async () => {
		throw new Error('boom');
	}, 0);

	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// The failed revalidation must not have touched the cache
	t.assert.strictEqual(spy.mock.callCount(), 1);
	t.assert.strictEqual(storage.set.mock.callCount(), 0);

	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// A later call must be able to revalidate again, not be stuck
	t.assert.strictEqual(spy.mock.callCount(), 2);
	t.assert.strictEqual(storage.set.mock.callCount(), 1);
});

test('`updater` returning undefined caches the entry', async t => {
	const spy = t.mock.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	await updaterItem.get('@anne');

	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);
	t.assert.strictEqual(await updaterItem.getCached('@anne'), undefined);
	t.assert.strictEqual(spy.mock.callCount(), 1);
});

test('`updater` returning undefined overwrites an existing cache entry', async t => {
	createCache(10, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		shouldRevalidate: () => true,
	});

	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);

	await updaterItem.get('@anne');

	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);
	t.assert.strictEqual(await updaterItem.getCached('@anne'), undefined);
});

test('background revalidation returning undefined overwrites the stale entry', async t => {
	createCache(15, {
		'cache:spy:["@anne"]': 'ANNE',
	});

	const spy = t.mock.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {
		updater: spy,
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	// Stale cache is still served synchronously
	t.assert.strictEqual(await updaterItem.get('@anne'), 'ANNE');
	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	t.assert.strictEqual(spy.mock.callCount(), 1);
	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);
	t.assert.strictEqual(await updaterItem.getCached('@anne'), undefined);
});

test('.getFresh() returning undefined overwrites any existing cache entry', async t => {
	createCache(10, {
		'cache:spy:["@anne"]': 'OLD',
	});

	const spy = t.mock.fn(async () => undefined);
	const updaterItem = new CachedFunction('spy', {updater: spy});

	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);

	await updaterItem.getFresh('@anne');

	t.assert.strictEqual(await updaterItem.isCached('@anne'), true);
	t.assert.strictEqual(await updaterItem.getCached('@anne'), undefined);
});

test('caches undefined values', async t => {
	const updater = t.mock.fn(async () => undefined);
	const cache = new CachedFunction('test', {updater});

	t.assert.deepStrictEqual([await cache.get(), await cache.get()], [undefined, undefined]);

	t.assert.strictEqual(updater.mock.callCount(), 1);
});

test('considers cached undefined values as cached', async t => {
	const updater = t.mock.fn(async () => undefined);
	const cache = new CachedFunction('test', {updater});

	await cache.get();

	t.assert.strictEqual(await cache.isCached(), true);

	await cache.delete();

	t.assert.strictEqual(await cache.isCached(), false);
});
