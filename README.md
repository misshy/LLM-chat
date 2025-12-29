# llm-chat-starter

## Run

### Install

```bash
npm install
```

### Start API

```bash
npm run dev:api
```

API: `http://localhost:4000`

### Start Web

```bash
npm run dev:web
```

Web: `http://localhost:3000`

## Notes

- API Day1 is a mock response.
- Web will call API at `NEXT_PUBLIC_API_BASE_URL` if provided, otherwise `http://localhost:4000`.
