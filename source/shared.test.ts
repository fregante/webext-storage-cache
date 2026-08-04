import {
	beforeEach,
	describe,
	expect,
	it,
	vi,
} from 'vitest';
// @ts-expect-error untyped
import {createCache} from './test-utils.js';
import {
	timeInTheFuture,
	readItem,
	writeItem,
	deleteItem,
	has,
	deleteExpired,
	deleteWithLogic as clear,
} from './shared.js';

vi.mock('@sindresorhus/to-milliseconds', () => ({
	default: vi.fn(() => 1000),
}));

beforeEach(() => {
	vi.resetAllMocks();
	// eslint-disable-next-line @typescript-eslint/no-unsafe-call -- untyped
	createCache(30, {});
});

type MockedStorage = {
	[K in keyof typeof chrome.storage.local]:
		typeof chrome.storage.local[K] extends (...args: any[]) => any
			? ReturnType<typeof vi.fn>
			: typeof chrome.storage.local[K];
};

const storage = chrome.storage.local as MockedStorage;

describe('timeInTheFuture()', () => {
	it('returns the current time plus the duration', () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		expect(timeInTheFuture({seconds: 1})).toBe(2000);
	});
});

describe('readItem()', () => {
	it('returns a cached item', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: 'bar',
				maxAge: 2000,
			},
		});

		await expect(readItem('foo')).resolves.toEqual({
			data: 'bar',
			maxAge: 2000,
		});

		expect(storage.get).toHaveBeenCalledWith('cache:foo');
	});

	it('returns the item when it expires exactly now', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: 'bar',
				maxAge: 1000,
			},
		});

		await expect(readItem('foo')).resolves.toEqual({
			data: 'bar',
			maxAge: 1000,
		});
	});

	it('returns undefined when the item is expired', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(2000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: 'bar',
				maxAge: 1000,
			},
		});

		await expect(readItem('foo')).resolves.toBeUndefined();
	});

	it('returns undefined when the item does not exist', async () => {
		storage.get.mockResolvedValue({});

		await expect(readItem('foo')).resolves.toBeUndefined();
	});
});

describe('writeItem()', () => {
	it('stores a value and returns it', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		const value = {hello: 'world'};

		await expect(writeItem('foo', value, {seconds: 1})).resolves.toBe(value);

		expect(storage.set).toHaveBeenCalledWith({
			'cache:foo': {
				data: value,
				maxAge: 2000,
			},
		});
	});
});

describe('deleteItem()', () => {
	it('removes the cache entry', async () => {
		await deleteItem('foo');

		expect(storage.remove).toHaveBeenCalledWith('cache:foo');
	});
});

describe('has()', () => {
	it('returns true when the item exists', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: true,
				maxAge: 2000,
			},
		});

		await expect(has('foo')).resolves.toBe(true);
	});

	it('returns false when the item is expired', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(2000);

		storage.get.mockResolvedValue({
			'cache:foo': {
				data: true,
				maxAge: 1000,
			},
		});

		await expect(has('foo')).resolves.toBe(false);
	});
});

describe('deleteExpired()', () => {
	it('removes only expired cache entries', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.getKeys.mockResolvedValue([
			'cache:expired',
			'cache:fresh',
			'other',
		]);

		storage.get.mockResolvedValue({
			'cache:expired': {
				data: 1,
				maxAge: 999,
			},
			'cache:fresh': {
				data: 2,
				maxAge: 1001,
			},
		});

		await deleteExpired();

		expect(storage.remove).toHaveBeenCalledWith(['cache:expired']);
	});

	it('does nothing when there are no expired cache entries', async () => {
		vi.spyOn(Date, 'now').mockReturnValue(1000);

		storage.getKeys.mockResolvedValue([
			'cache:fresh',
			'other',
		]);

		storage.get.mockResolvedValue({
			'cache:fresh': {
				data: 1,
				maxAge: 2000,
			},
		});

		await deleteExpired();

		expect(storage.remove).not.toHaveBeenCalled();
	});

	it('does nothing when storage is empty', async () => {
		storage.getKeys.mockResolvedValue([]);

		await deleteExpired();

		expect(storage.remove).not.toHaveBeenCalled();
	});
});

describe('clear()', () => {
	it('removes every cache entry', async () => {
		storage.getKeys.mockResolvedValue([
			'cache:a',
			'cache:b',
			'other',
		]);

		storage.get.mockResolvedValue({
			'cache:a': {},
			'cache:b': {},
		});

		await clear();

		expect(storage.remove).toHaveBeenCalledWith([
			'cache:a',
			'cache:b',
		]);
	});

	it('does nothing when there are no cache entries', async () => {
		storage.getKeys.mockResolvedValue(['other']);

		await clear();

		expect(storage.remove).not.toHaveBeenCalled();
	});

	it('does nothing when storage is completely empty', async () => {
		storage.getKeys.mockResolvedValue([]);

		await clear();

		expect(storage.remove).not.toHaveBeenCalled();
	});
});
