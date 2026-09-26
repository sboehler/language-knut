import { defineConfig } from '@vscode/test-cli';

export default defineConfig({
	files: 'out/test/**/*.test.js',
	// The checks shell out to fin and publish asynchronously, which the default
	// two seconds does not always cover on a cold run.
	mocha: { timeout: 20000 },
});
