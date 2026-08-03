import {isBackground} from 'webext-detect';
import {clear, init} from './legacy.js';

export {default as CachedValue} from './cached-value.js';
export {default as CachedFunction} from './cached-function.js';

export const globalCache = {
	clear,
};

// Automatically clear expired entries every day
if (isBackground()) {
	init();
}
