import babel from '@rollup/plugin-babel';
import resolve from '@rollup/plugin-node-resolve';
import serve from 'rollup-plugin-serve';
import commonjs from '@rollup/plugin-commonjs';
import livereload from 'rollup-plugin-livereload';

const __DEV__ = process.env.NODE_ENV === 'production';

const extensions = ['.js', '.ts'];
export default {
  input: 'src/main.ts',
  output: { file: 'dist/template.js', sourcemap: true, format: 'es', indent: false },
  plugins: [
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
    livereload(),
    serve({
      open: true,
      port: 8888,
    }),
  ],
};
