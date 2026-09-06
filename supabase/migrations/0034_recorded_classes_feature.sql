-- Gravação das aulas passa a ser benefício de TODOS os níveis.
--
-- O catálogo é gerado por `buildTierCatalogSeeds()` (src/lib/plans/tier-catalog.ts),
-- mas `ensureTierCatalog` só cria o que falta — nunca reescreve linha existente.
-- Sem este backfill, o benefício novo apareceria na vitrine pública (que lê a
-- constante) e não na vitrine do aluno (que lê `student_plans.features`).
--
-- Idempotente: a linha só é tocada se ainda não tiver a frase. O item entra na
-- 4ª posição para acompanhar a ordem da constante — é o recorte que a landing
-- mostra (`slice(0, 4)`).

update public.student_plans
set features = (
      case
        when jsonb_array_length(features) >= 3
          then (
            (select jsonb_agg(item order by ord)
               from jsonb_array_elements(features) with ordinality as t(item, ord)
              where ord <= 3)
            || jsonb_build_array('Aulas gravadas, disponíveis na biblioteca da turma'::text)
            || coalesce(
                 (select jsonb_agg(item order by ord)
                    from jsonb_array_elements(features) with ordinality as t(item, ord)
                   where ord > 3),
                 '[]'::jsonb)
          )
        else features || jsonb_build_array('Aulas gravadas, disponíveis na biblioteca da turma'::text)
      end
    ),
    updated_at = now()
where tier is not null
  and not (features @> '["Aulas gravadas, disponíveis na biblioteca da turma"]'::jsonb);
