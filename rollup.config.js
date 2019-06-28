import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import typescript from 'rollup-plugin-typescript';

export default {
	input: 'source/index.ts',
	output: {
		file: 'webext-storage-cache.js',
		format: 'iife',
		name: 'storageCache'
	},
	plugins: [
		resolve(),
		typescript(),
		commonjs()
	]
};
