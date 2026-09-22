-- A integração com o Google Agenda é tratada com base no consentimento
-- (política de privacidade, art. 7º I). Conectar grava `granted = true`;
-- desconectar grava `granted = false` — mesma trilha dos demais aceites.

alter table public.consent_records
  drop constraint if exists consent_records_purpose_check;

alter table public.consent_records
  add constraint consent_records_purpose_check
  check (purpose in (
    'cookies', 'contact_form', 'trial_class', 'terms_and_privacy', 'google_calendar'
  ));
