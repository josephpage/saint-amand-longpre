<?php
/**
 * Plugin Name: Saint-Amand-Longpré — modèle de contenu
 * Description: Types de contenu, taxonomies, champs ACF et réglages de la mairie, exposés à l'API REST et à WPGraphQL.
 * Version: 1.0.0
 */

defined( 'ABSPATH' ) || exit;

/**
 * Types de contenu personnalisés.
 * Les actualités utilisent les articles natifs et les pages d'information les pages natives.
 */
add_action( 'init', function () {
	$types = array(
		'evenement' => array(
			'labels'  => array( 'Évènements', 'Évènement', 'Ajouter un évènement' ),
			'graphql' => array( 'evenement', 'evenements' ),
			'icon'    => 'dashicons-calendar-alt',
			'rewrite' => 'agenda',
		),
		'seance'    => array(
			'labels'  => array( 'Séances du conseil', 'Séance du conseil', 'Ajouter une séance' ),
			'graphql' => array( 'seance', 'seances' ),
			'icon'    => 'dashicons-groups',
			'rewrite' => 'seances',
		),
		'elu'       => array(
			'labels'  => array( 'Élus', 'Élu', 'Ajouter un élu' ),
			'graphql' => array( 'elu', 'elus' ),
			'icon'    => 'dashicons-businessperson',
			'rewrite' => 'elus',
		),
		'salle'     => array(
			'labels'  => array( 'Salles', 'Salle', 'Ajouter une salle' ),
			'graphql' => array( 'salle', 'salles' ),
			'icon'    => 'dashicons-building',
			'rewrite' => 'salles',
		),
		'annuaire'  => array(
			'labels'  => array( 'Annuaire', 'Fiche d’annuaire', 'Ajouter une fiche' ),
			'graphql' => array( 'ficheAnnuaire', 'fichesAnnuaire' ),
			'icon'    => 'dashicons-book',
			'rewrite' => 'annuaire',
		),
		'alerte'    => array(
			'labels'  => array( 'Alertes', 'Alerte', 'Ajouter une alerte' ),
			'graphql' => array( 'alerte', 'alertes' ),
			'icon'    => 'dashicons-warning',
			'rewrite' => 'alertes',
		),
	);

	foreach ( $types as $slug => $t ) {
		register_post_type(
			$slug,
			array(
				'labels'              => array(
					'name'          => $t['labels'][0],
					'singular_name' => $t['labels'][1],
					'add_new_item'  => $t['labels'][2],
					'edit_item'     => 'Modifier : ' . $t['labels'][1],
				),
				'public'              => true,
				'show_in_rest'        => true,
				'show_in_graphql'     => true,
				'graphql_single_name' => $t['graphql'][0],
				'graphql_plural_name' => $t['graphql'][1],
				'menu_icon'           => $t['icon'],
				'has_archive'         => false,
				'rewrite'             => array( 'slug' => $t['rewrite'] ),
				'supports'            => array( 'title', 'editor', 'excerpt', 'thumbnail', 'custom-fields', 'revisions', 'page-attributes' ),
			)
		);
	}

	// Résumé des pages : affiché sous les liens des rubriques et dans les résultats de recherche.
	add_post_type_support( 'page', 'excerpt' );

	register_taxonomy(
		'type_annuaire',
		'annuaire',
		array(
			'labels'              => array( 'name' => 'Types', 'singular_name' => 'Type' ),
			'hierarchical'        => true,
			'show_in_rest'        => true,
			'show_in_graphql'     => true,
			'graphql_single_name' => 'typeAnnuaire',
			'graphql_plural_name' => 'typesAnnuaire',
			'show_admin_column'   => true,
		)
	);
	register_taxonomy(
		'categorie_annuaire',
		'annuaire',
		array(
			'labels'              => array( 'name' => 'Catégories', 'singular_name' => 'Catégorie' ),
			'hierarchical'        => false,
			'show_in_rest'        => true,
			'show_in_graphql'     => true,
			'graphql_single_name' => 'categorieAnnuaire',
			'graphql_plural_name' => 'categoriesAnnuaire',
			'show_admin_column'   => true,
		)
	);

	// Identifiant d'origine (ancien site ou jeu de données) : rend l'import idempotent.
	foreach ( array( 'post', 'page', 'attachment', 'evenement', 'seance', 'elu', 'salle', 'annuaire', 'alerte' ) as $type ) {
		register_post_meta(
			$type,
			'_sal_source_id',
			array(
				'type'          => 'string',
				'single'        => true,
				'show_in_rest'  => true,
				'auth_callback' => fn() => current_user_can( 'edit_posts' ),
			)
		);
	}
	register_post_meta(
		'post',
		'_sal_date_estimee',
		array(
			'type'          => 'boolean',
			'single'        => true,
			'show_in_rest'  => true,
			'auth_callback' => fn() => current_user_can( 'edit_posts' ),
		)
	);
} );

