# Du Inglês — Reel Instagram v2 (NOTE)

final.mp4: 1080x1920, 30 fps, 33 s, h264 + AAC, grain 0.03. Áudio: efeitos sonoros em cada movimento; música pode ser somada pelo Instagram.

## A ideia
Documentário de UI de um caso só: o objetivo do aluno ("Entrevista de emprego em inglês") atravessa o sistema —
cadastro, nível CEFR, área do aluno, agenda, aula com o professor, tarefas, correção comentada, "Objetivo concluído".
Dourado = o que é seu.

## Beats (s)
1 0–3.2 hook: "Qual é o seu objetivo?" + campo "Objetivo das aulas" digitando.
2 3.2–6.6 CEFR: órbita A1–C2, B2 acende, câmera mergulha no B2.
3 6.6–12.2 painel: o B2 vira "Nível atual B2" da Área do aluno ("Olá, Alan"), KPIs contam; menu lateral entra e o cursor clica "Agenda".
4 12.2–16.7 agenda: semana 26–29/out se preenche com as aulas; clique em "Speaking: Job Interviews" abre o detalhe; mergulho no detalhe.
5 16.7–20.7 professor: card "Próxima aula" + Prof. Lucas ao vivo; whip para cima.
6 20.7–24.1 tarefas: lista "A fazer / Corrigidas"; clique em "Present Perfect Practice 9,4/10".
7 24.1–28.1 correção: "I work → have worked here since 2019" + comentário.
8 28.1–30.8 "Objetivo concluído" empurra "Novo objetivo de aprendizado".
9 30.8–33 CTA: logo, "Fale com a gente e comece a falar inglês essa semana.", cursor aperta "EXPERIMENTE POR 7 DIAS".

## Real x fictício
Real (layout/textos de UI): logo, Geist, cores, órbita CEFR, telas Área do aluno, menu lateral, Agenda (semana, popover), Tarefas,
rótulos ("Próxima aula", "O link do Google Meet é liberado 30 minutos antes da aula.", "Responda aqui mesmo..."), notificações de objetivo,
frase final e botão do site — rebuild em HTML das telas enviadas. Professor: Prof. Lucas (Lucas Pereira), foto e card como registrados na plataforma.
Fictício: aluno Alan, todos os horários/datas, aulas da agenda, nomes e notas
das tarefas, KPIs (24 aulas, 92 %, 9,4), a correção e "há 3 meses".

## Gates (números dos scripts)
- G0 PASS: 33.00 s = esperado; sem áudio (não planejado).
- G2 PASS: nenhuma sequência > 3 frames planos; nenhum trecho congelado ≥ 0.6 s.
- G3 PASS: end hold 0.30 s (termina no aperto do botão); plano final 2.20 s = 7 %.
- G5 PASS (lint.mjs); V3 WARN: pílulas "Ao vivo"/"Live"/ponto da agenda — UI real, mantidas.
- G1 (por olho): texto de UI principal 0.024–0.034 H; eventos da grade da agenda menores (~0.013 H) — a leitura vem do popover ampliado.
- G4 (por olho): um herói por frame.
- MOTION 3.1/255, abaixo da faixa humana (4.4–9.8): filme calmo; maior trecho quase parado 28.9–30.4 s (leitura da notificação).

## Som
SFX sintetizados (numpy, sem ElevenLabs), colocados nos eventos do render (final.mp4.events.json) por source/tools/sfx.py:
whoosh chegando em cada corte + ataque grave no frame do corte, whip no menu e no pan, thump nos snaps de câmera, clique em cada
press do cursor, teclas na digitação, ticks nos contadores e nas palavras subindo, pops nos cards/eventos da agenda/nós CEFR,
ding no B2, chime em "Objetivo concluído", impacto no logo; camada de ar contínua baixa que cresce em cada corte.
look.py: -17.1 LUFS, true peak -1.6 dBFS, LRA 9.2, áudio 100 % do filme, sem dropouts; 8 de 13 cortes com ataque a ±80 ms
(todos os 8 cortes do filme). Nível deixado abaixo de -14 para caber música do Instagram por cima.

## Ainda melhoraria
Música própria composta aos cortes, eventos da agenda maiores (mostrar 3 dias), um pouco mais de energia no beat 8.
