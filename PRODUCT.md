# Produto: Du Inglês

## Fatos observados

O repositório implementa uma plataforma de ensino e gestão de inglês. A página
pública descreve aulas ao vivo, nivelamento CEFR A1–C2 e período de teste de
sete dias antes da primeira cobrança. O produto inclui áreas autenticadas para
alunos, professores e administradores.

As rotas atuais incluem cadastro e autenticação; turmas, agenda e sessões ao
vivo; tarefas e envios; biblioteca, planos de aula e progresso; mensagens;
alunos, usuários, cursos, relatórios, financeiro, auditoria e operações LGPD.
Há integrações opcionais com Stripe e Google Agenda/Meet.

## Limites e incertezas

- Não há documento de produto anterior nem definição explícita de MVP ou
  roadmap; este arquivo não inventa prioridades futuras.
- A presença de uma rota, integração ou configuração não prova que ela esteja
  habilitada em produção nem que o fluxo comercial esteja operacional.
- O projeto tem rotas e rotinas relacionadas a LGPD; isso não constitui
  declaração de conformidade legal.
- Público, políticas comerciais, métricas de sucesso e requisitos de retenção
  devem ser confirmados pelo responsável pelo produto antes de alterações que
  os afetem.

## Critérios para mudanças

Cada solicitação deve definir o resultado verificável e preservar os contratos
de autenticação, papéis, isolamento por organização/turma, dados dos alunos e
regras de acesso existentes. Para alterações comportamentais, documentar
aceite e cobrir o caminho e a falha relevantes com testes existentes ou novos.
Mudanças de produto, política, cobrança ou tratamento de dados que não estejam
claras ficam como decisão pendente, não como pressuposto técnico.