/** Types d'annuaire créés d'office. */
add_action( 'init', function () {
	if ( get_option( 'sal_terms_seeded' ) ) {
		return;
	}
	$terms = array(
		'association'  => 'Associations',
		'commerce'     => 'Commerces',
		'artisan'      => 'Artisans',
		'entreprise'   => 'Entreprises',
		'numero-utile' => 'Numéros utiles',
	);
	foreach ( $terms as $slug => $name ) {
		if ( ! term_exists( $slug, 'type_annuaire' ) ) {
			wp_insert_term( $name, 'type_annuaire', array( 'slug' => $slug ) );
		}
	}
	update_option( 'sal_terms_seeded', 1 );
}, 20 );

/**
 * Champs ACF (version gratuite : champs simples uniquement).
 * Les documents joints et galeries sont des blocs Fichier et Galerie dans le contenu.
 */
add_action( 'acf/include_fields', function () {
	if ( ! function_exists( 'acf_add_local_field_group' ) ) {
		return;
	}

	$group = function ( string $key, string $title, string $graphql, string $post_type, array $fields ) {
		acf_add_local_field_group(
			array(
				'key'                   => "group_sal_$key",
				'title'                 => $title,
				'fields'                => array_map(
					function ( $field ) use ( $key ) {
						return array_merge(
							array(
								'key'          => "field_sal_{$key}_{$field['name']}",
								'show_in_rest' => 1,
							),
							$field
						);
					},
					$fields
				),
				'location'              => array( array( array( 'param' => 'post_type', 'operator' => '==', 'value' => $post_type ) ) ),
				'position'              => 'acf_after_title',
				'show_in_rest'          => 1,
				'show_in_graphql'       => 1,
				'graphql_field_name'    => $graphql,
				'map_graphql_types_from_location_rules' => 1,
			)
		);
	};

	$group( 'evenement', 'Informations pratiques', 'infosEvenement', 'evenement', array(
		array( 'name' => 'debut', 'label' => 'Début', 'type' => 'date_time_picker', 'required' => 1, 'display_format' => 'd/m/Y H:i', 'return_format' => 'Y-m-d H:i:s', 'graphql_field_name' => 'debut' ),
		array( 'name' => 'fin', 'label' => 'Fin', 'type' => 'date_time_picker', 'display_format' => 'd/m/Y H:i', 'return_format' => 'Y-m-d H:i:s', 'graphql_field_name' => 'fin' ),
		array( 'name' => 'journee_entiere', 'label' => 'Toute la journée', 'type' => 'true_false', 'ui' => 1, 'graphql_field_name' => 'journeeEntiere' ),
		array( 'name' => 'lieu', 'label' => 'Lieu', 'type' => 'text', 'graphql_field_name' => 'lieu' ),
		array( 'name' => 'adresse', 'label' => 'Adresse', 'type' => 'text', 'graphql_field_name' => 'adresse' ),
	) );

	$group( 'seance', 'Séance', 'infosSeance', 'seance', array(
		array( 'name' => 'date', 'label' => 'Date de la séance', 'type' => 'date_picker', 'required' => 1, 'display_format' => 'd/m/Y', 'return_format' => 'Y-m-d', 'graphql_field_name' => 'date' ),
		array( 'name' => 'compte_rendu', 'label' => 'Compte rendu (PDF)', 'type' => 'file', 'return_format' => 'id', 'mime_types' => 'pdf', 'graphql_field_name' => 'compteRendu' ),
	) );

	$group( 'elu', 'Mandat', 'infosElu', 'elu', array(
		array(
			'name'               => 'role',
			'label'              => 'Rôle',
			'type'               => 'select',
			'required'           => 1,
			'choices'            => array( 'maire' => 'Maire', 'adjoint' => 'Adjoint', 'conseiller' => 'Conseiller municipal' ),
			'default_value'      => 'conseiller',
			'graphql_field_name' => 'role',
		),
		array( 'name' => 'fonction', 'label' => 'Fonction affichée', 'type' => 'text', 'instructions' => 'Par exemple « 1er adjoint ».', 'graphql_field_name' => 'fonction' ),
		array( 'name' => 'delegations', 'label' => 'Délégations', 'type' => 'textarea', 'rows' => 3, 'new_lines' => '', 'graphql_field_name' => 'delegations' ),
	) );

	$group( 'salle', 'Capacité', 'infosSalle', 'salle', array(
		array( 'name' => 'capacite', 'label' => 'Capacité maximale (personnes)', 'type' => 'number', 'min' => 1, 'graphql_field_name' => 'capacite' ),
		array( 'name' => 'places_assises', 'label' => 'Places assises', 'type' => 'number', 'min' => 1, 'graphql_field_name' => 'placesAssises' ),
	) );

	$group( 'annuaire', 'Coordonnées', 'infosAnnuaire', 'annuaire', array(
		array( 'name' => 'telephone', 'label' => 'Téléphone', 'type' => 'text', 'graphql_field_name' => 'telephone' ),
		array( 'name' => 'email', 'label' => 'E-mail', 'type' => 'email', 'graphql_field_name' => 'email' ),
		array( 'name' => 'site', 'label' => 'Site internet', 'type' => 'url', 'graphql_field_name' => 'site' ),
		array( 'name' => 'adresse', 'label' => 'Adresse', 'type' => 'text', 'graphql_field_name' => 'adresse' ),
	) );

	$group( 'alerte', 'Alerte', 'infosAlerte', 'alerte', array(
		array(
			'name'               => 'niveau',
			'label'              => 'Niveau',
			'type'               => 'select',
			'choices'            => array( 'info' => 'Information', 'vigilance' => 'Vigilance', 'urgence' => 'Urgence' ),
			'default_value'      => 'info',
			'graphql_field_name' => 'niveau',
		),
		array( 'name' => 'lien', 'label' => 'Lien « En savoir plus »', 'type' => 'text', 'instructions' => 'Adresse complète ou chemin du site, par exemple /actualites/canicule/.', 'graphql_field_name' => 'lien' ),
		array( 'name' => 'expiration', 'label' => 'Afficher jusqu’au', 'type' => 'date_picker', 'required' => 1, 'display_format' => 'd/m/Y', 'return_format' => 'Y-m-d', 'graphql_field_name' => 'expiration' ),
	) );
} );

