-- Land-registry extract ("נסח טאבו") gets its own document_type so it groups
-- under its own section in the Documents screen, alongside purchase contract,
-- mortgage and insurance (issue #14: owners want a checklist of the key
-- property documents and to see what's still missing).
-- (ADD VALUE is safe outside a txn block on PG12+; IF NOT EXISTS makes it idempotent.)
alter type document_type add value if not exists 'tabu_extract';
