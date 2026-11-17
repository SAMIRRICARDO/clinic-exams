# Clinic Exams

Sistema de agendamento de exames e disponibilização de laudos, desenvolvido como demonstração de Engenharia de Software Full Stack, com foco em segurança, regras de negócio, concorrência e integridade de dados.

A equipe da clínica agenda exames, consulta e filtra agendamentos, cancela horários, cadastra laudos como rascunho e os publica. O paciente consulta apenas os seus próprios agendamentos e os laudos **publicados** dos seus exames.

> Projeto entregue como desafio técnico para a Clínica Drtis.

## Autor

**Samir Ricardo de Oliveira Almeida** — **Engenheiro de Software & IA | Arquiteto de Software**

Criador do **VRAXIA System** e **VRAXIA Work**.

**Python • RAG • Multi-Agents • Cloud • Sistemas Escaláveis**

---

## Engineering Focus

Competências demonstradas na implementação:

- **Arquitetura Full Stack** — frontend SPA, API REST e persistência relacional separados por responsabilidade.
- **React + TypeScript** — interface com rotas por perfil, estados de carregamento, vazio e erro.
- **Node.js + TypeScript** — API com contratos explícitos e validação de entrada.
- **Fastify** — rotas, tratamento centralizado de erros e parsing de JSON.
- **PostgreSQL + Prisma** — persistência em UTC, migrations e constraints no banco.
- **Autenticação e autorização** — JWT HS256 + bcrypt; role revalidada no banco a cada requisição.
- **RBAC** — perfis `STAFF` e `PATIENT`.
- **Prevenção de IDOR** — `patientId` resolvido pelo token; acesso alheio responde `404`.
- **Integridade de dados** — unicidade de horário ativo, um laudo por agendamento, transações.
- **Concorrência em agendamentos** — índice único parcial no banco como garantia final.
- **Transações e locks** — `SELECT ... FOR UPDATE` serializa cancelamento, publicação e escrita de laudo.
- **Timezone consistente** — `CLINIC_TIMEZONE` validado no backend e consumido pelo frontend via `GET /health`.
- **Máquina de estados para laudos** — `DRAFT` → `PUBLISHED`, com regras explícitas de transição.
- **Imutabilidade de laudos publicados** — publicado não pode ser editado.
- **Validação de entrada** — Zod em todas as rotas com payload.
- **Testes automatizados** — Vitest, 53 testes, incluindo os 5 cenários obrigatórios do desafio.

---

## Vibe Coding

Vibe Coding foi utilizado como acelerador de desenvolvimento, não como substituto da engenharia. As implementações foram revisadas e submetidas à validação das regras de negócio, segurança, concorrência, integração e testes automatizados.

O requisito de *Vibe Coding* do desafio pressupõe uma sessão ao vivo; ele não é atendido por um artefato de código. O repositório está organizado para sustentar essa sessão: o backend é pequeno e legível, as regras de negócio ficam isoladas em `src/services/`, cada uma com o comentário da regra que implementa, a migration inicial já traz o índice único parcial comentado, e a suíte pode ser executada incrementalmente (`npm test -- -t "CENARIO 1"`) para demonstrar cada cenário sob demanda.

### Validação real durante o desenvolvimento

Durante a validação da integração frontend/backend foi identificado um problema concreto:

- o cliente HTTP enviava `Content-Type: application/json` mesmo em requisições sem corpo;
- o Fastify rejeitava essas requisições com `Body cannot be empty when content-type is set to 'application/json'`;
- o comportamento foi reproduzido em nível HTTP, comparando a mesma rota com e sem o header;
- a correção foi centralizada no cliente HTTP (`frontend/src/api.ts`), passando a anunciar JSON somente quando existe corpo;
- a correção foi validada por reprodução em nível HTTP, suíte automatizada existente, typecheck e build.

Isso ilustra o princípio adotado: acelerar a escrita sem dispensar revisão, reprodução e validação de engenharia.

---

## Entrega do desafio

Correspondência objetiva entre os requisitos de entrega e o repositório:

| Requisito | Entrega |
|---|---|
| Código frontend e backend | React + TypeScript / Node.js + TypeScript |
| Instalação e execução | Documentado no README |
| Banco e dados fictícios | PostgreSQL + Prisma + migrations + seed |
| Credenciais de demonstração | Contas STAFF e PATIENT documentadas |
| Testes automatizados | 53 testes |
| Variáveis de ambiente | `.env.example`, sem segredos reais |
| Decisões técnicas | `DECISOES-TECNICAS.md` |
| Limitações e pendências | Documentadas neste README e em `DECISOES-TECNICAS.md` |
| Tempo aproximado | Aproximadamente 22,5 horas |

