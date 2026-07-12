// Build-time environment flavor. The staging workspace build sets VITE_APP_ENV=staging
// (see .github/workflows/deploy-staging.yml); the production build leaves it unset. This
// single flag drives the staging visual identity (app name + orange banner) and gates the
// "promote to everyone" area — publishing belongs only in the place where verification
// happens.
export const APP_ENV = (import.meta.env.VITE_APP_ENV as string | undefined) || 'production'
export const isStaging = APP_ENV === 'staging'

// The stable staging-workspace origin (the fixed `staging` Cloudflare branch alias). Used for
// the "פתח בסביבת-הבדיקות" deep link so the owner can jump straight to the fixed screen.
export const STAGING_URL = 'https://staging.apartment-6s4.pages.dev'
