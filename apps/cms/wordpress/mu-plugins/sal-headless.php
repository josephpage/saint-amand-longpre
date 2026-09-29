<?php
/**
 * Plugin Name: Saint-Amand-Longpré — WordPress headless
 * Description: Redirige le front vers le site public, fournit les liens de prévisualisation signés et déclenche la reconstruction du site après chaque publication.
 * Version: 1.0.0
 *
 * Constantes attendues dans wp-config.php :
 *   SAL_SITE_URL        URL du site public (ex. https://www.saintamandlongpre.fr)
 *   SAL_PREVIEW_SECRET  secret partagé avec le site public pour signer les prévisualisations
 *   SAL_GITHUB_REPO     dépôt « propriétaire/nom » dont le workflow reconstruit le site (optionnel)
 *   SAL_GITHUB_TOKEN    jeton GitHub autorisé à déclencher ce workflow (optionnel)
 */

defined( 'ABSPATH' ) || exit;

function sal_site_url(): string {
	return rtrim( defined( 'SAL_SITE_URL' ) ? SAL_SITE_URL : home_url(), '/' );
}

/* -------------------------------------------------------------------------
 * Le front WordPress n'est pas public : toute visite est renvoyée vers le site.
 * ---------------------------------------------------------------------- */
add_action( 'template_redirect', function () {
	if ( is_admin() || wp_doing_ajax() || ( defined( 'REST_REQUEST' ) && REST_REQUEST ) || ( function_exists( 'is_graphql_http_request' ) && is_graphql_http_request() ) ) {
		return;
	}
	if ( is_preview() ) {
		$link = sal_preview_link( get_post( (int) ( $_GET['preview_id'] ?? $_GET['p'] ?? $_GET['page_id'] ?? 0 ) ) );
		if ( $link ) {
			wp_redirect( $link );
			exit;
		}
	}
	wp_redirect( sal_site_url() . '/', 301 );
	exit;
} );

/* -------------------------------------------------------------------------
 * Prévisualisation : lien signé (HMAC) valable une heure vers /preview/ du site.
 * ---------------------------------------------------------------------- */
function sal_preview_link( $post ): ?string {
	if ( ! $post instanceof WP_Post || ! defined( 'SAL_PREVIEW_SECRET' ) ) {
		return null;
	}
	$type    = $post->post_type;
	$id      = $post->ID;
	$expires = time() + HOUR_IN_SECONDS;
	$sig     = hash_hmac( 'sha256', "$type:$id:$expires", SAL_PREVIEW_SECRET );
	return add_query_arg(
		array(
			'type' => $type,
			'id'   => $id,
			'exp'  => $expires,
			'sig'  => $sig,
		),
		sal_site_url() . '/preview/'
	);
}

add_filter( 'preview_post_link', function ( $link, $post ) {
	return sal_preview_link( $post ) ?? $link;
}, 10, 2 );

// Le bouton « Voir » du back-office pointe vers le site public.
add_filter( 'post_type_link', 'sal_public_link', 10, 2 );
add_filter( 'post_link', 'sal_public_link', 10, 2 );
add_filter( 'page_link', function ( $link, $post_id ) {
	return sal_public_link( $link, get_post( $post_id ) );
}, 10, 2 );

function sal_public_link( $link, $post ) {
	// Uniquement dans l'administration : l'API GraphQL doit garder les URI internes.
	if ( ! is_admin() || ( function_exists( 'is_graphql_request' ) && is_graphql_request() ) ) {
		return $link;
	}
	if ( ! $post instanceof WP_Post || 'publish' !== $post->post_status ) {
		return $link;
	}
	$base = sal_site_url();
	switch ( $post->post_type ) {
		case 'post':
			return "$base/actualites/{$post->post_name}/";
		case 'evenement':
			return "$base/agenda/{$post->post_name}/";
		case 'salle':
			return "$base/demarches/louer-une-salle/{$post->post_name}/";
		case 'page':
			$path = get_page_uri( $post );
			return "$base/" . trim( $path, '/' ) . '/';
		default:
			return $link;
	}
}

/* -------------------------------------------------------------------------
 * Reconstruction du site après publication (GitHub Actions, repository_dispatch).
 * Les modifications rapprochées sont regroupées : un seul build par tranche de 2 minutes.
 * ---------------------------------------------------------------------- */
