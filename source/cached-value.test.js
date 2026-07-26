import nodeAssert from 'node:assert';
import {
	assert, expect, beforeEach, test, vi,
} from 'vitest';
import toMilliseconds from '@sindresorhus/to-milliseconds';
import CachedValue from './cached-value.ts';

const {storage} = vi.hoisted(() => ({
	storage: {
		get: vi.fn(),
		set: vi.fn(),
		remove: vi.fn(),
	},
}));

vi.mock('webext-polyfill-kinda', () => ({
	default: {
		storage: {
			local: storage,
		},
		alarms: undefined,
	},
}));

vi.mock('webext-detect', () => ({
	isBackground: () => false,
	isExtensionContext: () => false,
}));

function timeInTheFuture(time) {
	return Date.now() + toMilliseconds(time);
}

const testItem = new CachedValue('name');

function createCache(daysFromToday, wholeCache) {
	for (const [key, data] of Object.entries(wholeCache)) {
		storage.get
			.mockResolvedValueOnce({
				[key]: {
					data,
					maxAge: timeInTheFuture({days: daysFromToday}),
				},
			});
	}
}

beforeEach(() => {
	vi.clearAllMocks();
	vi.restoreAllMocks();

	storage.get.mockResolvedValue({});
	storage.set.mockResolvedValue(undefined);
	storage.remove.mockResolvedValue(undefined);
});

test('get() with empty cache', async () => {
	assert.equal(await testItem.get(), undefined);
});

test('get() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});

	assert.equal(await testItem.get(), 'Rico');
	expect(storage.get).toHaveBeenCalledWith('cache:name');
});

test('get() with expired cache', async () => {
	createCache(-10, {
		'cache:name': 'Rico',
	});

	assert.equal(await testItem.get(), undefined);
});

test('isCached() with empty cache', async () => {
	assert.equal(await testItem.isCached(), false);
});

test('isCached() with cache', async () => {
	createCache(10, {
		'cache:name': 'Rico',
	});

	assert.equal(await testItem.isCached(), true);
});

test('isCached() with expired cache', async () => {
	createCache(-10, {
		'cache:name': 'Rico',
	});

	assert.equal(await testItem.isCached(), false);
});

test('set() without a value', async () => {
	await nodeAssert.rejects(testItem.set(), {
		name: 'TypeError',
		message: 'Expected a value to be stored',
	});
});

test.skip('set() with undefined', async () => {
	await testItem.set('Anne');
	assert.equal(await testItem.isCached(), true);

	await testItem.set(undefined);
	assert.equal(await testItem.isCached(), false);
});

test('set() with value', async () => {
	const maxAge = 20;
	const customLimitItem = new CachedValue('name', {maxAge: {days: maxAge}});

	await customLimitItem.set('Anne');

	const argument = storage.set.mock.calls[0][0];

	assert.deepEqual(Object.keys(argument), ['cache:name']);
	assert.equal(argument['cache:name'].data, 'Anne');
	assert.ok(argument['cache:name'].maxAge > timeInTheFuture({days: maxAge - 0.5}));
	assert.ok(argument['cache:name'].maxAge < timeInTheFuture({days: maxAge + 0.5}));
});
