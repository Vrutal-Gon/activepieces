<?php
/**
 * ==========================================================================
 * VRUTAL LABS
 * FOOTER
 * ==========================================================================
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
?>

<footer class="vr-footer">

	<div class="vr-container">

		<div class="vr-footer-grid">

			<div class="vr-footer-brand">

				<a
					href="<?php echo esc_url( home_url( '/' ) ); ?>"
					class="vr-logo">

					<span class="vr-logo-mark">V</span>
					<span class="vr-logo-text">RUTAL</span>

				</a>

				<p>

					Diseñando sistemas para organizaciones
					impulsadas por inteligencia artificial.

				</p>

			</div>

			<div class="vr-footer-column">

				<h4>

					Navegación

				</h4>

				<ul>

					<li>
						<a href="<?php echo esc_url(home_url('/vrutal-os/')); ?>">
							VRUTAL OS
						</a>
					</li>

					<li>
						<a href="<?php echo esc_url(home_url('/labs/')); ?>">
							LABS
						</a>
					</li>

					<li>
						<a href="<?php echo esc_url(home_url('/manifesto/')); ?>">
							Manifesto
						</a>
					</li>

				</ul>

			</div>

			<div class="vr-footer-column">

				<h4>

					Empresa

				</h4>

				<ul>

					<li>

						<a href="<?php echo esc_url(home_url('/contacto/')); ?>">
							Contacto
						</a>

					</li>

					<li>

						<a href="#">

							LinkedIn

						</a>

					</li>

				</ul>

			</div>

		</div>

		<div class="vr-footer-bottom">

			<p>

				© <?php echo date('Y'); ?>
				VRUTAL LABS · Organizational Intelligence

			</p>

		</div>

	</div>

</footer>

<?php wp_footer(); ?>

</body>
</html>