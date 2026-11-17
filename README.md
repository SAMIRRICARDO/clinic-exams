# Clínica Drtis — Agendamento de exames e acesso a laudos

Aplicação web simplificada para uma clínica: a equipe agenda exames, cadastra e publica
laudos; o paciente consulta apenas os seus próprios agendamentos e os laudos **publicados**
dos seus exames.

Desafio técnico entregue para a clínica Drtis.

> **Sobre o vive coding:** o requisito de vive coding não é atendido por um artefato de
> código — ele pressupõe uma sessão ao vivo. O código aqui está organizado para sustentá-la:
> o backend é pequeno e legível, as regras de negócio ficam isoladas em `src/services/`
> (cada uma com o comentário da regra que implementa), a migration inicial já traz o
> índice único parcial comentado, e a suíte de testes pode ser executada incrementalmente
> (`npm test -- -t "CENARIO 1"`) para demonstrar cada cenário sob demanda.

---

## 1. Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + React Router |
| Backend | Node.js + TypeScript + Fastify + Zod |
| Banco | PostgreSQL 15 + Prisma ORM |
| Autenticação | JWT (HS256) + bcrypt |
| Testes | Vitest (integração via `app.inject`) |

---

## 2. Estrutura do repositório

```
clinic-exams/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # modelo de dados
│   │   └── migrations/            # migration inicial (inclui o índice único parcial)
│   ├── src/
│   │   ├── config.ts              # validação das variáveis de ambiente
│   │   ├── db.ts                  # PrismaClient
│   │   ├── auth.ts                # hash de senha e assinatura/validação do JWT
│   │   ├── http.ts                # autenticação e autorização por perfil
│   │   ├── time.ts                # utilitários de fuso horário da clínica
│   │   ├── services/
│   │   │   ├── appointments.ts    # regras de agendamento e concorrência
│   │   │   └── reports.ts         # regras de laudo e visibilidade
│   │   ├── routes/                # auth, appointments, reports, patient
│   │   ├── app.ts                 # montagem do Fastify e tratamento de erros
│   │   ├── server.ts              # bootstrap
│   │   └── seed.ts                # dados fictícios e contas de demonstração
│   └── tests/                     # 5 cenários obrigatórios + unitários
└── frontend/
    └── src/
        ├── api.ts                 # cliente HTTP tipado
        ├── auth.tsx               # contexto de sessão
        ├── format.ts              # formatação de datas no fuso da clínica
        ├── components/            # layout e componentes de UI
        └── pages/                 # login, agenda, laudos, portal do paciente
```

---

## 3. Instalação e execução

### Pré-requisitos
- Node.js 20+
- PostgreSQL 14+ em execução

### 3.1 Banco de dados

```bash
# Cria o usuário e os bancos (dev e teste)
sudo -u postgres psql -c "CREATE ROLE clinic LOGIN PASSWORD 'clinic' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE clinic_exams OWNER clinic;"
sudo -u postgres psql -c "CREATE DATABASE clinic_exams_test OWNER clinic;"
```

### 3.2 Backend

```bash
cd backend
cp .env.example .env          # ajuste DATABASE_URL e JWT_SECRET se necessário
npm install
npx prisma generate
npx prisma migrate deploy     # cria as tabelas e o índice único parcial
npm run seed                  # carrega dados fictícios e contas de demonstração
npm run dev                   # API em http://localhost:3333
```

### 3.3 Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                   # interface em http://localhost:5173
```

O Vite faz proxy de `/api` para `http://localhost:3333`, então não é preciso configurar CORS
em desenvolvimento.

---

## 4. Contas de demonstração

Senha única para todas: **`demo1234`**

| Perfil | E-mail | Observação |
|---|---|---|
| Equipe da clínica | `staff@clinica.com` | agenda, cancela, cria e publica laudos |
| Paciente | `ana.souza@email.com` | possui um laudo **publicado** (Raio-X) |
| Paciente | `bruno.lima@email.com` | possui um laudo em **rascunho** (não visível) |
| Paciente | `carla.mendes@email.com` | possui agendamento **sem laudo** |

---

## 5. Testes automatizados