/**
 * Réglages de la mairie : coordonnées, horaires, photo d'accueil, redirections
 * de l'ancien site. Stockés en options, modifiables dans Réglages → Mairie.
 */
const SAL_SETTINGS_DEFAULTS = array(
	'street'      => '18 rue Jules Ferry',
	'postal_code' => '41310',
	'city'        => 'Saint-Amand-Longpré',
	'phone'       => '02 54 82 83 74',
	'hours'       => "1 10:00 12:30\n2 10:00 12:30\n3 10:00 12:30\n4 10:00 12:30\n5 10:00 12:30\n5 14:00 16:30",
	'facebook'    => 'https://www.facebook.com/MairieSaintAmandLongpre',
	'latitude'    => '',
	'longitude'   => '',
	'hero_image'  => 0,
	'population'  => 1218,
);

function sal_settings(): array {
	return array_merge( SAL_SETTINGS_DEFAULTS, (array) get_option( 'sal_reglages', array() ) );
}

/** Convertit les lignes « jour ouverture fermeture » en créneaux. */
function sal_parse_hours( string $text ): array {
	$slots = array();
	foreach ( preg_split( '/\R/', $text ) as $line ) {
		if ( preg_match( '/^\s*([1-7])\s+(\d{2}:\d{2})\s+(\d{2}:\d{2})\s*$/', $line, $m ) ) {
			$slots[] = array( 'day' => (int) $m[1], 'open' => $m[2], 'close' => $m[3] );
		}
	}
	return $slots;
}

