# estudo-API

API em Node + Express + TypeScript + Prisma (SQLite), feita como estudo de um curso. O tema é um sistema de controle de estoque.

## Arquitetura

### Stack

| Peça | Tecnologia |
|------|------------|
| Runtime / linguagem | Node 24 + TypeScript 5 (CommonJS) |
| HTTP | Express 5 |
| Banco / ORM | SQLite via Prisma 7 (com o driver adapter `better-sqlite3`) |
| Autenticação | JWT (`jsonwebtoken`) + hash de senha (`bcryptjs`) |
| Dev | `ts-node-dev` (`yarn dev`), gerenciador Yarn 4 |

### Camadas

É uma arquitetura em camadas simples. Cada camada só conversa com a de baixo:

```
 Cliente HTTP
      |
      v
 server.ts          configura o Express: dotenv, JSON, router, handler global de erros
      |
      v
 routes.ts          mapeia método + caminho -> [middleware] -> controller
      |
      v
 middlewares/       preocupações transversais (hoje: autenticação JWT)
      |
      v
 controllers/       camada HTTP: lê request, chama o service, monta a response
      |
      v
 services/          regras de negócio + acesso ao dado
      |
      v
 prisma/index.ts    instância única do PrismaClient (com o adapter do SQLite)
      |
      v
 dev.db             banco SQLite
```

Apoio transversal: `models/interfaces/` (tipos dos dados que entram nos services) e `@types/` (extensão de tipos do Express).

### Estrutura de pastas

```
prisma/
  schema.prisma          modelo de dados
  migrations/            histórico de migrations
prisma7.config.ts        config do Prisma CLI (schema, migrations, URL do banco)
src/
  server.ts              ponto de entrada
  routes.ts              todas as rotas
  controllers/<recurso>/ camada HTTP
  services/<recurso>/    regras de negócio
  middlewares/           isAuthenticated
  models/interfaces/     interfaces de entrada dos services
  @types/express/        extensão do tipo Request
  prisma/index.ts        PrismaClient compartilhado
  generated/prisma/      client gerado pelo Prisma (não vai para o Git)
dev.db                   banco SQLite (raiz do projeto)
.env                     DATABASE_URL e JWT_SECRET (não vai para o Git)
```

### Variáveis de ambiente

| Variável | Uso |
|----------|-----|
| `DATABASE_URL` | Caminho do SQLite (`file:./dev.db`), relativo à raiz do projeto |
| `JWT_SECRET` | Segredo para assinar e validar os tokens |

O `.env` é carregado por `import "dotenv/config"` na primeira linha do [server.ts](src/server.ts).

## Design

### Modelo de dados

Definido em [prisma/schema.prisma](prisma/schema.prisma). Todos os ids são UUID e os nomes de tabela ficam em minúsculas via `@@map`.

```
User (users)          id, name, email (único), password, created_at, updated_at

Category (categories) id, name, created_at, updated_at
      |
      | 1 categoria tem N produtos
      v
Product (products)    id, name, price, description, banner, amount,
                      category_id -> Category, created_at, updated_at
      |
      | 1 produto tem N itens
      v
Item (items)          id, amount, product_id -> Product, created_at, updated_at
```

Estado atual: só `User` tem rotas. `Category`, `Product` e `Item` já estão modelados e migrados, mas ainda sem service, controller ou rota. `Product.price` é `String` de propósito, para acompanhar o curso.

### Decisões de design

- **Controller fino, service com a regra.** O controller não sabe de banco; o service não sabe de HTTP. Isso deixa a regra de negócio reaproveitável e fácil de testar sem subir o Express.
- **Uma classe por caso de uso.** Cada service tem um método `execute` e cada controller um método `handle`. Uma rota nova é um arquivo novo, não uma edição em um arquivo grande.
- **Erros por exceção.** O service lança `throw new Error("...")`. O Express 5 encaminha erros de handlers `async` ao handler global do [server.ts](src/server.ts), que responde em JSON. Por isso o projeto não usa `express-async-errors`.
- **Autenticação stateless com JWT.** `POST /session` confere email e senha (`bcrypt.compare`) e devolve um token com validade de 30 dias e o id do usuário no `sub`. O middleware `isAuthenticated` valida o token e expõe o id em `request.user_id`. Nada de sessão no servidor.
- **Senhas com hash.** A senha é salva com `bcryptjs`, nunca em texto puro.
- **Um único PrismaClient.** [src/prisma/index.ts](src/prisma/index.ts) exporta uma instância compartilhada por todos os services, para não abrir várias conexões.
- **Middleware por rota, não global.** A autenticação é aplicada só nas rotas que precisam, direto em [routes.ts](src/routes.ts). O que é público continua público.
- **Tipos perto do uso.** Interfaces de entrada ficam em `models/interfaces/`, organizadas por recurso, espelhando `services/` e `controllers/`.

### Limitações conhecidas (é um projeto de estudo)

- Services criam o `prismaClient` por import direto, sem injeção de dependência. Isso acopla o service ao Prisma.
- Não há camada de validação de entrada (só checagens simples dentro dos services).
- `strict` está desligado no [tsconfig.json](tsconfig.json), para acompanhar o código do curso.

## Como criar uma nova rota

O processo é sempre o mesmo, em três passos. Cada um tem uma responsabilidade:

| Passo | Pasta | Responsabilidade |
|-------|-------|------------------|
| 1. Service | `src/services/<recurso>/` | Regra de negócio e acesso ao banco (Prisma). Não conhece `request` nem `response`. |
| 2. Controller | `src/controllers/<recurso>/` | Ponte entre HTTP e service: lê os dados da requisição, chama o service e devolve a resposta. |
| 3. Rota | `src/routes.ts` | Liga um método + caminho HTTP a um controller, com ou sem middleware. |

