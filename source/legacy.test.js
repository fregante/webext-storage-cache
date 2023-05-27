/* eslint-disable n/file-extension-in-import -- No alternative until this file is changed to .test.ts */
import nodeAssert from 'node:assert';
import {test, beforeEach, vi, assert, expect} from 'vitest';
import toMilliseconds from '@sindresorhus/to-milliseconds';
import cache from './legacy.ts';

// Help migration away from AVA
const t = {
	is: assert.equal,
	not: assert.notEqual,
	true: assert.ok,
	deepEqual: assert.deepEqual,
	throwsAsync: nodeAssert.rejects,
};

const getUsernameDemo = async name => name.slice(1).toUpperCase();

function timeInTheFuture(time) {
	return Date.now() + toMilliseconds(time);
}

function createCache(daysFromToday, wholeCache) {
	for (const [key, data] of Object.entries(wholeCache)) {
		chrome.storage.local.get
			.withArgs(key)
			.yields({[key]: {
				data,
				maxAge: timeInTheFuture({days: daysFromToday}),
			}});
	}
}

beforeEach(() => {
	chrome.flush();
	chrome.storage.local.get.yields({});
	chrome.storage.local.set.yields(undefined);
	chrome.storage.local.remove.yields(undefined);
});

test('get() with empty cache', async () => {
	t.is(await cache.get('name'), undefined);
});

test('get() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});
	t.is(await cache.get('name'), 'Rico');
});

test('get() with expired cache', async () => {
	createCache(-10, {
		'cache:name': 'Rico',
	});
	t.is(await cache.get('name'), undefined);
});

test('has() with empty cache', async () => {
	t.is(await cache.has('name'), false);
});

test('has() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});
	t.is(await cache.has('name'), true);
});

test('has() with expired cache', async () => {
	createCache(-10, {
		'cache:name': 'Rico',
	});
	t.is(await cache.has('name'), false);
});

test('set() without a value', async () => {
	await t.throwsAsync(cache.set('name'), {
		name: 'TypeError',
		message: 'Expected a value as the second argument',
	});
});

test('set() with undefined', async () => {
	await cache.set('name', 'Anne');
	await cache.set('name', undefined);
	// Cached value should be erased
	t.is(await cache.has('name'), false);
});