add_action( 'init', function () {
	register_setting(
		'sal',
		'sal_reglages',
		array(
			'type'         => 'object',
			'default'      => array(),
			'show_in_rest' => array(
				'schema' => array(
					'type'       => 'object',
					'properties' => array(
						'street'      => array( 'type' => 'string' ),
						'postal_code' => array( 'type' => 'string' ),
						'city'        => array( 'type' => 'string' ),
						'phone'       => array( 'type' => 'string' ),
						'hours'       => array( 'type' => 'string' ),
						'facebook'    => array( 'type' => 'string' ),
						'latitude'    => array( 'type' => 'string' ),
						'longitude'   => array( 'type' => 'string' ),
						'hero_image'  => array( 'type' => 'integer' ),
						'population'  => array( 'type' => 'integer' ),
					),
				),
			),
		)
	);
	register_setting(
		'sal',
		'sal_redirections',
		array(
			'type'         => 'array',
			'default'      => array(),
			'show_in_rest' => array(
				'schema' => array(
					'type'  => 'array',
					'items' => array(
						'type'       => 'object',
						'properties' => array(
							'from' => array( 'type' => 'string' ),
							'to'   => array( 'type' => 'string' ),
						),
					),
				),
			),
		)
	);
} );

add_action( 'admin_menu', function () {
	add_options_page( 'Mairie', 'Mairie', 'manage_options', 'sal-reglages', 'sal_render_settings_page' );
} );

function sal_render_settings_page(): void {
	if ( ! current_user_can( 'manage_options' ) ) {
		return;
	}
	if ( isset( $_POST['sal_reglages'] ) && check_admin_referer( 'sal_reglages' ) ) {
		$input = wp_unslash( $_POST['sal_reglages'] );
		$clean = array();
		foreach ( SAL_SETTINGS_DEFAULTS as $key => $default ) {
			$value         = $input[ $key ] ?? $default;
			$clean[ $key ] = is_int( $default ) ? (int) $value : ( 'hours' === $key ? sanitize_textarea_field( $value ) : sanitize_text_field( $value ) );
		}
		update_option( 'sal_reglages', $clean );
		echo '<div class="notice notice-success"><p>Réglages enregistrés. Le site public sera mis à jour dans quelques minutes.</p></div>';
		do_action( 'sal_content_changed' );
	}
	$s      = sal_settings();
	$fields = array(
		'street'      => 'Adresse',
		'postal_code' => 'Code postal',
		'city'        => 'Commune',
		'phone'       => 'Téléphone',
		'facebook'    => 'Page Facebook',
		'latitude'    => 'Latitude (carte)',
		'longitude'   => 'Longitude (carte)',
		'hero_image'  => 'Photo d’accueil (identifiant du média)',
		'population'  => 'Nombre d’habitants',
	);
	echo '<div class="wrap"><h1>Réglages de la mairie</h1><form method="post">';
	wp_nonce_field( 'sal_reglages' );
	echo '<table class="form-table" role="presentation">';
	foreach ( $fields as $key => $label ) {
		printf(
			'<tr><th scope="row"><label for="sal-%1$s">%2$s</label></th><td><input class="regular-text" id="sal-%1$s" name="sal_reglages[%1$s]" value="%3$s"></td></tr>',
			esc_attr( $key ),
			esc_html( $label ),
			esc_attr( (string) $s[ $key ] )
		);
	}
	printf(
		'<tr><th scope="row"><label for="sal-hours">Horaires d’ouverture</label></th><td><textarea id="sal-hours" name="sal_reglages[hours]" rows="8" class="large-text code">%s</textarea><p class="description">Une ligne par créneau : numéro du jour (1 = lundi … 7 = dimanche), heure d’ouverture, heure de fermeture. Exemple : <code>5 14:00 16:30</code>.</p></td></tr>',
		esc_textarea( $s['hours'] )
	);
	echo '</table>';
	submit_button( 'Enregistrer' );
	echo '</form></div>';
}

