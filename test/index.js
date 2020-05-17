import test from 'ava';
import sinon from 'sinon';
import './_fixtures.js';
import cache from '../index.js';

const getUsernameDemo = async name => name.slice(1).toUpperCase();

function millisecondsFromNow(milliseconds) {
	return Date.now() + milliseconds;
}

function createCache(daysFromToday, wholeCache) {
	for (const [key, data] of Object.entries(wholeCache)) {
		chrome.storage.local.get
			.withArgs(key)
			.yields({[key]: {
				data,
				maxAge: millisecondsFromNow(cache.days(daysFromToday))
			}});
	}
}

test.beforeEach(() => {
	chrome.flush();
	chrome.storage.local.get.yields({});
	chrome.storage.local.set.yields(undefined);
	chrome.storage.local.remove.yields(undefined);
});

test.serial('get() with empty cache', async t => {
	t.is(await cache.get('name'), undefined);
});

test.serial('get() with cache', async t => {
	createCache(10, {
		'cache:name': 'Rico'
	});
	t.is(await cache.get('name'), 'Rico');
});

test.serial('get() with expired cache', async t => {
	createCache(-10, {
		'cache:name': 'Rico'
	});
	t.is(await cache.get('name'), undefined);
});

test.serial('set() with undefined', async t => {
	await cache.set('name');
	// StorageArea.set should not be called with `undefined`
	t.is(chrome.storage.local.set.callCount, 0);
});

test.todo('set() with past maxAge should throw');

test.serial('set() with value', async t => {
	const maxAge = cache.days(20);
	await cache.set('name', 'Anne', maxAge);
	const arguments_ = chrome.storage.local.set.lastCall.args[0];
	t.deepEqual(Object.keys(arguments_), ['cache:name']);
	t.is(arguments_['cache:name'].data, 'Anne');
	t.true(arguments_['cache:name'].maxAge > millisecondsFromNow(maxAge - cache.days(0.5)));
	t.true(arguments_['cache:name'].maxAge < millisecondsFromNow(maxAge + cache.days(0.5)));
});

test.serial('function() with empty cache', async t => {
	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy);

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:@anne');
	t.true(spy.withArgs('@anne').calledOnce);
	t.is(spy.callCount, 1);
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:@anne'].data, 'ANNE');
});

test.serial('function() with cache', async t => {
	createCache(10, {
		'cache:@anne': 'ANNE'
	});

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy);

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:@anne');
	t.is(chrome.storage.local.set.callCount, 0);
	t.is(spy.callCount, 0);
});

test.serial('function() with empty cache and staleWhileRevalidate', async t => {
	const maxAge = cache.days(1);
	const staleWhileRevalidate = cache.days(29);

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy, {
		maxAge,
		staleWhileRevalidate
	});

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:@anne');
	t.is(chrome.storage.local.set.callCount, 1);
	const arguments_ = chrome.storage.local.set.lastCall.args[0];
	t.deepEqual(Object.keys(arguments_), ['cache:@anne']);
	t.is(arguments_['cache:@anne'].data, 'ANNE');

	const expectedExpiration = maxAge + staleWhileRevalidate;
	t.true(arguments_['cache:@anne'].maxAge > millisecondsFromNow(expectedExpiration - cache.days(0.5)));
	t.true(arguments_['cache:@anne'].maxAge < millisecondsFromNow(expectedExpiration + cache.days(0.5)));
});

test.serial('function() with fresh cache and staleWhileRevalidate', async t => {
	createCache(30, {
		'cache:@anne': 'ANNE'
	});

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy, {
		maxAge: cache.days(1),
		staleWhileRevalidate: cache.days(29)
	});

	t.is(await call('@anne'), 'ANNE');

	// Cache is still fresh, it should be used
	t.is(spy.callCount, 0);
	t.is(chrome.storage.local.set.callCount, 0);

	await new Promise(resolve => setTimeout(resolve, 100));

	// Cache is still fresh, it should never be revalidated
	t.is(spy.callCount, 0);
});

test.serial('function() with stale cache and staleWhileRevalidate', async t => {
	createCache(15, {
		'cache:@anne': 'ANNE'
	});

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy, {
		maxAge: cache.days(1),
		staleWhileRevalidate: cache.days(29)
	});

	t.is(await call('@anne'), 'ANNE');

	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:@anne');
	t.is(chrome.storage.local.set.callCount, 0);

	t.is(spy.callCount, 0, 'It shouldn’t be called yet');

	await new Promise(resolve => setTimeout(resolve, 100));

	t.is(spy.callCount, 1, 'It should be revalidated');
	t.is(chrome.storage.local.set.callCount, 1);
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:@anne'].data, 'ANNE');
});

test.serial('function() varies cache by function argument', async t => {
	createCache(10, {
		'cache:@anne': 'ANNE'
	});

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy);

	t.is(await call('@anne'), 'ANNE');
	t.is(spy.callCount, 0);

	t.is(await call('@mari'), 'MARI');
	t.is(spy.callCount, 1);
});

test.serial('function() ignores second argument by default', async t => {
	createCache(10, {
		'cache:@anne': 'ANNE'
	});

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy);

	await call('@anne', 1);
	await call('@anne', 2);
	t.is(spy.callCount, 0);
});

test.serial('function() accepts custom cache key generator', async t => {
	createCache(10, {
		'cache:@anne,1': 'ANNE,1'
	});

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy, {
		cacheKey: arguments_ => arguments_.join()
	});

	await call('@anne', 1);
	t.is(spy.callCount, 0);

	await call('@anne', 2);
	t.is(spy.callCount, 1);

	t.is(chrome.storage.local.get.firstCall.args[0], 'cache:@anne,1');
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:@anne,2');
});

test.serial('function() verifies cache with shouldRevalidate callback', async t => {
	createCache(10, {
		'cache:@anne': '@anne'
	});

	const spy = sinon.spy(getUsernameDemo);
	const call = cache.function(spy, {
		shouldRevalidate: value => value.startsWith('@')
	});

	t.is(await call('@anne'), 'ANNE');
	t.is(chrome.storage.local.get.lastCall.args[0], 'cache:@anne');
	t.is(chrome.storage.local.set.lastCall.args[0]['cache:@anne'].data, 'ANNE');
	t.is(spy.callCount, 1);
});
