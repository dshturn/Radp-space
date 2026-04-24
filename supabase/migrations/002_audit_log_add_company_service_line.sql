-- Add company and service_line to audit_log for role-based filtering
alter table audit_log add column company text;
alter table audit_log add column service_line text;

-- Update RLS policy to allow non-admins to read audit_log from their company/service_line
drop policy if exists "contractors read own audit_log" on audit_log;

create policy "contractors read company audit_log"
  on audit_log for select
  using (
    exists (
      select 1 from user_profiles
      where id = auth.uid()
        and status = 'approved'
        and (
          audit_log.company = user_profiles.company
          and audit_log.service_line = user_profiles.service_line
        )
    )
  );
