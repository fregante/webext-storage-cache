# webext-storage-cache [![](https://img.shields.io/npm/v/webext-storage-cache.svg)](https://www.npmjs.com/package/webext-storage-cache)

> Cache values in your Web Extension and clear them on expiration. Also includes a memoize-like API to cache any function results automatically.

- Browsers: Chrome, Firefox, and Safari
- Manifest: v2 and v3
- Context: They can be called from any context that has access to the `chrome.storage` APIs
- Permissions: (with attached "reasons" for submission to the Chrome Web Store)
	- `storage`: "The extension caches some values into the local storage"
	- `alarms`: "The extension automatically clears its expired storage at certain intervals"

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
import {CachedValue} from 'webext-storage-cache';

const item = new CachedValue('unique', {
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

The same code could also be written more effectively with `CachedFunction`:

```js
import {CachedFunction} from 'webext-storage-cache';

const cachedFunction = new CachedFunction('unique', {
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

- [CachedValue](./source/cached-value.md) - A simple API getter/setter
- [CachedFunction](./source/cached-function.md) - A memoize-like API to cache your function calls without manually calling `isCached`/`get`/`set`
- `globalCache` - Global helpers, documented below
- `legacy` - The previous Map-like API, documented below, deprecated

### globalCache.clear()

Clears the cache. This is a special method that acts on the entire cache of the extension.

```js
import {globalCache} from 'webext-storage-cache';

document.querySelector('.options .clear-cache').addEventListener('click', async () => {
	await globalCache.clear()
})
```

### legacy API

The API used until v5 has been deprecated and you should migrate to:

- `CachedValue` for simple `cache.get`/`cache.set` calls. This API makes more sense in a typed context because the type is preserved/enforced across calls.
- `CachedFunction` for `cache.function`. It behaves in a similar fashion, but it also has extra methods like `getCached` and `getFresh`

You can:

- [Migrate from v5 to v6](https://github.com/fregante/webext-storage-cache/releases/v6.0.0), or
- Keep using the legacy API (except `cache.function`) by importing `webext-storage-cache/legacy.js` (until v7 is published)

```js
import cache from "webext-storage-cache/legacy.js";

await cache.get('my-url');
await cache.set('my-url', 'https://example.com');
```

The documentation for the legacy API can be found on the [v5 version of this readme](https://github.com/fregante/webext-storage-cache/blob/v5.1.1/readme.md#api).

## Related

- [webext-detect-page](https://github.com/fregante/webext-detect-page) - Detects where the current browser extension code is being run.
- [webext-options-sync](https://github.com/fregante/webext-options-sync) - Helps you manage and autosave your extension's options.
- [webext-base-css](https://github.com/fregante/webext-base-css) - Extremely minimal stylesheet/setup for Web Extensions’ options pages (also dark mode)
- [webext-dynamic-content-scripts](https://github.com/fregante/webext-dynamic-content-scripts) - Automatically registers your content_scripts on domains added via permission.request
- [More…](https://github.com/fregante/webext-fun)

## License

MIT © [Federico Brigante](https://fregante.com)
