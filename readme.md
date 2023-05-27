# webext-storage-cache [![](https://img.shields.io/npm/v/webext-storage-cache.svg)](https://www.npmjs.com/package/webext-storage-cache)

> Map-like promised cache storage with expiration. WebExtensions module for Chrome, Firefox, Safari

This module works on content scripts, background pages and option pages.

## Install

You can download the [standalone bundle](https://bundle.fregante.com/?pkg=webext-storage-cache&global=window) and include it in your `manifest.json`.

Or use `npm`:

```sh
npm install webext-storage-cache
```

## Usage

This module requires the `storage` permission and it’s suggested to also use `alarms` to safely schedule cache purging:

```json5
/* manifest.json */
{
	"permissions": [
		"storage",
		"alarms"
	],
	"background": {
		"scripts": [
			/* Remember to include/import it in the background to enable expired cache purging */
			"webext-storage-cache.js"
		]
	}
}
```

```js
import {CacheItem} from 'webext-storage-cache';

const item = new CacheItem('unique', {
	maxAge: {
		days: 3,
	},
});

(async () => {
	if (!(await item.isCached())) {
		const cachableItem = await someFunction();
		await item.set(cachableItem);
	}

	console.log(await item.get());
})();
```

The same code could also be written more effectively with `UpdatableCacheItem`:

```js
import {UpdatableCacheItem} from 'webext-storage-cache';

const item = new CacheItem('unique', {
	updater: someFunction,
	maxAge: {
		days: 3,
	},
});

(async () => {
	console.log(await cachedFunction());
})();
```

## API

### new CacheItem(key, options)

This class lets you manage a specific value in the cache, preserving its type if you're using TypeScript

```js
import {CacheItem} from 'webext-storage-cache';

const url = new CacheItem('cached-url');

// Or in TypeScript
const url = new CacheItem<string>('cached-url');
```

> **Note**:
> The name is unique but `webext-storage-cache` doesn't save you from bad usage. Avoid reusing the same key across the extension with different values, because it will cause conflicts:

```ts
const starNames = new CacheItem<string[]>('stars', {days: 1});
const starCount = new CacheItem<number>('stars'); // Bad: they will override each other
```

#### key

Type: string

The unique name that will be used in `chrome.storage.local` as `cache:${key}`

#### options

##### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after being each `.set()` call.

### CacheItem#get()

Returns the cached value of key if it exists and hasn't expired, returns `undefined` otherwise.

```js
const cache = new CacheItem('cached-url');
const url = await cache.get();
// It will be `undefined` if it's not found.
```

### CacheItem#set(value)

Caches the value for the amount of time specified in the `CacheItem` constructor. It returns the value itself.

```js
const cache = new CacheItem('core-info');
const info = await getInfoObject();
await cache.set(info); // Cached for 30 days by default
```

#### value

Type: `string | number | boolean` or `array | object` of those three types.

`undefined` will remove the cached item. For this purpose it's best to use [`CacheItem#delete()`](#cacheitem-delete) instead

### CacheItem#isCached()

Checks whether the item is in the cache, returns a `boolean`.

```js
const url = new CacheItem('url');
const isCached = await url.isCached();
// true or false
```

### CacheItem.delete()

Deletes the requested item from the cache.

```js
const url = new CacheItem('url');

await url.set('https://github.com');
console.log(await url.isCached()); // true

await url.delete();
console.log(await url.isCached()); // false
```

### UpdatableCacheItem(key, options)

You can think of `UpdatableCacheItem` as an advanced "memoize" function that you can call with any arguments, but also:

- verify whether a specific set of arguments is cached (`.isCached()`)
- only get the cached value if it exists (`.getCached()`)
- only get the fresh value, skipping the cache (but still caching the result) (`.getFresh()`)
- delete a cached value (`.delete()`)

#### key

Type: string

The unique name that will be used in `chrome.storage.local` combined with the function arguments, like `cache:${key}:{arguments}`.

For example, these two calls:

```js
const pages = new UpdatableCacheItem('pages', {updater: fetchText});

await pages.get();
await pages.get('./contacts');
await pages.get('./about', 2);
```

Will create two items in the cache:

```json
{
	"cache:pages": "You're on the homepage",
	"cache:pages:[\"./contacts\"]": "You're on the contacts page",
	"cache:pages:[\"./about\",2]": "You're on the about page"
}
```

#### options

##### updater

Required. <br>
Type: `async function` that returns a cacheable value.

Returning `undefined` will delete the item from the cache.

##### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire after being each `.set()` call.

##### staleWhileRevalidate

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 0}` (disabled)

Specifies how much longer an item should be kept in cache after its expiration. During this extra time, the item will still be served from cache instantly, but `updater` will be also called asynchronously to update the cache. A later call will return the updated and fresher item.

```js
const operate = new UpdatableCacheItem('posts', {
	updater: operate,
	maxAge: {
		days: 10,
	},
	staleWhileRevalidate: {
		days: 2,
	},
});