const SAL_REBUILD_HOOK = 'sal_trigger_rebuild';

function sal_schedule_rebuild(): void {
	if ( ! wp_next_scheduled( SAL_REBUILD_HOOK ) ) {
		wp_schedule_single_event( time() + 2 * MINUTE_IN_SECONDS, SAL_REBUILD_HOOK );
	}
}

add_action( 'transition_post_status', function ( $new, $old, $post ) {
	if ( wp_is_post_revision( $post ) || wp_is_post_autosave( $post ) ) {
		return;
	}
	if ( 'publish' === $new || 'publish' === $old ) {
		sal_schedule_rebuild();
	}
}, 10, 3 );
add_action( 'deleted_post', 'sal_schedule_rebuild' );
add_action( 'edit_attachment', 'sal_schedule_rebuild' );
add_action( 'sal_content_changed', 'sal_schedule_rebuild' );

add_action( SAL_REBUILD_HOOK, function () {
	if ( ! defined( 'SAL_GITHUB_REPO' ) || ! defined( 'SAL_GITHUB_TOKEN' ) || ! SAL_GITHUB_TOKEN ) {
		return;
	}
	$response = wp_remote_post(
		'https://api.github.com/repos/' . SAL_GITHUB_REPO . '/dispatches',
		array(
			'timeout' => 15,
			'headers' => array(
				'Accept'               => 'application/vnd.github+json',
				'Authorization'        => 'Bearer ' . SAL_GITHUB_TOKEN,
				'X-GitHub-Api-Version' => '2022-11-28',
				'User-Agent'           => 'sal-cms',
			),
			'body'    => wp_json_encode( array( 'event_type' => 'contenu-modifie' ) ),
		)
	);
	update_option(
		'sal_last_rebuild',
		array(
			'time'   => time(),
			'status' => is_wp_error( $response ) ? $response->get_error_message() : wp_remote_retrieve_response_code( $response ),
		),
		false
	);
} );

/* -------------------------------------------------------------------------
 * Allègement de l'administration pour le secrétariat de mairie.
 * ---------------------------------------------------------------------- */
add_filter( 'xmlrpc_enabled', '__return_false' );
add_filter( 'comments_open', '__return_false' );
add_filter( 'pings_open', '__return_false' );

add_action( 'admin_menu', function () {
	remove_menu_page( 'edit-comments.php' );
	remove_menu_page( 'themes.php' );
	remove_menu_page( 'tools.php' );
}, 99 );

add_action( 'wp_dashboard_setup', function () {
	remove_meta_box( 'dashboard_primary', 'dashboard', 'side' );
	remove_meta_box( 'dashboard_quick_press', 'dashboard', 'side' );
	wp_add_dashboard_widget( 'sal_welcome', 'Site de la mairie', function () {
		$last = get_option( 'sal_last_rebuild' );
		printf( '<p>Les contenus publiés ici apparaissent sur <a href="%1$s" target="_blank" rel="noopener">%1$s</a> environ 3 minutes après la publication.</p>', esc_url( sal_site_url() ) );
		if ( wp_next_scheduled( SAL_REBUILD_HOOK ) ) {
			echo '<p><strong>Mise à jour du site programmée.</strong></p>';
		} elseif ( $last ) {
			printf( '<p>Dernière mise à jour demandée le %s.</p>', esc_html( wp_date( 'j F Y à G\hi', $last['time'] ) ) );
		}
		echo '<p>Pour afficher un message important en haut de toutes les pages (canicule, travaux…), créez une <a href="' . esc_url( admin_url( 'post-new.php?post_type=alerte' ) ) . '">alerte</a> avec sa date de fin.</p>';
	} );
} );

// Les images sans texte alternatif sont signalées dans la médiathèque.
add_filter( 'attachment_fields_to_edit', function ( $fields, $post ) {
	if ( wp_attachment_is_image( $post ) && ! get_post_meta( $post->ID, '_wp_attachment_image_alt', true ) ) {
		$fields['sal_alt_warning'] = array(
			'label' => '',
			'input' => 'html',
			'html'  => '<p style="color:#b32d2e"><strong>Texte alternatif manquant :</strong> décrivez l’image pour les personnes qui ne la voient pas (obligation d’accessibilité).</p>',
		);
	}
	return $fields;
}, 10, 2 );