---

## Arquitetura

```
Frontend React
        ↓
HTTP / JSON
        ↓
Fastify API
        ↓
Services / Business Rules
        ↓
Prisma
        ↓
PostgreSQL
```

As rotas (`backend/src/routes/`) apenas validam entrada e autenticam; as regras de negócio ficam em `backend/src/services/`. O acesso ao banco passa pelo Prisma, com transações e travas quando a operação altera estado. Erros são traduzidos em respostas HTTP consistentes pelo handler centralizado em `app.ts`.

---

## Stack

| Camada | Tecnologia |
|---|---|
| Frontend | React 18 + TypeScript + Vite + React Router |
| Backend | Node.js + TypeScript + Fastify + Zod |
| Banco | PostgreSQL 14+ (validado em PostgreSQL 18) + Prisma ORM |
| Autenticação | JWT (HS256) + bcrypt |
| Testes | Vitest (integração via `app.inject`) |

---

## Estrutura do projeto

```
clinic-exams/
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma          # modelo de dados
│   │   └── migrations/            # migration inicial (inclui o índice único parcial)
│   ├── src/
│   │   ├── config.ts              # validação das variáveis de ambiente
│   │   ├── db.ts                  # PrismaClient e trava de linha (FOR UPDATE)
│   │   ├── auth.ts                # hash de senha e assinatura/validação do JWT
│   │   ├── http.ts                # autenticação, autorização e revalidação do role
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

## Funcionalidades

**Equipe da clínica**

- selecionar paciente cadastrado e tipo de exame;
- informar data e horário pela grade disponível;
- consultar e filtrar agendamentos por data, paciente e situação;
- cancelar agendamento;
- abrir um agendamento, cadastrar/editar rascunho de laudo e publicá-lo.

**Paciente**

- consultar os próprios agendamentos, com tipo de exame, data e situação;
- identificar quais exames possuem laudo publicado (não rascunhos);
- abrir e ler os próprios laudos publicados.

### Referência rápida da API

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

## Regras de negócio

- uma única sala, com horários fixos de 30 minutos, independentemente do tipo de exame;
- grade oficial das 08:00 às 18:00, com último início às 17:30;
- não permitir agendamentos no passado;
- não permitir dois agendamentos ativos no mesmo horário;
- permitir reutilizar o horário de um agendamento cancelado;
- cada agendamento pode ter apenas um laudo;
- rascunhos podem ser editados e ficam disponíveis somente para a clínica;
- laudos publicados ficam disponíveis para o paciente correspondente;
- laudos publicados não podem ser editados;
- agendamentos cancelados não podem receber laudos;
- agendamentos com laudo publicado não podem ser cancelados;
- a data de publicação é registrada;
- datas e horários são exibidos de forma consistente, com o fuso adotado documentado.

`Report.appointmentId` é `@unique`, e o endpoint de escrita é um **upsert** (`PUT /appointments/:id/report`): cria o rascunho na primeira chamada e atualiza nas seguintes. Um segundo laudo para o mesmo agendamento é impossível por construção.

Não é necessário gerar PDF, receber anexos, implementar assinatura digital ou validar o conteúdo clínico — explicitamente fora do escopo do desafio.

---

## Segurança

A autorização é **sempre** verificada no servidor, inclusive em chamadas diretas à API:

- `authenticate` valida o Bearer token em toda rota protegida;
- o role viaja no JWT, mas é revalidado contra o banco em cada requisição;
- `requireStaff` / `requirePatient` restringem por perfil;
- o portal do paciente **nunca** recebe um id de paciente na URL: o `patientId` é resolvido a partir do token (`req.user.sub`), então um paciente não consegue pedir os dados de outro mesmo manipulando a requisição;
- acesso indevido a laudo responde **404** (e não 403) para não revelar a existência do recurso de outro paciente;
- senhas são armazenadas com bcrypt (custo 10) e mensagens de erro de login são genéricas;
- o custo computacional do bcrypt é igualado para e-mails existentes e inexistentes, reduzindo diferenças de comportamento temporal na autenticação;
- `CLINIC_TIMEZONE` é validado como identificador IANA no startup;
- entradas são validadas com Zod e consultas ao banco são parametrizadas via Prisma;
- nenhum segredo real é versionado — apenas `.env.example`.

---

## Concorrência

O requisito "não permitir dois agendamentos ativos no mesmo horário" é um problema de concorrência: duas requisições simultâneas podem passar por uma checagem em memória antes que qualquer uma grave. Uma verificação `SELECT` seguida de `INSERT` não é suficiente.

A garantia está no **banco**, com um **índice único parcial**:

```sql
CREATE UNIQUE INDEX "Appointment_active_slot_unique"
    ON "Appointment"("scheduledAt")
    WHERE "status" = 'ACTIVE';
