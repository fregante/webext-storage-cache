import {
	beforeEach,
	test,
} from 'node:test';
import CachedMap from './cached-map.ts';
import {
	calledWith,
	createCache,
	resetMocks,
	timeInTheFuture,
} from './testing-utils.js';

const storage = chrome.storage.local;
const testMap = new CachedMap('users');

beforeEach(() => {
	resetMocks();
	createCache(30, {});
});

test('get() with empty cache', async t => {
	t.assert.strictEqual(await testMap.get('sindresorhus'), undefined);
});

test('get() with cache', async t => {
	createCache(10, {
		'cache:users:sindresorhus': 'Rico',
	});

	t.assert.strictEqual(await testMap.get('sindresorhus'), 'Rico');
	t.assert.ok(calledWith(storage.get, 'cache:users:sindresorhus'));
});

test('get() with expired cache', async t => {
	createCache(-10, {
		'cache:users:sindresorhus': 'Rico',
	});

	t.assert.strictEqual(await testMap.get('sindresorhus'), undefined);
});

test('has() with empty cache', async t => {
	t.assert.strictEqual(await testMap.has('sindresorhus'), false);
});

test('has() with cache', async t => {
	createCache(10, {
		'cache:users:sindresorhus': 'Rico',
	});

	t.assert.strictEqual(await testMap.has('sindresorhus'), true);
});

test('has() with expired cache', async t => {
	createCache(-10, {
		'cache:users:sindresorhus': 'Rico',
	});

	t.assert.strictEqual(await testMap.has('sindresorhus'), false);
});

test('set() without a value', async t => {
	await t.assert.rejects(testMap.set('sindresorhus'), {
		name: 'TypeError',
		message: 'Expected a value to be stored',
	});
});

test('set() with undefined', async t => {
	await testMap.set('sindresorhus', 'Anne');
	t.assert.strictEqual(await testMap.has('sindresorhus'), true);

	await testMap.set('sindresorhus', undefined);
	t.assert.strictEqual(await testMap.has('sindresorhus'), true);
});

test('set() with value', async t => {
	const maxAge = 20;
	const customLimitMap = new CachedMap('users', {maxAge: {days: maxAge}});

	await customLimitMap.set('sindresorhus', 'Anne');

	const argument = storage.set.mock.calls[0].arguments[0];

	t.assert.deepStrictEqual(Object.keys(argument), ['cache:users:sindresorhus']);
	t.assert.strictEqual(argument['cache:users:sindresorhus'].data, 'Anne');
	t.assert.ok(argument['cache:users:sindresorhus'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	t.assert.ok(argument['cache:users:sindresorhus'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});

test('delete() removes item', async t => {
	await testMap.set('sindresorhus', 'Anne');
	t.assert.strictEqual(await testMap.has('sindresorhus'), true);

	await testMap.delete('sindresorhus');
	t.assert.strictEqual(await testMap.has('sindresorhus'), false);
});
