import cache from './legacy.js';

export {default as CachedValue} from './cached-value.js';
export {default as CachedFunction} from './cached-function.js';

export const globalCache = {
	clear: cache.clear,
};
