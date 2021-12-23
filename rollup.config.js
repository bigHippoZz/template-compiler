import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';
import { terser } from 'rollup-plugin-terser';

const __DEV__ = process.env.NODE_ENV !== 'production';

const extensions = ['.js', '.ts'];

const plugins = [
	resolve({
		extensions,
	}),
	commonjs(),
	babel({
		extensions,
		exclude: 'node_modules/**',
		skipPreflightCheck: true,
		babelHelpers: 'bundled',
	}),
	__DEV__ && livereload(),
	__DEV__ &&
		serve({
			open: true,
			port: 8888,
		}),
	!__DEV__ && terser(),
];

export default {
	input: 'src/main.ts',
	output: { file: 'dist/template.js', sourcemap: true, format: 'es', indent: false },
	plugins,
};
