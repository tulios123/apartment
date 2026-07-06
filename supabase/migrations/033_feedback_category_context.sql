-- Richer feedback capture. Alongside the existing screen `path`, record:
--   category — bug / feature / question / other (which button the sender picked)
--   context  — the precise edit surface open when the note was written
--              (e.g. "עריכת חוזה", "מסלול משכנתא"), captured from the open modal/sheet.
-- Both nullable, so existing rows and any older client keep working unchanged.
alter table feedback add column if not exists category text;
alter table feedback add column if not exists context text;
