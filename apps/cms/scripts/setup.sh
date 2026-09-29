#!/bin/sh
# Installe et configure WordPress headless. Idempotent : peut être relancé.
# Variables : WP_URL, WP_ADMIN_USER, WP_ADMIN_PASSWORD, WP_ADMIN_EMAIL, WP_ENV (local|production)
set -eu

cd /var/www/html

echo "→ Installation de WordPress"
if ! wp core is-installed 2>/dev/null; then
  wp core install \
    --url="$WP_URL" \
    --title="Mairie de Saint-Amand-Longpré" \
    --admin_user="$WP_ADMIN_USER" \
    --admin_password="$WP_ADMIN_PASSWORD" \
    --admin_email="$WP_ADMIN_EMAIL" \
    --skip-email
fi

echo "→ Langue et réglages régionaux"
wp language core install fr_FR --activate >/dev/null 2>&1 || true
wp option update timezone_string 'Europe/Paris'
wp option update date_format 'j F Y'
wp option update time_format 'G\hi'
wp option update start_of_week 1
wp option update blogdescription 'Site officiel de la commune (Loir-et-Cher)'
wp option update default_comment_status closed
wp option update default_ping_status closed
wp option update uploads_use_yearmonth_folders 1
wp rewrite structure '/%postname%/' --hard >/dev/null

echo "→ Extensions"
wp plugin install wp-graphql --version=2.23.1 --activate
wp plugin install advanced-custom-fields --version=6.8.10 --activate
wp plugin install wpgraphql-acf --version=3.0.0 --activate
wp plugin delete hello akismet >/dev/null 2>&1 || true
wp language plugin install --all fr_FR >/dev/null 2>&1 || true

echo "→ Nettoyage du contenu d'exemple"
wp post delete 1 2 3 --force >/dev/null 2>&1 || true
wp term update category 1 --name='Vie locale' --slug='vie-locale' >/dev/null 2>&1 || true

if [ "${WP_ENV:-local}" = "local" ]; then
  echo "→ Introspection GraphQL publique (développement uniquement)"
  wp option update graphql_general_settings '{"public_introspection_enabled":"on","debug_mode_enabled":"on"}' --format=json
  echo "→ Mot de passe d'application pour l'importeur et la prévisualisation"
  wp user application-password delete "$WP_ADMIN_USER" --all >/dev/null 2>&1 || true
  APP_PASSWORD=$(wp user application-password create "$WP_ADMIN_USER" "sal-local" --porcelain)
  cat > /output/credentials.env <<EOF
# Généré par apps/cms/scripts/setup.sh — accès locaux uniquement
WP_URL=$WP_URL
WP_USER=$WP_ADMIN_USER
WP_APP_PASSWORD=$APP_PASSWORD
EOF
  echo "  identifiants écrits dans apps/cms/.data/credentials.env"
else
  wp option update graphql_general_settings '{"public_introspection_enabled":"off","debug_mode_enabled":"off"}' --format=json
fi

wp rewrite flush --hard >/dev/null
echo "✓ WordPress prêt sur $WP_URL (admin : $WP_ADMIN_USER)"
