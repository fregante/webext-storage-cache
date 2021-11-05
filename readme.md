# webext-storage-cache [![](https://img.shields.io/npm/v/webext-storage-cache.svg)](https://www.npmjs.com/package/webext-storage-cache)

> WebExtensions module: Map-like promised cache storage with expiration. Chrome and Firefox.

This module works on content scripts, background pages and option pages.

## Install

You can download the [standalone bundle](https://bundle.fregante.com/?pkg=webext-additional-permissions&global=getAdditionalPermissions) and include it in your `manifest.json`.

Or use `npm`:

```sh
npm install --save webext-storage-cache
```

```js
// This module is only offered as a ES Module
import storageCache from 'webext-storage-cache';
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
import cache from 'webext-storage-cache';

(async () => {
	if (!await cache.has('unique')) {
		const cachableItem = await someFunction();
		await cache.set('unique', cachableItem, {
			days: 3
		});
	}

	console.log(await cache.get('unique'));
})();
```

The same code could also be written more effectively with `cache.function`:

```js
import cache from 'webext-storage-cache';

const cachedFunction = cache.function(someFunction, {
	maxAge: {
		days: 3
	},
	cacheKey: () => 'unique'
});

(async () => {
	console.log(await cachedFunction());
})();
```

## API

Similar to a `Map()`, but **all methods a return a `Promise`.** It also has a memoization method that hides the caching logic and makes it a breeze to use.

### cache.has(key)

Checks if the given key is in the cache, returns a `boolean`.

```js
const isCached = await cache.has('cached-url');
// true or false
```

#### key

Type: `string`

### cache.get(key)

Returns the cached value of key if it exists and hasn't expired, returns `undefined` otherwise.

```js
const url = await cache.get('cached-url');
// It will be `undefined` if it's not found.
```

#### key

Type: `string`

### cache.set(key, value, maxAge)

Caches the given key and value for a given amount of time. It returns the value itself.

```js
const info = await getInfoObject();
await cache.set('core-info', info); // Cached for 30 days by default
```

#### key

Type: `string`

#### value

Type: `string | number | boolean` or `array | object` of those three types.

`undefined` will remove the cached item. For this purpose it's best to use `cache.delete(key)` instead

#### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire.

### cache.delete(key)

Deletes the requested item from the cache.

```js
await cache.delete('cached-url');
```

#### key

Type: `string`

### cache.clear()

Deletes the entire cache.

```js
await cache.clear();
```

### cache.function(getter, options)

Caches the return value of the function based on the `cacheKey`. It works similarly to `lodash.memoize`:

```js
async function getHTML(url, options) {
	const response = await fetch(url, options);
	return response.text();
}

const cachedGetHTML = cache.function(getHTML);

const html = await cachedGetHTML('https://google.com', {});
// The HTML of google.com will be saved with the key 'https://google.com'
```

#### getter

Type: `async function` that returns a cacheable value.

Returning `undefined` will skip the cache, just like `cache.set()`.

#### options

##### cacheKey

Type: `function` that returns a string<br>
Default: `function` that returns the first argument of the call

```js
const cachedOperate = cache.function(operate, {
	cacheKey: args => args.join(',')
});

cachedOperate(1, 2, 3);
// The result of `operate(1, 2, 3)` will be stored in the key '1,2,3'
// Without a custom `cacheKey`, it would be stored in the key '1'
```

##### maxAge

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 30}`

The amount of time after which the cache item will expire.

##### staleWhileRevalidate

Type: [`TimeDescriptor`](https://github.com/sindresorhus/to-milliseconds#input)<br>
Default: `{days: 0}` (disabled)

Specifies how much longer an item should be kept in cache after its expiration. During this extra time, the item will still be served from cache instantly, but `getter` will be also called asynchronously to update the cache. A later call will return the updated and fresher item.

```js
const cachedOperate = cache.function(operate, {
	maxAge: {
		days: 10
	},
	staleWhileRevalidate: {
		days: 2
	}
});

cachedOperate(); // It will run `operate` and cache it for 10 days
cachedOperate(); // It will return the cache

/* 11 days later, cache is expired, but still there */

cachedOperate(); // It will return the cache
// Asynchronously, it will also run `operate` and cache the new value for 10 more days

/* 13 days later, cache is expired and deleted */

cachedOperate(); // It will run `operate` and cache it for 10 days
```

##### shouldRevalidate

Type: `function` that returns a boolean<br>
Default: `() => false`

You may want to have additional checks on the cached value, for example after updating its format.

```js
async function getContent(url) {
	const response = await fetch(url);
	return response.json(); // For example, you used to return plain text, now you return a JSON object
}

const cachedGetContent = cache.function(getContent, {
	// If it's a string, it's in the old format and a new value will be fetched and cached
	shouldRevalidate: cachedValue => typeof cachedValue === 'string'
});

const json = await cachedGetHTML('https://google.com');
// The HTML of google.com will be saved with the key 'https://google.com'
```

## Related

- [webext-detect-page](https://github.com/fregante/webext-detect-page) - Detects where the current browser extension code is being run.
- [webext-dynamic-content-scripts](https://github.com/fregante/webext-dynamic-content-scripts) - Automatically registers your content_scripts on domains added via permission.request
- [webext-options-sync](https://github.com/fregante/webext-options-sync) - Helps you manage and autosave your extension's options.
- [webext-detect-page](https://github.com/fregante/webext-detect-page) - Detects where the current browser extension code is being run.
- [webext-base-css](https://github.com/fregante/webext-base-css) - Extremely minimal stylesheet/setup for Web Extensions’ options pages (also dark mode)
- [More…](https://github.com/fregante/webext-fun)

## License

MIT © [Federico Brigante](https://fregante.com)
