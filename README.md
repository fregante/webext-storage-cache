# webext-storage-cache
Externalized from https://github.com/sindresorhus/refined-github/pull/2109

## Install

```shell
$ yarn add webext-storage-cache
```

## Requirements
This module requires [`webextension-polyfill`](https://github.com/mozilla/webextension-polyfill) and the `storage` permission:

```json
# manifest.json
{
  "permissions": [
    "storage"
  ],
  "background": {
    "scripts": [
      "browser-polyfill.min.js"
    ],
  },
  "content_scripts": [
    {
      "js": [
        "browser-polyfill.min.js"
      ]
    }
  ]
}
```

## Usage

```js
import cache from 'webext-storage-cache';

(async () => {
  let cachableItem = await cache.get('unique');
  if (cacheableItem === undefined) {
    cachableItem = await someFunction();
    await cache.set('unique', cachableItem, 3 /* days */);
  }
  console.log(cachableItem);
})();
```

## API
All methods a return a `Promise`
### cache.get(key)
Returns the cached value of key if it exists and hasn't expired, returns `undefined` otherwise.

### cache.has(key)
Checks if the given key is in the cache, returns a `boolean`.

### cache.set(key, value, expiration)
Caches the given key and value for a given amount of days.
