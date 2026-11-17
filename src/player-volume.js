// Keep the native slider, its persisted setting and the lyric page on one value.
export const normalizeVolumeValue = (value) => {
	if ((typeof value !== 'number' && typeof value !== 'string') || String(value).trim() === '') return null;
	const number = Number(value);
	if (!Number.isFinite(number) || number < 0 || number > 100) return null;
	return number > 1 ? number / 100 : number;
};

const getNativeVolumeControl = () => {
	const slider = document.querySelector([
		'footer [class*="volume" i] [role="slider"]',
		'footer [class*="volume" i] input[type="range"]',
		'footer .right [role="slider"]',
		'footer .right input[type="range"]',
		'[class*="volume" i][class*="popover" i] [role="slider"]',
	].join(','));
	if (!slider) return null;
	const key = Object.keys(slider).find((key) => key.startsWith('__reactFiber$') || key.startsWith('__reactInternalInstance$'));
	for (let fiber = slider[key], depth = 0; fiber && depth < 12; fiber = fiber.return, depth++) {
		const props = fiber.memoizedProps;
		if (typeof props?.onChange === 'function' && typeof props.value === 'number' && !props.type) {
			return { slider, props };
		}
	}
	return { slider, props: null };
};

const getVolumeMax = ({ slider, props }) => Number(
	slider.getAttribute('aria-valuemax') ?? (slider.max || null) ?? props?.max ?? 1
) || 1;

export const getCurrentVolumeFromPlayer = () => {
	const control = getNativeVolumeControl();
	if (control) {
		const { slider, props } = control;
		const rawValue = slider.getAttribute('aria-valuenow') ?? slider.value ?? props?.value;
		const max = getVolumeMax(control);
		const value = Number(rawValue);
		if (rawValue !== null && rawValue !== undefined && Number.isFinite(value) && max > 0) {
			return Math.min(1, Math.max(0, value / max));
		}
	}
	try {
		const settings = JSON.parse(localStorage.getItem('NM_SETTING_PLAYER') || '{}');
		return [settings?.volume, settings?.vol, settings?.volumeValue]
			.map(normalizeVolumeValue).find((value) => value !== null) ?? null;
	} catch {
		return null;
	}
};

export const getVolumeFromEventArgs = (...args) => {
	for (const arg of [...args].reverse()) {
		if (arg && typeof arg === 'object') {
			const value = [arg.volume, arg.vol, arg.value, arg.currentVolume, arg.detail]
				.map(normalizeVolumeValue).find((value) => value !== null);
			if (value !== undefined) return value;
		} else {
			const value = normalizeVolumeValue(arg);
			if (value !== null) return value;
		}
	}
	return null;
};

export const setPlayerVolume = (value) => {
	const volume = Math.min(1, Math.max(0, Number(value) || 0));
	const control = getNativeVolumeControl();
	if (control?.props) {
		const { props } = control;
		props.onChange(volume * getVolumeMax(control));
	} else if (control?.slider.tagName === 'INPUT') {
		const slider = control.slider;
		const setter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set;
		setter.call(slider, String(volume * getVolumeMax(control)));
		slider.dispatchEvent(new Event('input', { bubbles: true }));
		slider.dispatchEvent(new Event('change', { bubbles: true }));
	} else {
		const adapter = window.legacyNativeCmder?._envAdapter;
		if (typeof adapter?.callAdapter === 'function') {
			adapter.callAdapter('audioplayer.setVolume', () => {}, ['', '', volume]);
		} else if (typeof channel !== 'undefined' && typeof channel.call === 'function') {
			channel.call('audioplayer.setVolume', () => {}, ['', '', volume]);
		}
	}
	// Same-document localStorage writes do not produce a storage event.
	try {
		const settings = JSON.parse(localStorage.getItem('NM_SETTING_PLAYER') || '{}');
		localStorage.setItem('NM_SETTING_PLAYER', JSON.stringify({ ...settings, volume }));
	} catch (error) {
		console.debug('Failed to persist player volume', error);
	}
	window.dispatchEvent(new CustomEvent('rnp-volume-changed', { detail: volume }));
};