O caminho de uma requisição é:

```
requisição -> routes.ts -> [middleware] -> Controller -> Service -> Prisma -> banco
resposta   <-------------------------------- Controller <- Service <-
```

### 1. Criar o Service

Recebe dados já prontos (não `request`), valida, fala com o banco e retorna o resultado. Se algo estiver errado, lança `throw new Error("mensagem")`. O handler de erros do [server.ts](src/server.ts) transforma isso em resposta HTTP.

```ts
// src/services/user/DetailUserService.ts
class DetailUserService {
    async execute(user_id: string) {
        const user = await prismaClient.user.findFirst({ where: { id: user_id } });
        return user;
    }
}
export { DetailUserService }
```

### 2. Criar o Controller

Tira os dados de onde eles vierem na requisição, chama o service e responde. Sempre com um método `handle`.

```ts
// src/controllers/user/DetailUserController.ts
class DetailUserController {
    async handle(request: Request, response: Response) {
        const user_id = request.user_id;                        // veio do middleware
        const user = await new DetailUserService().execute(user_id);
        return response.json(user);
    }
}
export { DetailUserController }
```

Onde ler os dados na requisição:

| De onde | Como ler | Exemplo neste projeto |
|---------|----------|-----------------------|
| Body (JSON) | `request.body` | `POST /user`, `POST /session` |
| Query string | `request.query.campo` | `DELETE /user/remove?user_id=...` |
| Preenchido pelo middleware | `request.user_id` | `GET /me` |

### 3. Registrar a rota e decidir se precisa de middleware

Em [src/routes.ts](src/routes.ts), a pergunta é: **essa rota exige usuário logado?**

- **Não** (rota pública): `router.post('/user', new CreateUserController().handle)`
- **Sim**: coloque o middleware [isAuthenticated](src/middlewares/isAuthenticated.ts) antes do controller:
  `router.get('/me', isAuthenticated, new DetailUserController().handle)`

O `isAuthenticated` lê o token do header `Authorization: Bearer <token>`, valida o JWT e grava o id do usuário em `request.user_id`. Se o token faltar ou for inválido, responde 401 e o controller nem chega a rodar.

Rotas atuais:

| Método | Caminho | Middleware | Controller |
|--------|---------|------------|------------|
| GET | `/test` | não | (função inline) |
| POST | `/user` | não | CreateUserController |
| POST | `/session` | não | AuthUserController |
| GET | `/me` | sim | DetailUserController |
| DELETE | `/user/remove` | não | RemoveUserController |

## Quando criar tipagens (e onde)

Tipagem não é um passo fixo: só se cria quando o service ou a rota recebe um dado cujo formato vale a pena descrever. Existem três tipos, cada um com seu lugar.

### a) Interface do que o service recebe: `src/models/interfaces/`

Descreve o objeto que o service espera no `execute`. Tem uma interface por caso de uso, organizada por recurso.

```ts
// src/models/interfaces/user/UserRequest.ts
export interface UserRequest { name: string; email: string; password: string; }
```

```ts
// usada no service
async execute({ name, email, password }: UserRequest) { ... }
```

Regra prática:
- Service recebe **vários campos** (ou um objeto): crie uma interface `XxxRequest`. Exemplos: `UserRequest`, `AuthRequest`, `RemoveUserRequest`.
- Service recebe **um valor simples**: não precisa de interface, tipa direto. Exemplo: `DetailUserService.execute(user_id: string)`.

### b) Interface de um dado externo: `Payload`

[Payload.ts](src/models/interfaces/user/auth/Payload.ts) descreve o conteúdo do token JWT que o `verify()` devolve (aqui, o `sub`, que é o id do usuário). Sem isso, o TypeScript não sabe o que existe dentro do token decodificado. Criamos quando lemos algo que vem de fora do nosso código e não tem tipo próprio.

### c) Extensão de tipo de biblioteca: `src/@types/`

O `Request` do Express não tem o campo `user_id`, que o middleware adiciona em runtime. Para o TypeScript aceitar `request.user_id`, ampliamos o tipo em [src/@types/express/index.d.ts](src/@types/express/index.d.ts):

```ts
declare namespace Express {
    export interface Request { user_id: string; }
}
```

Criamos isso quando um middleware **acrescenta algo** ao `request` (ou ao `response`). O `typeRoots` no [tsconfig.json](tsconfig.json) aponta para essa pasta.

### Resumo: quando preciso de qual?

| Situação | Tipagem | Onde |
|----------|---------|------|
| Service recebe vários campos | `XxxRequest` | `src/models/interfaces/<recurso>/` |
| Leio dados de fora (ex.: JWT decodificado) | Interface do formato | `src/models/interfaces/...` |
| Middleware adiciona campo ao `request` | Extensão do `Request` | `src/@types/express/index.d.ts` |
| Service recebe um único valor simples | Nenhuma, só tipar o parâmetro | no próprio service |

## Checklist para uma rota nova

1. Precisa de dados no service com formato próprio? Crie a interface em `src/models/interfaces/<recurso>/`.
2. Crie o service em `src/services/<recurso>/` com o método `execute`.
3. Crie o controller em `src/controllers/<recurso>/` com o método `handle`.
4. Registre em `src/routes.ts`, com `isAuthenticated` se a rota exigir login.
5. Se o middleware passar a gravar um campo novo no `request`, declare-o em `src/@types/express/index.d.ts`.
