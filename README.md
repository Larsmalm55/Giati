# Giati.no

Dating simulator. Six women. Eight phases. No shortcuts.

## Deploy til Netlify

### 1. Push til GitHub
```bash
git init
git add .
git commit -m "initial commit"
git remote add origin https://github.com/DITT-BRUKERNAVN/giati.git
git push -u origin main
```

### 2. Koble GitHub til Netlify
- Logg inn på [netlify.com](https://netlify.com)
- New site → Import from Git → velg repoet
- Build settings settes automatisk fra `netlify.toml`

### 3. Sett API-nøkkel
- Site Settings → Environment Variables → Add
- Key: `ANTHROPIC_API_KEY`
- Value: `sk-ant-...`

### 4. Deploy
Netlify bygger og deployer automatisk.

## Filstruktur
```
/
├── index.html              ← hele appen
├── netlify.toml            ← build + redirect config
├── package.json
├── .gitignore
└── netlify/
    └── functions/
        └── chat.js         ← API-proxy til Anthropic
```

## Lokal testing
```bash
npm install -g netlify-cli
netlify dev
```
Krever `.env`-fil med `ANTHROPIC_API_KEY=sk-ant-...`
