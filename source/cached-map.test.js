import nodeAssert from 'node:assert';
import {
	assert,
	expect,
	beforeEach,
	test,
	vi,
} from 'vitest';
import CachedMap from './cached-map.js';
import {
	createCache,
	timeInTheFuture,
} from './test-utils.js';

const storage = chrome.storage.local;
const testMap = new CachedMap('users');

beforeEach(() => {
	vi.resetAllMocks();
	createCache(30, {});
});

test('get() with empty cache', async () => {
	assert.equal(await testMap.get('sindresorhus'), undefined);
});

test('get() with cache', async () => {
	createCache(10, {
		'cache:users:sindresorhus': 'Rico',
	});

	assert.equal(await testMap.get('sindresorhus'), 'Rico');
	expect(storage.get).toHaveBeenCalledWith('cache:users:sindresorhus');
});

test('get() with expired cache', async () => {
	createCache(-10, {
		'cache:users:sindresorhus': 'Rico',
	});

	assert.equal(await testMap.get('sindresorhus'), undefined);
});

test('has() with empty cache', async () => {
	assert.equal(await testMap.has('sindresorhus'), false);
});

test('has() with cache', async () => {
	createCache(10, {
		'cache:users:sindresorhus': 'Rico',
	});

	assert.equal(await testMap.has('sindresorhus'), true);
});

test('has() with expired cache', async () => {
	createCache(-10, {
		'cache:users:sindresorhus': 'Rico',
	});

	assert.equal(await testMap.has('sindresorhus'), false);
});

test('set() without a value', async () => {
	await nodeAssert.rejects(testMap.set('sindresorhus'), {
		name: 'TypeError',
		message: 'Expected a value to be stored',
	});
});

test('set() with undefined', async () => {
	await testMap.set('sindresorhus', 'Anne');
	assert.equal(await testMap.has('sindresorhus'), true);

	await testMap.set('sindresorhus', undefined);
	assert.equal(await testMap.has('sindresorhus'), true);
});

test('set() with value', async () => {
	const maxAge = 20;
	const customLimitMap = new CachedMap('users', {maxAge: {days: maxAge}});

	await customLimitMap.set('sindresorhus', 'Anne');

	const argument = storage.set.mock.calls[0][0];

	assert.deepEqual(Object.keys(argument), ['cache:users:sindresorhus']);
	assert.equal(argument['cache:users:sindresorhus'].data, 'Anne');
	assert.ok(argument['cache:users:sindresorhus'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	assert.ok(argument['cache:users:sindresorhus'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});

test('delete() removes item', async () => {
	await testMap.set('sindresorhus', 'Anne');
	assert.equal(await testMap.has('sindresorhus'), true);

	await testMap.delete('sindresorhus');
	assert.equal(await testMap.has('sindresorhus'), false);
});
