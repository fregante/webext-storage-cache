# webext-storage-cache

> WebExtensions module: Map-like promised cache storage with expiration. Chrome and Firefox.

[![Travis build status](https://api.travis-ci.com/bfred-it/webext-storage-cache.svg?branch=master)](https://travis-ci.com/bfred-it/webext-storage-cache)
[![npm version](https://img.shields.io/npm/v/webext-storage-cache.svg)](https://www.npmjs.com/package/webext-storage-cache)

This module works on content scripts, background pages and option pages.

## Install

You can just include the file `webext-storage-cache.js` in your `manifest.json`, or:

```sh
npm install --save webext-storage-cache
```

```js
import storageCache from 'webext-storage-cache';
```

```js
const storageCache = require('webext-storage-cache');
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

## API

Similar to a `Map()`, but all methods a return a `Promise`.

### cache.has(key)

Checks if the given key is in the cache, returns a `boolean`.

### key

Type: `string`

### cache.get(key)

Returns the cached value of key if it exists and hasn't expired, returns `undefined` otherwise.

### key

Type: `string`

### cache.set(key, value, expiration /* in days */)

Caches the given key and value for a given amount of days.

### key

Type: `string`

### value

Type: `string | number | array | regex | object | date`

Any value allowed by [`StorageArea#set`](https://developer.chrome.com/extensions/storage#method-StorageArea-set)

### expiration

The number of days after which the cache item will expire.

Type: `number`
Default: 30

### cache.delete(key)

Deletes the requested item from the cache.

### key

Type: `string`

## Related

* [`webext-options-sync`](https://github.com/bfred-it/webext-options-sync): Helps you manage and autosave your extension's options.
* [`webext-detect-page`](https://github.com/bfred-it/webext-detect-page): Detects where the current browser extension code is being run.
* [`webext-dynamic-content-scripts`](https://github.com/bfred-it/webext-dynamic-content-scripts): Automatically inject your `content_scripts` on custom domains.
* [`webext-content-script-ping`](https://github.com/bfred-it/webext-content-script-ping): One-file interface to detect whether your content scripts have loaded.
* [`webext-domain-permission-toggle`](https://github.com/bfred-it/webext-domain-permission-toggle): Browser-action context menu to request permission for the current tab.
* [`Awesome WebExtensions`](https://github.com/bfred-it/Awesome-WebExtensions): A curated list of awesome resources for Web Extensions development.

## License

MIT © Federico Brigante — [Twitter](http://twitter.com/bfred_it), Connor Love
