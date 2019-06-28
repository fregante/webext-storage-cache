import typescript from 'rollup-plugin-typescript';

export default {
	input: 'source/index.ts',
	output: {
		file: 'webext-storage-cache.js',
		format: 'iife',

		// Add globals to `window`
		name: 'window',
		extend: true
	},
	plugins: [
		typescript()
	]
};
