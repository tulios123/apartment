-- Loans gain an interest-type like mortgage tracks (prime / fixed / variable / linked).
-- annual_rate stays the effective rate driving the Shpitzer schedule; track_type is
-- descriptive (mirrors how LiabilitiesV2 stores mortgage tracks as a flat effective rate).
alter table loans add column track_type text;
