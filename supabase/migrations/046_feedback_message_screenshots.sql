-- Let a chat message carry attached screenshots, so the owner can upload screenshots to the
-- bot MID-conversation (not only on the first report). Additive: existing rows default to an
-- empty array. Written only by the service-role send-bot-followup fn (bot channel), read by
-- whoever can already read the message — RLS is unchanged (the bot channel is admin-only). No
-- grant change: clients don't attach here, so the authenticated INSERT grant stays as-is.
alter table feedback_messages add column if not exists screenshot_paths text[] not null default '{}';
