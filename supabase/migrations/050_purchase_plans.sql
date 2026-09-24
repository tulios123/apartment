-- לוח התשלומים — out of the browser and onto the server.
--
-- The plan is the centre of the whole pre-key stage: the payment schedule, which items are
-- settled, and every statutory deadline derived from them. It has lived in localStorage
-- since 09.09, deliberately and temporarily, behind four functions in src/lib/purchasePlan
-- so that moving it here would be a change to that one file. This is that move.
--
-- Why it matters: localStorage is per-browser. Clearing site data, switching phone, or
-- opening the app on a laptop lost the plan outright, with no warning and nothing to
-- restore from. The owner cleared this for migration on 24.09.
--
-- Shape: ONE row per owner. The plan is a single document that is always read and written
-- whole (buildPlan regenerates it; setDone/setAmount return a new one), so a jsonb column
-- is an honest fit — splitting it into item rows would buy nothing and cost a join plus
-- a write ordering problem on every edit.
--
-- `updated_at` is the conflict rule: the newest write wins, compared against the same
-- field the client stamps into its local copy. A legacy local plan has no timestamp and so
-- loses to any server copy, which is correct — the server copy can only have come from a
-- newer client.

create table if not exists purchase_plans (
  owner_id uuid primary key references owners(id) on delete cascade,
  plan jsonb not null,
  updated_at timestamptz not null default now()
);

alter table purchase_plans enable row level security;

-- Same shape as every other table here: a row belongs to exactly one owner and is
-- invisible to everyone else. `with check` on both insert and update so a client cannot
-- write a row under someone else's id.
create policy "owner_scoped" on purchase_plans
  for all to authenticated
  using (owner_id = auth.uid())
  with check (owner_id = auth.uid());
