# webext-storage-cache [![](https://img.shields.io/npm/v/webext-storage-cache.svg)](https://www.npmjs.com/package/webext-storage-cache)

> WebExtensions module: Map-like promised cache storage with expiration. Chrome and Firefox.

This module works on content scripts, background pages and option pages.

## Install

You can just download the [standalone bundle](https://packd.fregante.now.sh/webext-storage-cache@latest?name=storageCache) (it might take a minute to download) and include the file in your `manifest.json`, or:

```sh
npm install --save webext-storage-cache
```

```js
// This module is only offered as a ES Module
import storageCache from 'webext-storage-cache';
```

## Usage

This module requires the `storage` permission:

```json
// manifest.json
{
	"permissions": [
		"storage"
	]
}
```

```js
import cache from 'webext-storage-cache';

(async () => {
	if (!await cache.has('unique')) {
		const cachableItem = await someFunction();
		await cache.set('unique', cachableItem, 3 /* days */);
	}

	console.log(await cache.get('unique'));
})();
```

The same code could be also written more effectively with `cache.function`:

```js
import cache from 'webext-storage-cache';

const cachedFunction = cache.function(someFunction, {
	expiration: 3,
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

#### key

Type: `string`

### cache.get(key)

Returns the cached value of key if it exists and hasn't expired, returns `undefined` otherwise.

#### key

Type: `string`

### cache.set(key, value, expiration /* in days */)

Caches the given key and value for a given amount of days. It returns the value itself.

#### key

Type: `string`

#### value

Type: `string | number | boolean` or `array | object` of those three types

#### expiration

Type: `number`<br>
Default: 30

The number of days after which the cache item will expire.

### cache.delete(key)

Deletes the requested item from the cache.

#### key

Type: `string`

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

##### expiration

Type: `number`<br>
Default: 30

The number of days after which the cache item will expire.

##### isExpired

Type: `function` that returns a boolean<br>
Default: `() => false`

You may want to have additional checks on the cached value, for example after updating its format.

```js
async function getContent(url, options) {
	const response = await fetch(url, options);
	return response.json(); // For example, you used to return plain text, now you return a JSON object
}

const cachedGetContent = cache.function(getContent, {
	// If it's a string, it's in the old format and a new value will be fetched and cached
	isExpired: cachedValue => typeof cachedValue === 'string'
});

const json = await cachedGetHTML('https://google.com', {});
// The HTML of google.com will be saved with the key 'https://google.com'
```

## Related

* [webext-options-sync](https://github.com/fregante/webext-options-sync) - Helps you manage and autosave your extension's options.
* [webext-domain-permission-toggle](https://github.com/fregante/webext-domain-permission-toggle) - Browser-action context menu to request permission for the current tab.
* [webext-dynamic-content-scripts](https://github.com/fregante/webext-dynamic-content-scripts) - Automatically inject your `content_scripts` on custom domains.
* [webext-detect-page](https://github.com/fregante/webext-detect-page) - Detects where the current browser extension code is being run.
* [webext-content-script-ping](https://github.com/fregante/webext-content-script-ping) - One-file interface to detect whether your content script have loaded.
* [`Awesome WebExtensions`](https://github.com/fregante/Awesome-WebExtensions): A curated list of awesome resources for Web Extensions development.

## License

MIT © [Federico Brigante](https://bfred.it)
