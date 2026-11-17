const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

test('rapid track changes cancel images and ignore late callbacks', () => {
	const images = new Set();
	class FakeImage {
		naturalWidth = 100;
		constructor() { images.add(this); }
		removeAttribute() { images.delete(this); }
	}
	const { loadBackgroundImage } = load('src/background-image.js', { Image: FakeImage });
	let draws = 0;
	for (let i = 0; i < 2000; i++) {
		const dispose = loadBackgroundImage(`cover-${i}`, () => draws++);
		const image = [...images][0];
		const lateCallback = image.onload;
		dispose();
		lateCallback();
		assert.equal(image.onload, null);
		assert.equal(image.onerror, null);
	}
	assert.equal(draws, 0);
	assert.equal(images.size, 0);
	loadBackgroundImage('current', () => draws++);
	[...images][0].onload();
	assert.equal(draws, 1);
	assert.equal(images.size, 0);
});

test('fluid background releases canvases, animation frames and native listeners on unmount', () => {
	const effects = [], canvases = [], callbacks = new Set(), frames = new Set();
	let frameId = 0;
	const React = {
		useState: (value) => [value, () => {}],
		useRef: (value) => ({ current: value }),
		useEffect: (effect) => effects.push(effect),
		useCallback: (callback) => callback,
		createElement: (tag, props) => {
			const element = { style: {}, classList: { toggle() {} }, setAttribute() {},
				getContext: () => ({ drawImage() {} }), width: 100, height: 100 };
			if (props?.ref) props.ref.current = element;
			if (tag === 'canvas') canvases.push(element);
			return element;
		},
	};
	const exports = {};
	const source = read('src/background.js') + '\nexport { FluidBackground };';
	const { outputText } = ts.transpileModule(source, { fileName: 'background.jsx', compilerOptions: {
		module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020, jsx: ts.JsxEmit.React,
	} });
	const listeners = new Set();
	vm.runInNewContext(outputText, { exports, React, console,
		loadedPlugins: { LibFrontendPlay: { currentAudioAnalyser: { getFloatFrequencyData() {} } } },
		requestAnimationFrame: () => { frames.add(++frameId); return frameId; },
		cancelAnimationFrame: (id) => frames.delete(id),
		document: { body: { getBoundingClientRect: () => ({ width: 1280, height: 720 }) } },
		window: { addEventListener: (_, callback) => listeners.add(callback), removeEventListener: (_, callback) => listeners.delete(callback) },
		require: (name) => {
			if (name === 'colorthief') return { default: class {} };
			if (name.includes('rnp-page-state')) return { useRnpLyricPageOpen: () => true };
			if (name.includes('background-image')) return { loadBackgroundImage: () => () => {} };
			if (name.includes('ncm-compat')) return {
				isPlayerPlaying: () => true,
				appendRegisterCall: (_, __, callback) => callbacks.add(callback),
				removeRegisterCall: (_, __, callback) => callbacks.delete(callback),
			};
			return {};
		},
	});
	for (let cycle = 0; cycle < 100; cycle++) {
		exports.FluidBackground({ url: `cover-${cycle}`, static: false });
		const cleanups = effects.splice(0).map((effect) => effect()).filter((cleanup) => typeof cleanup === 'function');
		assert.equal(frames.size, 1);
		cleanups.reverse().forEach((cleanup) => cleanup());
		assert.equal(frames.size, 0);
		assert.equal(callbacks.size, 0);
		assert.equal(listeners.size, 0);
	}
	assert.ok(canvases.every((canvas) => canvas.width === 0 && canvas.height === 0));
});