```bash
cd backend
npm test          # executa toda a suíte (Vitest)
```

A suíte usa um banco dedicado (`TEST_DATABASE_URL`), recriado automaticamente a cada
execução (`prisma migrate reset`), sem tocar no banco de desenvolvimento.

### Cenários obrigatórios cobertos

| # | Cenário | Arquivo |
|---|---|---|
| 1 | Duas tentativas **simultâneas** no mesmo horário — só uma aceita | `tests/concurrency.test.ts` |
| 2 | Paciente tentando ler laudo de outro paciente — negado (404) | `tests/reports.test.ts` |
| 3 | Paciente tentando acessar rascunho — conteúdo indisponível (404) | `tests/reports.test.ts` |
| 4 | Laudo publicado fica disponível para o paciente correto | `tests/reports.test.ts` |
| 5 | Agendamento no passado é rejeitado (422) | `tests/appointments.test.ts` |

Além destes: autenticação e autorização por perfil, reutilização de horário cancelado,
bloqueio de cancelamento com laudo publicado, bloqueio de laudo em agendamento cancelado,
um laudo por agendamento, laudo publicado não editável, filtros de listagem e testes
unitários de fuso horário e grade de 30 minutos.

---

## 6. Variáveis de ambiente

Arquivos de exemplo (sem segredos reais): `backend/.env.example` e `frontend/.env.example`.

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | conexão com o PostgreSQL de desenvolvimento |
| `TEST_DATABASE_URL` | banco exclusivo dos testes (recriado a cada execução) |
| `JWT_SECRET` | segredo de assinatura do token |
| `JWT_EXPIRES_IN` | validade do token (padrão `8h`) |
| `PORT` | porta da API (padrão `3333`) |
| `CORS_ORIGIN` | origens permitidas (padrão `http://localhost:5173`) |
| `CLINIC_TIMEZONE` | fuso da clínica (padrão `America/Sao_Paulo`) |

---

## 7. Decisões técnicas

### 7.1 Concorrência no agendamento — a decisão central

O requisito "não permitir dois agendamentos ativos no mesmo horário" é um problema de
concorrência: duas requisições simultâneas podem passar por uma checagem em memória antes
que qualquer uma grave. Uma verificação `SELECT` seguida de `INSERT` não é suficiente.

A garantia está no **banco**, com um **índice único parcial**:

```sql
CREATE UNIQUE INDEX "Appointment_active_slot_unique"
    ON "Appointment"("scheduledAt")
    WHERE "status" = 'ACTIVE';
```

- É **único** → duas linhas `ACTIVE` no mesmo `scheduledAt` são impossíveis, mesmo sob
  concorrência real. A segunda transação falha e é traduzida em `409 SLOT_TAKEN`.
- É **parcial** (`WHERE status = 'ACTIVE'`) → agendamentos cancelados não ocupam o horário,
  o que implementa a regra de reutilizar o slot cancelado sem código extra.

A checagem em memória continua existindo, mas apenas para devolver uma mensagem amigável no
caso comum; ela **não** é a garantia.

### 7.2 Fuso horário

- **Fuso adotado: `America/Sao_Paulo` (UTC-3).**
- Persistência em **UTC** (`TIMESTAMPTZ`) — evita ambiguidade e funciona em qualquer host.
- Conversão para o fuso da clínica **na borda**: ao gerar a grade de horários e ao formatar
  as respostas (o campo `scheduledAtIso` sai com offset explícito, ex.:
  `2026-12-01T09:00:00-03:00`).
- O frontend formata sempre no mesmo fuso via `Intl.DateTimeFormat` com
  `timeZone: 'America/Sao_Paulo'`, então a hora exibida é idêntica em qualquer máquina.
- A conversão local→UTC usa duas passadas de `Intl` para resolver o offset corretamente.

### 7.3 Autorização no backend

A autorização é **sempre** verificada no servidor, inclusive em chamadas diretas à API:

- `authenticate` valida o Bearer token em toda rota protegida.
- `requireStaff` / `requirePatient` restringem por perfil.
- O portal do paciente **nunca** recebe um id de paciente na URL: o `patientId` é resolvido
a partir do token (`ctx.user.sub`), então um paciente não consegue pedir os dados de outro
mesmo manipulando a requisição.
- Acesso indevido a laudo responde **404** (e não 403) para não revelar a existência do
  recurso de outro paciente.

