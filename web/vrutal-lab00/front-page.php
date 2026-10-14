<?php get_header(); ?>

<main id="primary">

<?php
get_template_part('template-parts/home/hero');

get_template_part('template-parts/home/problem');

get_template_part('template-parts/home/solution');

get_template_part('template-parts/home/os-preview');

get_template_part('template-parts/home/labs-preview');

get_template_part('template-parts/contact');

get_template_part('template-parts/home/cta');
?>

</main>

<?php get_footer(); ?>