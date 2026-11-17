const { test, assert, vm, ts, read, load, mainFunction } = require('./helpers.cjs');

test('minimize dispatches the action used by the actual v3 title bar', () => {
	const actions = [];
	const store = { getState() {}, subscribe() {}, dispatch: (action) => actions.push(action) };
	const { dispatchNCMAction } = load('src/ncm-compat.js', {
		document: { getElementById: () => ({
			_reactRootContainer: { _internalRoot: { current: { child: { child: { memoizedProps: { store } } } } } },
		}) },
	});
	const minimize = mainFunction('triggerNativeWindowAction', {
		dispatchNCMAction,
		getNativeWindowControlButton: () => assert.fail('Must work without the legacy .m-winctrl element'),
	});
	assert.equal(minimize('minimize'), true);
	assert.equal(actions.length, 1);
	assert.equal(actions[0].type, 'app/minimizeWindow');
});

test('window tool sync retains and binds minimize exactly once', () => {
	const buttons = new Map();
	const makeButton = (className) => {
		const handlers = [];
		return { className, dataset: {}, handlers, setAttribute() {},
			addEventListener: (_, handler) => handlers.push(handler),
			remove: () => buttons.delete(className),
		};
	};
	for (const name of ['minimize', 'maximize', 'close', 'fullscreen', 'plugin-close']) {
		buttons.set(`.rnp-window-tool-${name}`, makeButton(`.rnp-window-tool-${name}`));
	}
	const tools = { querySelector: (selector) => buttons.get(selector) };
	const view = {
		querySelector: (selector) => selector === '.rnp-window-tools' ? tools : buttons.get(selector),
		querySelectorAll: (selectors) => selectors.split(', ').map((key) => buttons.get(key)).filter(Boolean),
	};
	let action;
	const sync = mainFunction('syncRnpPageWindowTools', {
		suppressEventAndBlur() {}, triggerNativeWindowAction: (next) => { action = next; },
	});
	sync(view);
	sync(view);
	const minimize = buttons.get('.rnp-window-tool-minimize');
	assert.ok(minimize);
	assert.equal(minimize.handlers.length, 1);
	minimize.handlers[0]({});
	assert.equal(action, 'minimize');
});