```

- É **único** → duas linhas `ACTIVE` no mesmo `scheduledAt` são impossíveis, mesmo sob concorrência real. A segunda transação falha e é traduzida em `409 SLOT_TAKEN`.
- É **parcial** (`WHERE status = 'ACTIVE'`) → agendamentos cancelados não ocupam o horário, o que implementa a regra de reutilizar o slot cancelado sem código extra.

A checagem em memória continua existindo, mas apenas para devolver uma mensagem amigável no caso comum; ela **não** é a garantia.

`cancelAppointment`, `publishReport` e `upsertDraftReport` adquirem `SELECT ... FOR UPDATE` sobre a mesma linha de `Appointment` como primeira operação da transação. Isso serializa as três transições de estado e elimina a janela *read → check → write* sem exigir mudança de schema.

---

## Timezone

- **Fuso adotado: `America/Sao_Paulo` (UTC-3).**
- Persistência em **UTC** (`TIMESTAMPTZ`) — evita ambiguidade e funciona em qualquer host.
- Conversão para o fuso da clínica **na borda**: ao gerar a grade de horários e ao formatar as respostas (o campo `scheduledAtIso` sai com offset explícito, ex.: `2026-12-01T09:00:00-03:00`).
- O backend define e valida `CLINIC_TIMEZONE` (identificador IANA); o frontend obtém o fuso via `GET /health` e o usa no `Intl.DateTimeFormat`, com fallback para `America/Sao_Paulo` apenas na inicialização/indisponibilidade do endpoint — a hora exibida é a mesma em qualquer máquina.
- A conversão local→UTC usa duas passadas de `Intl` para resolver o offset corretamente, sem assumir a ausência de horário de verão.

---

## Banco de dados

- `User` (credenciais + perfil) separado de `Patient` (dados clínicos/administrativos).
- `Appointment` referencia paciente, tipo de exame e o usuário da equipe que agendou.
- `Report` 1:1 com `Appointment`, com `status` (`DRAFT`/`PUBLISHED`) e `publishedAt`.
- Enum `Role` (`STAFF`/`PATIENT`) e `AppointmentStatus` (`ACTIVE`/`CANCELLED`).
- `scheduledAt` é `TIMESTAMPTZ(3)`; o índice único parcial e o `@unique` de `Report.appointmentId` formam as garantias de integridade no banco.

---

## Instalação

### Pré-requisitos

- Node.js 20+
- PostgreSQL 14+ em execução

### Preparação do banco

```bash
# Cria o usuário e os bancos (dev e teste)
sudo -u postgres psql -c "CREATE ROLE clinic LOGIN PASSWORD 'clinic' SUPERUSER;"
sudo -u postgres psql -c "CREATE DATABASE clinic_exams OWNER clinic;"
sudo -u postgres psql -c "CREATE DATABASE clinic_exams_test OWNER clinic;"
```

### Backend

```bash
cd backend
cp .env.example .env          # ajuste DATABASE_URL e JWT_SECRET se necessário
npm install
npx prisma generate
npx prisma migrate deploy     # cria as tabelas e o índice único parcial
npm run seed                  # carrega dados fictícios e contas de demonstração
npm run dev                   # API em http://localhost:3333
```

### Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev                   # interface em http://localhost:5173
```

---

## Configuração

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

O Vite faz proxy de `/api` para `http://localhost:3333`, então não é preciso configurar CORS em desenvolvimento.

---

## Seed / credenciais

Após `npx prisma migrate deploy`, execute `npm run seed` no diretório `backend`. O seed cria três tipos de exame (Raio-X, Ultrassom e Ressonância Magnética), agendamentos de exemplo e laudos de demonstração.

Senha única para todas as contas: **`demo1234`**

| Perfil | E-mail | Observação |
|---|---|---|
| Equipe da clínica | `staff@clinica.com` | agenda, cancela, cria e publica laudos |
| Paciente | `ana.souza@email.com` | possui um laudo **publicado** (Raio-X) |
| Paciente | `bruno.lima@email.com` | possui um laudo em **rascunho** (não visível) |
| Paciente | `carla.mendes@email.com` | possui agendamento **sem laudo** |

---

## Execução

```bash
# Terminal 1 — API
cd backend
npm run dev        # http://localhost:3333

# Terminal 2 — interface
cd frontend
npm run dev        # http://localhost:5173
```

Para build de produção de cada pacote: `npm run build` em `backend/` e em `frontend/`.

---

## Testes automatizados

