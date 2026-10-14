<?php
/**
 * ==========================================================================
 * VRUTAL LAB01
 * Enqueue Scripts & Styles
 * Version: 0.2.0
 * ==========================================================================
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Cargar estilos y scripts
 */
function vrutal_enqueue_assets() {

	$theme_version = wp_get_theme()->get( 'Version' );

	/*
	|--------------------------------------------------------------------------
	| Google Fonts
	|--------------------------------------------------------------------------
	*/

	wp_enqueue_style(
		'vrutal-fonts',
		'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&family=Space+Grotesk:wght@400;500;700&display=swap',
		array(),
		null
	);

	/*
	|--------------------------------------------------------------------------
	| CSS
	|--------------------------------------------------------------------------
	*/

	$styles = array(
		'variables',
		'base',
		'layout',
		'components',
		'utilities',
	);

	foreach ( $styles as $style ) {

		wp_enqueue_style(
			'vr-' . $style,
			get_template_directory_uri() . '/assets/css/' . $style . '.css',
			array(),
			$theme_version
		);

	}

	/*
	|--------------------------------------------------------------------------
	| Main JavaScript
	|--------------------------------------------------------------------------
	*/

	wp_enqueue_script(
		'vr-main',
		get_template_directory_uri() . '/assets/js/main.js',
		array(),
		$theme_version,
		true
	);

	/*
	|--------------------------------------------------------------------------
	| Home Engine (Three.js)
	|--------------------------------------------------------------------------
	*/

	if ( is_front_page() ) {

		wp_enqueue_script(
			'threejs',
			'https://unpkg.com/three@0.179.1/build/three.umd.js',
			array(),
			'0.179.1',
			true
		);

		wp_enqueue_script(
			'vr-network',
			get_template_directory_uri() . '/assets/js/engine/network.js',
			array( 'threejs' ),
			$theme_version,
			true
		);

	}

}

add_action( 'wp_enqueue_scripts', 'vrutal_enqueue_assets' );