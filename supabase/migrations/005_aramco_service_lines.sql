-- Aramco users are identified by role (operations/assessor). Their company
-- is always 'Aramco' and their service_line comes from a filtered list
-- (currently just NAWCOD, extensible by registration).

-- Drop the unused aramco_username column — role + company='Aramco' identify them.
alter table user_profiles drop column if exists aramco_username;

-- Flag service lines as Aramco-internal so the register form can show the
-- right list per role. Existing rows default to false (contractor-visible).
alter table service_lines add column if not exists is_aramco boolean not null default false;

-- Seed NAWCOD as the first Aramco service line.
insert into service_lines (name, is_aramco)
  select 'NAWCOD', true
  where not exists (select 1 from service_lines where name = 'NAWCOD');
update service_lines set is_aramco = true where name = 'NAWCOD' and not is_aramco;

-- Ensure an 'Aramco' company row exists so operations/assessor registrations
-- point to a real company record.
insert into companies (name)
  select 'Aramco'
  where not exists (select 1 from companies where name = 'Aramco');
