-- Onboarding now stores the mortgage approval and personal/supplementary loan docs
-- that were previously only used for AI extraction and then dropped. Add document_type
-- values so they group under their own sections in the Documents screen.
-- (ADD VALUE is safe outside a txn block on PG12+; IF NOT EXISTS makes it idempotent.)
alter type document_type add value if not exists 'mortgage_statement';
alter type document_type add value if not exists 'loan_statement';
