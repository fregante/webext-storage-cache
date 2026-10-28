import {isBackground} from 'webext-detect';
import {deleteWithLogic as clear, init} from './shared.ts';

export {default as CachedValue} from './cached-value.ts';
export {default as CachedFunction} from './cached-function.ts';

export const globalCache = {
	clear,
};

// Automatically clear expired entries every day
if (isBackground()) {
	init();
}
