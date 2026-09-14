-- Prazo de tarefa: conserto dos prazos que nasceram um dia mais cedo.
--
-- O formulário manda um dia (`yyyy-mm-dd`) e `assignments.due_at` é
-- `timestamptz`. Sem ninguém decidir a hora, o Postgres ancorava a string em
-- MEIA-NOITE UTC — que em São Paulo (UTC-3) é 21h do dia ANTERIOR. Prazo
-- marcado para 15/09 chegava ao aluno como 14/09, e a tarefa já entrava em
-- atraso às 21h da véspera.
--
-- A partir de agora a conversão acontece na aplicação (`lib/assignments/
-- due-date.ts`), que ancora o prazo no FIM do dia escolhido, no fuso da
-- escola. Esta migration reancora as linhas antigas do mesmo jeito.
--
-- O filtro por meia-noite UTC é o que identifica uma linha escrita pelo
-- caminho antigo: prazo gravado pela aplicação nova cai às 02:59:59Z (ou
-- 03:59:59Z em horário de verão de fusos futuros) e fica de fora.

update public.assignments
set due_at =
  (((due_at at time zone 'UTC')::date + time '23:59:59') at time zone 'America/Sao_Paulo')
where due_at is not null
  and (due_at at time zone 'UTC')::time = time '00:00:00';
