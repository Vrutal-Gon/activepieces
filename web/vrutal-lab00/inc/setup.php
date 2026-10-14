<?php
/**
 * ==========================================================================
 * VRUTAL LAB01
 * Theme Setup
 * Version: 0.1.0
 * ==========================================================================
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Configuración inicial del tema.
 */
function vrutal_theme_setup() {

	/*
	|--------------------------------------------------------------------------
	| Traducciones
	|--------------------------------------------------------------------------
	*/

	load_theme_textdomain(
		'vrutal',
		get_template_directory() . '/languages'
	);

	/*
	|--------------------------------------------------------------------------
	| Soporte del tema
	|--------------------------------------------------------------------------
	*/

	add_theme_support( 'title-tag' );

	add_theme_support( 'post-thumbnails' );

	add_theme_support(
		'html5',
		array(
			'search-form',
			'comment-form',
			'comment-list',
			'gallery',
			'caption',
			'script',
			'style',
		)
	);

	add_theme_support(
		'custom-logo',
		array(
			'height'      => 60,
			'width'       => 240,
			'flex-height' => true,
			'flex-width'  => true,
		)
	);

	add_theme_support(
		'custom-background',
		array(
			'default-color' => '0B0B0F',
		)
	);

	add_theme_support( 'responsive-embeds' );

	add_theme_support( 'wp-block-styles' );

	add_theme_support( 'align-wide' );

	add_theme_support( 'editor-styles' );

	add_editor_style( 'assets/css/editor.css' );

}

add_action( 'after_setup_theme', 'vrutal_theme_setup' );