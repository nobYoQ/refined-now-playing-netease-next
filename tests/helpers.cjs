const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const ts = require('typescript');

const read = (file) => fs.readFileSync(path.join(__dirname, '..', file), 'utf8');
const load = (file, globals = {}) => {
	const exports = {};
	const { outputText } = ts.transpileModule(read(file), {
		compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
	});
	vm.runInNewContext(outputText, { exports, console, ...globals }, { filename: file });
	return exports;
};

const mainFunction = (name, globals) => {
	const source = read('src/main.js');
	const start = source.indexOf(`const ${name} = `);
	assert.ok(start >= 0, `${name} exists`);
	const end = source.indexOf('\n};', start) + 3;
	return vm.runInNewContext(`${source.slice(start, end)}\n${name}`, globals);
};

module.exports = { test, assert, vm, ts, read, load, mainFunction };
