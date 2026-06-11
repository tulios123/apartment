alter table contracts add column payment_method text;
alter table contracts add column requires_approval boolean not null default false;
