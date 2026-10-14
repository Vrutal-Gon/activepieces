<?php
/**
 * ==========================================================================
 * VRUTAL LAB01
 * Menus
 * Version: 0.1.0
 * ==========================================================================
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

/**
 * Registrar los menús del tema.
 */
function vrutal_register_menus() {

	register_nav_menus(
		array(
			'primary' => __( 'Primary Menu', 'vrutal' ),
			'footer'  => __( 'Footer Menu', 'vrutal' ),
		)
	);

}

add_action( 'after_setup_theme', 'vrutal_register_menus' );