await operate.get(); // It will run `operate` and cache it for 10 days
await operate.get(); // It will return the cache

/* 3 days later, cache is expired, but still there */

await operate.get(); // It will return the cache
// Asynchronously, it will also run `operate` and cache the new value for 10 more days

/* 13 days later, cache is expired and deleted */

await operate.get(); // It will run `operate` and cache it for 10 days
```

##### shouldRevalidate

Type: `(cachedValue) => boolean`<br>
Default: `() => false`

You may want to have additional checks on the cached value, for example after updating its format.

```js
async function getContent(url) {
	const response = await fetch(url);
	return response.json(); // For example, you used to return plain text, now you return a JSON object
}

const content = new UpdatableCacheItem('content', {
	updater: getContent,

	// If it's a string, it's in the old format and a new value will be fetched and cached
	shouldRevalidate: cachedValue => typeof cachedValue === 'string',
});

const json = await content.get('https://google.com');
// Even if it's cached as a regular string, the cache will be discarded and `getContent` will be called again
```

##### cacheKey

Type: `(args: any[]) => string`
Default: `JSON.stringify`

By default, the function’s `arguments` JSON-stringified array will be used to create the cache key.

```js
const posts = new UpdatableCacheItem('posts', {updater: fetchPosts});
const user = {id: 123, name: 'Fregante'};
await posts.get(user);
// Its result will be stored in the key 'cache:fetchPosts:[{"id":123,name:"Fregante"}]'
```

You can pass a `cacheKey` function to customize how the key is generated, saving storage and making it more sensible:

```js
const posts = new UpdatableCacheItem('posts', {
	updater: fetchPosts,
	cacheKey: (args) => args[0].id, // ✅ Use only the user ID
});

const user = {id: 123, name: 'Fregante'};
await posts.get(user);
// Its result will be stored in the key 'cache:fetchPosts:123'
```

### globalCache.clear()

Clears the cache. This is a special method that acts on the entire cache of the extension.

```js
import {globalCache} from 'webext-storage-cache';

document.querySelector('.options .clear-cache').addEventListener('click', async () => {
	await globalCache.clear()
})
```

## Related

- [webext-detect-page](https://github.com/fregante/webext-detect-page) - Detects where the current browser extension code is being run.
- [webext-options-sync](https://github.com/fregante/webext-options-sync) - Helps you manage and autosave your extension's options.
- [webext-base-css](https://github.com/fregante/webext-base-css) - Extremely minimal stylesheet/setup for Web Extensions’ options pages (also dark mode)
- [webext-dynamic-content-scripts](https://github.com/fregante/webext-dynamic-content-scripts) - Automatically registers your content_scripts on domains added via permission.request
- [More…](https://github.com/fregante/webext-fun)

## License

MIT © [Federico Brigante](https://fregante.com)
