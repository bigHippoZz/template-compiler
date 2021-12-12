import typescript from "rollup-plugin-typescript2";
import { getBabelOutputPlugin } from "@rollup/plugin-babel";
import resolve from "@rollup/plugin-node-resolve";
import serve from "rollup-plugin-serve";
import commonjs from "@rollup/plugin-commonjs";
import livereload from "rollup-plugin-livereload";
export default {
	input: "src/main.ts",
	output: { file: "dist/template.js", format: "esm", sourcemap: true },
	plugins: [
		resolve(),
		commonjs({ browser: true }),
		typescript({
			tsconfigOverride: { compilerOptions: { declaration: false } },
		}),
		getBabelOutputPlugin({
			presets: [["@babel/preset-env", { modules: false }]],
		}),
		livereload(),
		serve({
			open: true,
			port: 8888,
			contentBase: "",
		}),
	],
};
