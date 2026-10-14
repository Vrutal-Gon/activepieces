/**
 * ==========================================================================
 * VRUTAL LABS
 * CORE · NAVIGATION
 * Version: 1.0.0
 * ==========================================================================
 */

class VrutalNavigation {

	constructor() {

		this.header = document.getElementById('site-header');

		if (!this.header) {
			return;
		}

		this.lastScroll = 0;

		this.init();

	}

	init() {

		this.updateHeader();

		window.addEventListener(
			'scroll',
			() => this.onScroll(),
			{ passive: true }
		);

		window.addEventListener(
			'resize',
			() => this.updateHeader(),
			{ passive: true }
		);

	}

	onScroll() {

		this.lastScroll = window.scrollY;

		this.updateHeader();

	}

	updateHeader() {

		if (this.lastScroll > 40) {

			this.header.classList.add('is-scrolled');

		} else {

			this.header.classList.remove('is-scrolled');

		}

	}

}

document.addEventListener('DOMContentLoaded', () => {

	new VrutalNavigation();

});