<?php
/**
 * ==========================================================================
 * VRUTAL LABS
 * HEADER
 * ==========================================================================
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>
<!doctype html>

<html <?php language_attributes(); ?>>

<head>

	<meta charset="<?php bloginfo( 'charset' ); ?>">

	<meta
		name="viewport"
		content="width=device-width, initial-scale=1">

	<?php wp_head(); ?>

</head>

<body <?php body_class(); ?>>

<?php wp_body_open(); ?>

<header
	id="site-header"
	class="vr-header">

	<div class="vr-container">

		<div class="vr-navbar">

			<!-- Logo -->

			<a
				class="vr-logo"
				href="<?php echo esc_url( home_url( '/' ) ); ?>"
				aria-label="<?php bloginfo( 'name' ); ?>">

				<span class="vr-logo-mark">V</span>

				<span class="vr-logo-text">RUTAL</span>

			</a>

			<!-- Navigation -->

			<nav
				class="vr-nav"
				aria-label="<?php esc_attr_e( 'Primary navigation', 'vrutal' ); ?>">

				<?php
				wp_nav_menu(
					array(
						'theme_location' => 'primary',
						'container'      => false,
						'menu_class'     => 'vr-menu',
						'fallback_cb'    => false,
					)
				);
				?>

			</nav>

			<!-- Actions -->

			<div class="vr-actions">

				<button
					class="vr-language"
					type="button"
					aria-label="Language selector">

					ES

				</button>

				<a
					href="<?php echo esc_url( home_url( '/contacto/' ) ); ?>"
					class="vr-btn vr-btn-outline">

					Hablemos

				</a>

			</div>

		</div>

	</div>

</header>