```bash
cd backend
npm test          # executa toda a suíte (Vitest)
```

A suíte usa um banco dedicado (`TEST_DATABASE_URL`), recriado automaticamente a cada execução (`prisma migrate reset`), sem tocar no banco de desenvolvimento.

### Cenários obrigatórios cobertos

| # | Cenário | Arquivo |
|---|---|---|
| 1 | Duas tentativas **simultâneas** no mesmo horário — só uma aceita | `tests/concurrency.test.ts` |
| 2 | Paciente tentando ler laudo de outro paciente — negado (404) | `tests/reports.test.ts` |
| 3 | Paciente tentando acessar rascunho — conteúdo indisponível (404) | `tests/reports.test.ts` |
| 4 | Laudo publicado fica disponível para o paciente correto | `tests/reports.test.ts` |
| 5 | Agendamento no passado é rejeitado (422) | `tests/appointments.test.ts` |

Além destes: autenticação e autorização por perfil, reutilização de horário cancelado, bloqueio de cancelamento com laudo publicado, bloqueio de laudo em agendamento cancelado, um laudo por agendamento, laudo publicado não editável, corridas entre cancel/publish/upsert, filtros de listagem, validação de IANA na configuração e testes unitários de fuso horário e grade de 30 minutos.

---

## Validação técnica

Resultados efetivamente comprovados no estado atual do repositório:

- **53/53 testes passando** (7 arquivos de teste);
- testes de **concorrência** no agendamento e nas transições de laudo;
- **autorização entre pacientes** com resposta `404` para recursos alheios;
- **proteção de rascunhos** — conteúdo não disponibilizado ao paciente;
- **publicação de laudos** com registro da data e disponibilidade ao paciente correto;
- **rejeição de agendamento no passado** (`422`);
- **validação de timezone** — identificador IANA validado no startup e formatação consistente no frontend;
- **proteção contra conflitos de agenda** — índice único parcial no banco;
- typecheck e build de backend e frontend executados com sucesso.

Não há métricas adicionais de performance ou cobertura declaradas.

---

## Decisões técnicas

As decisões com maior impacto estão detalhadas em seções próprias:

| Decisão | Onde está explicada |
|---|---|
| Concorrência resolvida no banco, não na aplicação | [Concorrência](#concorrência) |
| Conversão de fuso na borda, com persistência em UTC | [Timezone](#timezone) |
| Autorização no servidor e `patientId` do token | [Segurança](#segurança) |
| Um laudo por agendamento via `@unique` + upsert | [Regras de negócio](#regras-de-negócio) |
| Modelo `User` × `Patient` e estados de `Appointment`/`Report` | [Banco de dados](#banco-de-dados) |
| Cliente HTTP sem `Content-Type` em requisições sem corpo | [Vibe Coding](#vibe-coding) |

O registro completo do raciocínio está em `DECISOES-TECNICAS.md`.

---

## Limitações

- **Sem cadastro de pacientes pela interface.** O seed cria os pacientes; a clínica seleciona entre eles. Um CRUD de pacientes ficaria fora do escopo mínimo.
- **Sem recuperação de senha / refresh token.** O token expira em 8h e o usuário faz login novamente.
- **Sem paginação** nas listagens — adequado ao volume do exercício, não à produção.
- **Sem rate limiting / bloqueio por tentativas** no login.
- **Laudos em texto puro.** Não há PDF, anexos, assinatura digital nem validação de conteúdo clínico (explicitamente fora do escopo do desafio).
- **Agenda limitada à grade fixa 08:00–18:00**, 20 slots de 30 min por dia, sem feriados, fins de semana ou bloqueios de agenda.
- **Um único profissional responsável por laudo** (campo de texto livre, sem vínculo com usuário do sistema).

---

## Pendências / evolução futura

- Cadastro/edição de pacientes e de tipos de exame pela interface.
- Reagendamento (hoje só cancelar e criar de novo).
- Auditoria de quem publicou/cancelou e quando.
- Teste end-to-end no navegador (Playwright/Cypress) cobrindo o fluxo completo de UI.
- Pipeline de CI executando `typecheck`, `test` e `build`.
- Docker Compose para subir banco + API + frontend com um comando.

---

## Tempo de desenvolvimento

| Etapa | Tempo |
|---|---|
| Leitura do desafio e modelagem de dados | ~0,5h |
| Backend: auth, agendamento, laudos, regras | ~1,5h |
| Migration, índice único parcial e seed | ~0,5h |
| Testes (5 cenários + unitários) | ~1h |
| Frontend: design system, agenda, laudos, portal | ~2,5h |
| Documentação e ajustes finais | ~1h |
| **Total** | **~7h** |
