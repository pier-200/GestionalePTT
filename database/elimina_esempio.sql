-- Elimina gli account e i dati della situazione esempio caricata con scripts/semina-supabase.mjs --esempio.
-- Eseguire nel SQL Editor di Supabase prima dell'uso reale. Non tocca gli account creati dal Training Manager.

begin;
-- registrazioni, personal data e training data degli account esempio
delete from auth.users where raw_user_meta_data ->> 'esempio' = 'true';
-- istruttori dell'esempio non più usati da alcuna registrazione e non collegati ad account
delete from public.istruttori i
where i.created_at < '2026-07-02'
  and not exists (select 1 from public.registrazioni r where r.instructor_id = i.id)
  and not exists (select 1 from public.profili p where p.istruttore_id = i.id);
commit;
