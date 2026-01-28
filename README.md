# App de Cadastro de Pacientes (Netlify Functions + CSV)

Stack: **Vite/React + Netlify Functions**. Os pacientes só veem o formulário. Os dados ficam **persistidos no Netlify Blobs** e você exporta em CSV quando precisar.

## Estrutura
```
/Users/test/tabela_contato
├─ netlify.toml                   # config do Netlify
├─ netlify/functions/             # funções (API)
│  ├─ patients.js                 # POST /api/patients e GET /api/patients (admin)
│  ├─ export.js                   # GET /api/patients/export (admin)
│  └─ lib/storage.js              # helpers (blobs/formatos)
├─ client/                        # Vite + React
├─ dist/                          # build
├─ data/patients.json             # usado só em dev local sem Netlify
└─ package.json
```

## Variáveis de ambiente
- `ADMIN_TOKEN` (opcional): protege listagem e exportação.
  - Em produção: configure no painel do Netlify.
  - Em desenvolvimento: crie `.env` na raiz.

## Rodar localmente (com Functions)
```bash
npm install
npm install --prefix client
npx netlify login
npx netlify init
npm run dev:netlify
```
Abra: http://localhost:8888

> O `netlify dev` faz o proxy automático para o Vite (5173) e para as Functions.

## Deploy no Netlify (passo a passo)
1. `npx netlify login`
2. `npx netlify init`
   - Build command: `npm run build:client`
   - Publish directory: `dist`
   - Functions directory: `netlify/functions`
3. No painel do Netlify, vá em **Site settings > Environment variables** e crie:
   - `ADMIN_TOKEN` (opcional, mas recomendado)
4. Faça o deploy (push no Git ou `npx netlify deploy --prod`).

## Endpoints
- `POST /api/patients` → cadastra/atualiza (público)
- `GET /api/patients` → lista (somente admin)
- `GET /api/patients/export` → download CSV (somente admin)

Se `ADMIN_TOKEN` estiver definido, envie:
- Header `x-admin-token: SEU_TOKEN`
  ou
- Query `?token=SEU_TOKEN`

## Testes rápidos (curl)
```bash
# inserir/atualizar (público)
curl -X POST https://SEU_SITE.netlify.app/api/patients \
  -H 'Content-Type: application/json' \
  -d '{"nome_completo":"João Teste","celular":"11999990000","cpf":"11122233344"}'

# listar (admin)
curl https://SEU_SITE.netlify.app/api/patients -H 'x-admin-token: SEU_TOKEN'

# baixar CSV (admin)
curl -L -o pacientes.csv \
  https://SEU_SITE.netlify.app/api/patients/export \
  -H 'x-admin-token: SEU_TOKEN'
```

## Observações
- O frontend **não mostra** dados de outros pacientes.
- CSV exportado no formato:
  `Nome Completo, Celular, CPF, Sexo, Data de Nascimento, Email`
- Em produção, os dados ficam no **Netlify Blobs** (persistente).
