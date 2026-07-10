-- Per-fix preview URL. When the auto-fix bot opens a PR, the claude-fix workflow deploys
-- that branch to a private Cloudflare preview and reports the URL here (service role, via
-- update-feedback-status) — but ONLY when the deploy actually succeeded. The admin console
-- shows a "test the fix before merging" button only when this is set, so a failed/absent
-- preview never leaves a dead button. Nullable; written by the service role only (not in
-- the authenticated update grant, so a client can't set it).
alter table feedback add column if not exists preview_url text;
