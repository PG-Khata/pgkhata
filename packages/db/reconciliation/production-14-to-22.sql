-- REVIEW ONLY. Do not execute until the production reconciliation is approved.
begin;
select pg_advisory_xact_lock(1948207413);

do $$
declare
  recorded_count integer;
  last_recorded bigint;
begin
  select count(*), max(created_at)
    into recorded_count, last_recorded
    from drizzle.__drizzle_migrations;

  if recorded_count <> 14 or last_recorded <> 1788146006929 then
    raise exception 'Expected exactly migrations 0000-0013; found count %, last %',
      recorded_count, last_recorded;
  end if;

  if exists (
    select access_token from bill group by access_token having count(*) > 1
  ) then
    raise exception 'bill.access_token contains duplicates';
  end if;

  if exists (
    select 1 from bill_delivery d left join bill b on b.id = d.bill_id where b.id is null
  ) then
    raise exception 'bill_delivery contains orphan bill_id values';
  end if;
end $$;

alter table bill
  add constraint bill_access_token_unique
  unique using index bill_access_token_unique;
alter table bill_delivery
  add constraint bill_delivery_bill_id_bill_id_fk
  foreign key (bill_id) references bill(id) on delete cascade;

insert into drizzle.__drizzle_migrations (hash, created_at) values
  ('b0374c6a10d46a796d3cc7dcc36522d254fab36bd281343d71a495c0665b3d5c', 1788147801127),
  ('596604f785465ddbd800405ab95a5ad70620dc6871b8b335ca657de14be9412e', 1788148761110),
  ('1f76c75d3a9b0d311b42ce671c12515ce0453f9b743862ce6553e509a20d3613', 1788332752969),
  ('2fdc211441c52a8f232d46f1816cfac09eaf20e4b9e696bdb294671e3b1c66bd', 1788428325702),
  ('f94f0f25664cf0f15ae5ab64b930e3e3250c2854215a151cff704add4387f739', 1788429367478),
  ('4b7cc4974d50d62351ac042c698e12d5468fa4e65e9edf1274c5e677020d2e3a', 1788429547511),
  ('5566e29b9f9fe15154e3722610514f00eb7e0b277f23e8a44b1bad338dd0709a', 1788431272633),
  ('adc44b0ac11e19f2de79876326d0c243cd2fb44a0686c7392c14ae3bc0fc1057', 1788721499236),
  ('d10b763567e5bcfb4cbbdb0dd9a016fce8e88c1d4dd4eae7fb5b61739b0e675a', 1788860000000);

do $$
begin
  if (select count(*) from drizzle.__drizzle_migrations) <> 23 then
    raise exception 'Expected 23 migration records after reconciliation';
  end if;
end $$;

commit;
