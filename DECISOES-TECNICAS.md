# Decisões técnicas, limitações e pendências

> Este documento acompanha o repositório como registro do raciocínio por trás das
escolhas. O resumo está no `README.md`; aqui o detalhamento.

## 1. Decisões técnicas

### 1.1 A regra de concorrência é resolvida no banco, não na aplicação

**Problema.** "Não permitir dois agendamentos ativos no mesmo horário" precisa valer mesmo
quando duas requisições chegam ao mesmo tempo. Uma checagem `SELECT` antes do `INSERT` cria
uma janela de corrida: ambas as requisições leem "horário livre" e ambas gravam.

**Decisão.** Índice único **parcial** no PostgreSQL:

```sql
CREATE UNIQUE INDEX "Appointment_active_slot_unique"
    ON "Appointment"("scheduledAt")
    WHERE "status" = 'ACTIVE';
```

**Por que parcial.** A cláusula `WHERE status = 'ACTIVE'` faz com que apenas agendamentos
ativos disputem o horário. Isso resolve **duas** regras com um único mecanismo:
1. dois agendamentos ativos no mesmo horário são impossíveis;
2. o horário de um agendamento cancelado volta a ficar livre (reutilização), sem nenhum
   código adicional de "liberar slot".

**Tratamento.** A violação chega ao Prisma como `P2002` e é traduzida em `409 SLOT_TAKEN`.
A checagem em memória permanece apenas como caminho rápido para a mensagem amigável.

**Teste que prova.** `tests/concurrency.test.ts` dispara duas requisições com `Promise.all`
e verifica que exatamente uma recebe `201` e a outra `409`, e que há **uma** linha ativa no
banco. A saída do teste mostra a violação de constraint — é justamente a prova de que a
barreira está no banco.

### 1.2 Fuso horário

- Fuso adotado: **`America/Sao_Paulo` (UTC-3)**, documentado em `.env`
  (`CLINIC_TIMEZONE`) e no `README`.
- Persistência em **UTC** (`TIMESTAMPTZ`): sem ambiguidade e independente do host.
- Conversão local→UTC e UTC→local isoladas em `src/time.ts`, com `Intl.DateTimeFormat`.
  A conversão local→UTC faz **duas passadas** para acertar o offset mesmo em transições de
  horário de verão (o Brasil não usa DST desde 2019, mas o código não assume isso).
- A API devolve `scheduledAt` (UTC ISO) **e** `scheduledAtIso` (com offset da clínica).
- O frontend formata sempre com `timeZone: 'America/Sao_Paulo'`, então a hora exibida é a
  mesma em qualquer máquina.

### 1.3 Autenticação e autorização

- JWT assinado com HS256; payload enxuto (`sub`, `role`, `email`, `name`).
- Senhas com **bcrypt** (custo 10).
- Login devolve mensagem genérica (não revela se o e-mail existe).
- Autorização por perfil em `preHandler` (`requireStaff` / `requirePatient`).
- **Escopo por token**: as rotas do paciente resolvem o `patientId` a partir do `sub` do
  token. Não existe rota em que o paciente informe de quem quer ver os dados — o que elimina
  a classe inteira de falhas de "IDOR".
- Acesso indevido responde **404** para não confirmar a existência do recurso alheio.

### 1.4 Um laudo por agendamento

- `Report.appointmentId` é `@unique`.
- Escrita via `PUT /appointments/:id/report` (upsert): cria na primeira chamada, atualiza
  nas seguintes. Não existe rota de "criar segundo laudo".

### 1.5 Separação `User` × `Patient`

Credenciais e perfil (`User`) ficam separados dos dados administrativos do paciente
(`Patient`, com documento e data de nascimento). Isso permite, no futuro, um paciente ter
acesso sem duplicar dados, e a equipe existir sem ser paciente.

### 1.6 Por que Fastify

Leve, com validação por schema, `inject()` nativo para testes de integração sem abrir porta
de rede (o que torna a suíte rápida e determinística) e tratamento de erros centralizado.

---

## 2. Limitações conhecidas

1. **Sem CRUD de pacientes/tipos de exame na interface** — os dados vêm do seed.
2. **Sem paginação** nas listagens.
3. **Sem refresh token / recuperação de senha** — sessão de 8h.
4. **Sem rate limiting** no login.
5. **Laudos em texto puro** — sem PDF, anexos, assinatura digital ou validação clínica
   (fora do escopo declarado).
6. **Grade fixa 08:00–18:00**, 30 min por slot, sem feriados/fins de semana/bloqueios.
7. **Profissional responsável é texto livre**, sem vínculo com usuário do sistema.
8. **Testes cobrem a API, não a UI** — não há teste end-to-end de navegador.

---

## 3. Pendências (próximos passos)

| Item | Prioridade |
|---|---|
| CRUD de pacientes e tipos de exame | alta |
| Reagendamento de exame | média |
| Auditoria (quem publicou/cancelou, quando) | média |
| Teste E2E de navegador (Playwright) | média |
| CI (typecheck + test + build) | média |
| Docker Compose (banco + API + frontend) | baixa |
| Paginação e rate limiting | baixa |

---

## 4. Tempo dedicado

| Etapa | Tempo aproximado |
|---|---|
| Análise do desafio e modelagem | 1h |
| Backend (auth, agendamento, laudos, regras) | 5h |
| Migration, índice único parcial e seed | 1,5h |
| Testes automatizados | 4h |
| Frontend (design system, agenda, laudos, portal) | 9h |
| Documentação e ajustes | 2h |
| **Total** | **~22,5h** |
