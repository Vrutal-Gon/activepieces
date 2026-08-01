<?php

/**
 * Carga de CSS y JavaScript.
 */

if (!defined('ABSPATH')) {
    exit;
}

function vrutal_enqueue_assets()
{
    wp_enqueue_style(
        'vrutal-style',
        get_stylesheet_uri(),
        [],
        wp_get_theme()->get('Version')
    );

    wp_enqueue_script(
        'vrutal-main',
        get_template_directory_uri() . '/assets/js/main.js',
        [],
        wp_get_theme()->get('Version'),
        true
    );
}

add_action('wp_enqueue_scripts', 'vrutal_enqueue_assets');