test('set() with value', async () => {
	const maxAge = 20;
	await cache.set('name', 'Anne', {days: maxAge});
	const arguments_ = chrome.storage.local.set.lastCall.args[0];
	t.deepEqual(Object.keys(arguments_), ['cache:name']);
	t.is(arguments_['cache:name'].data, 'Anne');
	t.true(arguments_['cache:name'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	t.true(arguments_['cache:name'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});

test('function() with empty cache', async () => {
	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');
	expect(spy).toHaveBeenNthCalledWith(1, '@anne');
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:spy:@anne'].data, 'ANNE');
});

test('function() with cache', async () => {
	createCache(10, {
		'cache:spy:@anne': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');
	t.is(chrome.storage.local.set.callCount, 0);
	expect(spy).not.toHaveBeenCalled();
});

test('function() with expired cache', async () => {
	createCache(-10, {
		'cache:spy:@anne': 'ONNA',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	t.is(await cache.get('@anne'), undefined);
	t.is(await call('@anne'), 'ANNE');
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');
	expect(spy).toHaveBeenNthCalledWith(1, '@anne');
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:spy:@anne'].data, 'ANNE');
});

test('function() with empty cache and staleWhileRevalidate', async () => {
	const maxAge = 1;
	const staleWhileRevalidate = 29;

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy, {
		maxAge: {days: maxAge},
		staleWhileRevalidate: {days: staleWhileRevalidate},
	});

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');
	t.is(chrome.storage.local.set.callCount, 1);
	const arguments_ = chrome.storage.local.set.lastCall.args[0];
	t.deepEqual(Object.keys(arguments_), ['cache:spy:@anne']);
	t.is(arguments_['cache:spy:@anne'].data, 'ANNE');

	const expectedExpiration = maxAge + staleWhileRevalidate;
	t.true(arguments_['cache:spy:@anne'].maxAge > timeInTheFuture({days: expectedExpiration - 0.5}));
	t.true(arguments_['cache:spy:@anne'].maxAge < timeInTheFuture({days: expectedExpiration + 0.5}));
});

test('function() with fresh cache and staleWhileRevalidate', async () => {
	createCache(30, {
		'cache:spy:@anne': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy, {
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	t.is(await call('@anne'), 'ANNE');

	// Cache is still fresh, it should be used
	expect(spy).not.toHaveBeenCalled();
	t.is(chrome.storage.local.set.callCount, 0);

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// Cache is still fresh, it should never be revalidated
	expect(spy).not.toHaveBeenCalled();
});

test('function() with stale cache and staleWhileRevalidate', async () => {
	createCache(15, {
		'cache:spy:@anne': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy, {
		maxAge: {days: 1},
		staleWhileRevalidate: {days: 29},
	});

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');
	t.is(chrome.storage.local.set.callCount, 0);

	// It shouldn’t be called yet
	expect(spy).not.toHaveBeenCalled();

	await new Promise(resolve => {
		setTimeout(resolve, 100);
	});

	// It should be revalidated
	expect(spy).toHaveBeenCalledOnce();
	t.is(chrome.storage.local.set.callCount, 1);
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:spy:@anne'].data, 'ANNE');
});

test('function() varies cache by function argument', async () => {
	createCache(10, {
		'cache:spy:@anne': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	t.is(await call('@anne'), 'ANNE');
	expect(spy).not.toHaveBeenCalled();

	t.is(await call('@mari'), 'MARI');
	expect(spy).toHaveBeenCalledOnce();
});

test('function() accepts custom cache key generator', async () => {
	createCache(10, {
		'cache:spy:@anne,1': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	await call('@anne', '1');
	expect(spy).not.toHaveBeenCalled();

	await call('@anne', '2');
	expect(spy).toHaveBeenCalledOnce();

	t.is(chrome.storage.local.get.firstCall.args[0], 'cache:spy:@anne,1');
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne,2');
});

test('function() accepts custom string-based cache key', async () => {
	createCache(10, {
		'cache:CUSTOM:["@anne",1]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('CUSTOM', spy);

	await call('@anne', 1);
	expect(spy).not.toHaveBeenCalled();

	await call('@anne', 2);
	expect(spy).toHaveBeenCalledOnce();

	t.is(chrome.storage.local.get.firstCall.args[0], 'cache:CUSTOM:["@anne",1]');
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:CUSTOM:["@anne",2]');
});

test('function() accepts custom string-based with non-primitive parameters', async () => {
	createCache(10, {
		'cache:CUSTOM:["@anne",{"user":[1]}]': 'ANNE,1',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('CUSTOM', spy);

	await call('@anne', {user: [1]});
	expect(spy).not.toHaveBeenCalled();

	await call('@anne', {user: [2]});
	expect(spy).toHaveBeenCalledOnce();

	t.is(chrome.storage.local.get.firstCall.args[0], 'cache:CUSTOM:["@anne",{"user":[1]}]');
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:CUSTOM:["@anne",{"user":[2]}]');
});

test('function() verifies cache with shouldRevalidate callback', async () => {
	createCache(10, {
		'cache:@anne': 'anne@',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy, {
		shouldRevalidate: value => value.endsWith('@'),
	});

	t.is(await call('@anne'), 'ANNE');
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:spy:@anne'].data, 'ANNE');
	expect(spy).toHaveBeenCalledOnce();
});

test('function() avoids concurrent function calls', async () => {
	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	expect(spy).not.toHaveBeenCalled();
	t.is(call('@anne'), call('@anne'));
	await call('@anne');
	expect(spy).toHaveBeenCalledOnce();

	t.not(call('@new'), call('@other'));
	await call('@idk');
	expect(spy).toHaveBeenCalledTimes(4);
});

test('function() avoids concurrent function calls with complex arguments via cacheKey', async () => {
	const spy = vi.fn(async (transform, user) => transform(user.name));
	const call = cache.function('spy', spy, {
		cacheKey: ([fn, user]) => JSON.stringify([fn.name, user]),
	});

	expect(spy).not.toHaveBeenCalled();
	const cacheMePlease = name => name.slice(1).toUpperCase();
	t.is(call(cacheMePlease, {name: '@anne'}), call(cacheMePlease, {name: '@anne'}));
	await call(cacheMePlease, {name: '@anne'});
	expect(spy).toHaveBeenCalledOnce();

	t.not(call(cacheMePlease, {name: '@new'}), call(cacheMePlease, {name: '@other'}));
	await call(cacheMePlease, {name: '@idk'});
	expect(spy).toHaveBeenCalledTimes(4);
});

test('function() always loads the data from storage, not memory', async () => {
	createCache(10, {
		'cache:spy:@anne': 'ANNE',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.callCount, 1);
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');

	createCache(10, {
		'cache:spy:@anne': 'NEW ANNE',
	});

	t.is(await call('@anne'), 'NEW ANNE');

	t.is(chrome.storage.local.get.callCount, 2);
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:spy:@anne');
});

test('function.fresh() ignores cached value', async () => {
	createCache(10, {
		'cache:spy:@anne': 'OVERWRITE_ME',
	});

	const spy = vi.fn(getUsernameDemo);
	const call = cache.function('spy', spy);

	t.is(await call.fresh('@anne'), 'ANNE');

	expect(spy).toHaveBeenNthCalledWith(1, '@anne');
	t.is(chrome.storage.local.get.callCount, 0);
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:spy:@anne'].data, 'ANNE');
});
