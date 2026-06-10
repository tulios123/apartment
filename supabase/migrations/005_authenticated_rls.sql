-- Add permissive policies for authenticated role (Google OAuth users).
-- The original anon policies remain for local dev without login.

create policy "authenticated_all" on owners          for all to authenticated using (true) with check (true);
create policy "authenticated_all" on properties      for all to authenticated using (true) with check (true);
create policy "authenticated_all" on contracts       for all to authenticated using (true) with check (true);
create policy "authenticated_all" on contract_utilities for all to authenticated using (true) with check (true);
create policy "authenticated_all" on recurring_items for all to authenticated using (true) with check (true);
create policy "authenticated_all" on transactions    for all to authenticated using (true) with check (true);
create policy "authenticated_all" on tasks           for all to authenticated using (true) with check (true);
create policy "authenticated_all" on documents       for all to authenticated using (true) with check (true);
