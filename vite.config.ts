import {defineConfig} from 'vitest/config';

export default defineConfig({
	test: {
		setupFiles: [
			'./vitest.setup.js',
		],
		include: [
			'source/**/*.test.ts',
		],
	},
});
