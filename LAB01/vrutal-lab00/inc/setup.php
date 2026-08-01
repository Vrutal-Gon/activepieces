<?php

/**
 * Configuración inicial del tema.
 */

if (!defined('ABSPATH')) {
    exit;
}

function vrutal_setup()
{
    add_theme_support('title-tag');

    add_theme_support('post-thumbnails');

    add_theme_support('custom-logo');

    add_theme_support('menus');

    add_theme_support('html5', [
        'search-form',
        'gallery',
        'caption',
        'style',
        'script'
    ]);

    register_nav_menus([
        'primary' => 'Menú Principal',
        'footer'  => 'Menú Footer',
    ]);
}

add_action('after_setup_theme', 'vrutal_setup');