/**
 * ==========================================================================
 * VRUTAL LABS
 * NETWORK ENGINE
 * ==========================================================================
 */

class VrutalNetwork {

	constructor(containerId) {

		this.container = document.getElementById(containerId);

		if (!this.container || typeof THREE === 'undefined') {
			return;
		}

		this.mouse = new THREE.Vector2(999, 999);

		this.nodes = [];
		this.lines = [];

		this.init();

	}

	init() {

		this.scene = new THREE.Scene();

		this.camera = new THREE.PerspectiveCamera(
			45,
			this.container.clientWidth / this.container.clientHeight,
			0.1,
			1000
		);

		this.camera.position.z = 40;

		this.renderer = new THREE.WebGLRenderer({
			alpha: true,
			antialias: true
		});

		this.renderer.setPixelRatio(
			Math.min(window.devicePixelRatio, 2)
		);

		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight
		);

		this.container.appendChild(this.renderer.domElement);

		this.createLights();

		this.createNetwork();

		this.bindEvents();

		this.animate();

	}

	createLights() {

		const ambient = new THREE.AmbientLight(0xffffff, 0.9);

		this.scene.add(ambient);

		const point = new THREE.PointLight(0xff6b00, 2);

		point.position.set(30, 30, 30);

		this.scene.add(point);

	}

	createNetwork() {

		const geometry = new THREE.SphereGeometry(0.12, 10, 10);

		for (let i = 0; i < 90; i++) {

			const material = new THREE.MeshBasicMaterial({

				color: i % 18 === 0 ? 0xff6b00 : 0xffffff

			});

			const node = new THREE.Mesh(
				geometry,
				material
			);

			node.position.set(

				(Math.random() - .5) * 36,

				(Math.random() - .5) * 20,

				(Math.random() - .5) * 12

			);

			node.userData = {

				speedX: (Math.random() - .5) * .01,
				speedY: (Math.random() - .5) * .01,
				speedZ: (Math.random() - .5) * .005

			};

			this.scene.add(node);

			this.nodes.push(node);

		}

	}

	createConnections() {

		this.lines.forEach(line => {

			this.scene.remove(line);

		});

		this.lines = [];

		for (let i = 0; i < this.nodes.length; i++) {

			for (let j = i + 1; j < this.nodes.length; j++) {

				const a = this.nodes[i];
				const b = this.nodes[j];

				const distance = a.position.distanceTo(
					b.position
				);

				if (distance > 4) continue;

				const geometry = new THREE.BufferGeometry().setFromPoints([
					a.position,
					b.position
				]);

				const material = new THREE.LineBasicMaterial({

					color: 0xffffff,

					transparent: true,

					opacity: .12

				});

				const line = new THREE.Line(
					geometry,
					material
				);

				this.scene.add(line);

				this.lines.push(line);

			}

		}

	}

	bindEvents() {

		window.addEventListener(

			'resize',

			() => this.resize(),

			{ passive: true }

		);

		window.addEventListener(

			'mousemove',

			e => {

				this.mouse.x =
					(e.clientX / window.innerWidth - .5) * 8;

				this.mouse.y =
					-(e.clientY / window.innerHeight - .5) * 5;

			},

			{ passive: true }

		);

	}

	animate() {

		requestAnimationFrame(() => this.animate());

		this.nodes.forEach(node => {

			node.position.x += node.userData.speedX;

			node.position.y += node.userData.speedY;

			node.position.z += node.userData.speedZ;

			if (node.position.x > 18) node.position.x = -18;
			if (node.position.x < -18) node.position.x = 18;

			if (node.position.y > 10) node.position.y = -10;
			if (node.position.y < -10) node.position.y = 10;

		});

		this.camera.position.x +=
			(this.mouse.x - this.camera.position.x) * .02;

		this.camera.position.y +=
			(this.mouse.y - this.camera.position.y) * .02;

		this.camera.lookAt(0, 0, 0);

		this.createConnections();

		this.renderer.render(
			this.scene,
			this.camera
		);

	}

	resize() {

		this.camera.aspect =
			this.container.clientWidth /
			this.container.clientHeight;

		this.camera.updateProjectionMatrix();

		this.renderer.setSize(
			this.container.clientWidth,
			this.container.clientHeight
		);

	}

}

document.addEventListener('DOMContentLoaded', () => {

	new VrutalNetwork('vr-network-canvas');

});