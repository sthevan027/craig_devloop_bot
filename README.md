# Craig DevLoop Bot (Node.js + Python)

Bot de Discord que:
- Entra em chamadas de voz (!gravar)
- Grava e salva o áudio do canal de voz
- Transcreve com AssemblyAI
- Registra resumo e link no Notion

## Setup

### 1. Instale as dependências Node.js
```bash
npm install
# ou
yarn install
```

### 2. Instale as dependências Python
```bash
pip install -r requirements.txt
```

#### Dependências Python necessárias:
- requests
- python-dotenv
- notion-client
- transformers

### 3. Instale o sox (para conversão de áudio)
- **Windows:** Baixe e instale: https://sourceforge.net/projects/sox/files/latest/download
- **Linux:**
  ```bash
  sudo apt-get install sox libsox-fmt-all
  ```
- **Mac:**
  ```bash
  brew install sox
  ```
- Adicione o diretório do sox ao PATH do sistema.

### 4. Configure o arquivo `.env`
Exemplo:
```
DISCORD_TOKEN=seu_token_do_discord
NOTION_API_KEY=sua_notion_api_key
NOTION_DATABASE_ID=seu_database_id
ASSEMBLYAI_API_KEY=sua_api_key_assemblyai
SOX_PATH=/usr/bin/sox # ou o caminho do sox no seu sistema
```

### 5. Execute o bot
```bash
node bot.js
```

## Como usar
- Entre em um canal de voz no Discord.
- No chat, digite `!gravar` para começar a gravar.
- Digite `!parar` para finalizar, transcrever e salvar o resumo no Notion.
- Digite `!limpar` para apagar gravações antigas (mais de 7 dias).
- Digite `!status` para checar se o bot está online.

O áudio será processado automaticamente pelo pipeline Python!
