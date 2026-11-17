// Cancel obsolete loads when switching tracks or leaving the lyric page.
export const loadBackgroundImage = (url, onLoad) => {
	if (!url) return () => {};
	const image = new Image();
	let disposed = false;
	const release = () => {
		image.onload = null;
		image.onerror = null;
		image.removeAttribute('src');
	};
	image.crossOrigin = 'Anonymous';
	image.onload = () => {
		try {
			if (!disposed && image.naturalWidth > 0) onLoad(image);
		} catch (error) {
			console.debug('Failed to draw background image', error);
		} finally {
			release();
		}
	};
	image.onerror = release;
	image.src = url;
	return () => {
		disposed = true;
		release();
	};
};
