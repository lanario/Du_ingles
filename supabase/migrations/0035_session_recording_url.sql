-- Link da gravação da aula.
--
-- O Google Meet grava no Drive de quem gravou, não na plataforma. Enquanto
-- não existir a integração que traz o arquivo para um bucket nosso, o
-- professor cola aqui o link que o Meet gerou — é o suficiente para o aluno
-- que faltou assistir à aula, que é o problema real.
--
-- Fica em `class_sessions` (e não numa tabela à parte) porque é um atributo
-- da aula, um por aula: as políticas de leitura que já existem valem para a
-- coluna nova sem nenhuma linha a mais. Em especial
-- `class_sessions_select_student`, que só entrega aula publicada de turma em
-- que o aluno está matriculado — o link não vaza para fora da turma.

alter table public.class_sessions
  add column if not exists recording_url text;

comment on column public.class_sessions.recording_url is
  'Link externo da gravação (Google Meet/Drive). NULL = sem gravação.';

-- Só `https`, e com tamanho de URL plausível. A validação de verdade é a do
-- Zod na action; isto é a rede de segurança do banco, que impede um
-- `javascript:` de chegar à coluna por qualquer outro caminho de escrita.
alter table public.class_sessions
  drop constraint if exists class_sessions_recording_url_https;

alter table public.class_sessions
  add constraint class_sessions_recording_url_https
  check (
    recording_url is null
    or (recording_url ~ '^https://' and length(recording_url) between 12 and 2048)
  );
