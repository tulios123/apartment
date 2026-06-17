-- Supplementary loans become Shpitzer (amortizing) loans: the user enters an
-- annual interest rate, and the monthly payment / interest schedule is derived.
-- We no longer store a fixed monthly_payment.
alter table loans add column annual_rate numeric(6,3);
alter table loans drop column monthly_payment;