### 7.4 Um laudo por agendamento

`Report.appointmentId` é `@unique`, e o endpoint de escrita é um **upsert** (`PUT
/appointments/:id/report`): cria o rascunho na primeira chamada e atualiza nas seguintes.
Um segundo laudo para o mesmo agendamento é impossível por construção.

### 7.5 Modelo de dados

- `User` (credenciais + perfil) separado de `Patient` (dados clínicos/administrativos).
- `Appointment` referencia paciente, tipo de exame e o usuário da equipe que agendou.
- `Report` 1:1 com `Appointment`, com `status` (`DRAFT`/`PUBLISHED`) e `publishedAt`.
- Enum `Role` (`STAFF`/`PATIENT`) e `AppointmentStatus` (`ACTIVE`/`CANCELLED`).

---

## 8. Limitações

- **Sem cadastro de pacientes pela interface.** O seed cria os pacientes; a clínica
  seleciona entre eles. Um CRUD de pacientes ficaria fora do escopo mínimo.
- **Sem recuperação de senha / refresh token.** O token expira em 8h e o usuário faz login
  novamente.
- **Sem paginação** nas listagens — adequado ao volume do exercício, não a produção.
- **Sem rate limiting / bloqueio por tentativas** no login.
- **Laudos em texto puro.** Não há PDF, anexos, assinatura digital nem validação de conteúdo
  clínico (explicitamente fora do escopo do desafio).
- **Agenda limitada à grade fixa 08:00–18:00**, 20 slots de 30 min por dia, sem feriados,
  fins de semana ou bloqueios de agenda.
- **Um único profissional responsável por laudo** (campo de texto livre, sem vínculo com
  usuário do sistema).

---

## 9. Pendências

- Cadastro/edição de pacientes e de tipos de exame pela interface.
- Reagendamento (hoje só cancelar e criar de novo).
- Auditoria de quem publicou/cancelou e quando.
- Teste end-to-end no navegador (Playwright/Cypress) cobrindo o fluxo completo de UI.
- Pipeline de CI executando `typecheck`, `test` e `build`.
- Docker Compose para subir banco + API + frontend com um comando.

---

## 10. Tempo aproximado dedicado

| Etapa | Tempo |
|---|---|
| Leitura do desafio e modelagem de dados | ~1h |
| Backend: auth, agendamento, laudos, regras | ~5h |
| Migration, índice único parcial e seed | ~1,5h |
| Testes (5 cenários + unitários) | ~4h |
| Frontend: design system, agenda, laudos, portal | ~9h |
| Documentação e ajustes finais | ~2h |
| **Total** | **~22,5h** |

---

## 11. Referência rápida da API

| Método | Rota | Perfil | Descrição |
|---|---|---|---|
| POST | `/auth/login` | público | autentica e devolve o token |
| GET | `/auth/me` | autenticado | usuário da sessão |
| GET | `/patients` | equipe | lista pacientes |
| GET | `/exam-types` | autenticado | lista tipos de exame |
| GET | `/appointments/availability?date=YYYY-MM-DD` | equipe | grade do dia |
| GET | `/appointments?date=&patientId=&status=` | equipe | lista/filtra agendamentos |
| POST | `/appointments` | equipe | cria agendamento |
| POST | `/appointments/:id/cancel` | equipe | cancela agendamento |
| PUT | `/appointments/:id/report` | equipe | cria/atualiza rascunho |
| GET | `/reports` | equipe | lista laudos (inclui rascunhos) |
| GET | `/reports/:id` | equipe | lê laudo (inclusive rascunho) |
| POST | `/reports/:id/publish` | equipe | publica laudo |
| GET | `/me/appointments` | paciente | seus agendamentos |
| GET | `/me/reports` | paciente | seus laudos publicados |
| GET | `/me/reports/:id` | paciente | lê um laudo publicado próprio |

---

Desafio entregue a **jihan@drtis.com.br** e **antonio.diaz@drtis.com.br**.