/** Exposition des réglages et des redirections dans GraphQL. */
add_action( 'graphql_register_types', function () {
	register_graphql_object_type(
		'SalCreneau',
		array(
			'fields' => array(
				'jour'      => array( 'type' => array( 'non_null' => 'Int' ) ),
				'ouverture' => array( 'type' => array( 'non_null' => 'String' ) ),
				'fermeture' => array( 'type' => array( 'non_null' => 'String' ) ),
			),
		)
	);
	register_graphql_object_type(
		'SalReglages',
		array(
			'fields' => array(
				'adresse'      => array( 'type' => 'String' ),
				'codePostal'   => array( 'type' => 'String' ),
				'commune'      => array( 'type' => 'String' ),
				'telephone'    => array( 'type' => 'String' ),
				'facebook'     => array( 'type' => 'String' ),
				'latitude'     => array( 'type' => 'Float' ),
				'longitude'    => array( 'type' => 'Float' ),
				'population'   => array( 'type' => 'Int' ),
				'photoAccueil' => array( 'type' => 'MediaItem' ),
				'horaires'     => array( 'type' => array( 'list_of' => 'SalCreneau' ) ),
			),
		)
	);
	register_graphql_field(
		'RootQuery',
		'reglagesMairie',
		array(
			'type'    => 'SalReglages',
			'resolve' => function ( $root, $args, $context ) {
				$s = sal_settings();
				return array(
					'adresse'      => $s['street'],
					'codePostal'   => $s['postal_code'],
					'commune'      => $s['city'],
					'telephone'    => $s['phone'],
					'facebook'     => $s['facebook'],
					'latitude'     => '' === $s['latitude'] ? null : (float) $s['latitude'],
					'longitude'    => '' === $s['longitude'] ? null : (float) $s['longitude'],
					'population'   => (int) $s['population'],
					'photoAccueil' => $s['hero_image'] ? $context->get_loader( 'post' )->load_deferred( (int) $s['hero_image'] ) : null,
					'horaires'     => array_map(
						fn( $slot ) => array( 'jour' => $slot['day'], 'ouverture' => $slot['open'], 'fermeture' => $slot['close'] ),
						sal_parse_hours( $s['hours'] )
					),
				);
			},
		)
	);

	register_graphql_object_type(
		'SalRedirection',
		array(
			'fields' => array(
				'de'   => array( 'type' => array( 'non_null' => 'String' ) ),
				'vers' => array( 'type' => array( 'non_null' => 'String' ) ),
			),
		)
	);
	register_graphql_field(
		'RootQuery',
		'redirections',
		array(
			'type'    => array( 'list_of' => 'SalRedirection' ),
			'resolve' => fn() => array_map(
				fn( $r ) => array( 'de' => $r['from'], 'vers' => $r['to'] ),
				array_filter( (array) get_option( 'sal_redirections', array() ), fn( $r ) => ! empty( $r['from'] ) && ! empty( $r['to'] ) )
			),
		)
	);
} );
