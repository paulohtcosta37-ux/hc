# 🎙️ Conversor de Texto em Fala Neural HD (Sem Limites)

Aplicativo avançado de conversão de texto em fala neural com arquitetura **multi-motor**, eliminando todas as restrições e limites de cota de inteligência artificial.

---

## 🌟 Principais Recursos

### 1. 🚀 Motor Neural Ilimitado (Padrão)
- **100% Ilimitado e Gratuito**: Sem limite de caracteres, sem limites de requisições por minuto (RPM) e sem necessidade de chave de API.
- **Áudio Neural 24kHz HD**: Mais de 400 vozes neurais de alta fidelidade (16 vozes em Português do Brasil como Francisca, Antonio, Thalita, Brenda, Donato, Elza, Fabio, Giovanna, Humberto, Julio, Leila, Leticia, Manuela, Nicolau, Valerio, Yara).
- **Segmentação Automática para Textos Longos**: Sintetize livros, artigos, notícias e roteiros inteiros sem travamentos ou quebras de áudio.

### 2. ⚡ Motor Google Gemini AI Studio
- Suporte a modelos Gemini TTS (`Kore`, `Aoede`, `Puck`, `Charon`, `Fenrir`).
- Campo para inserção direta de chave de API na interface ou no arquivo `.env`.
- **Proteção Automática de Cota (Auto-Fallback)**: Se o Gemini retornar erro `429` (Quota Exceeded / Resource Exhausted), o sistema faz a transição transparente para o Motor Ilimitado entregando o áudio imediatamente.

### 3. 🇧🇷 13 Sotaques Regionais Brasileiros
- Carioca (RJ), Paulistano (SP), Mineiro (MG), Nordestino Geral (NE), Baiano (BA), Pernambucano (PE), Cearense (CE), Gaúcho (RS), Paranaense (PR), Caipira / Interior (SP/MG/GO), Manauara / Amazônico (AM/PA), Brasiliense (DF) e Padrão Neutro.

### 4. 🎭 Modulação de Emoção, Tom e Prosódia
- 14 Tags de Expressividade: `#alegre`, `#calma`, `#confiante`, `#animada`, `#pausada`, `#brava`, `#sussurrada`, `#dramática`, `#narrador de documentário`, `#jornalística`, `#empática`, `#grave`, `#poética`, `#formal`.
- Ajuste de **Tom / Pitch** (-40Hz Grave a +40Hz Agudo) e **Velocidade** (0.5x a 1.8x).

### 5. 🎧 Player de Áudio Moderno & Exportações
- Visualizador de ondas sonoras em tempo real.
- Download em **.MP3** e **.WAV**.
- Download de **Legendas Sincronizadas (.SRT)**.
- Importador de arquivos de texto (.txt, .md, .srt).
- Histórico persistente de conversões no navegador com reprodução instantânea.

---

## 🚀 Como Executar Localmente

### Pré-requisitos
- [Node.js](https://nodejs.org/) (versão 18 ou superior)

### Passo a Passo

1. **Instalar dependências**:
   ```bash
   npm install
   ```

2. **Iniciar em modo de desenvolvimento**:
   ```bash
   npm run dev
   ```

3. **Ou compilar e iniciar em produção**:
   ```bash
   npm run build
   npm start
   ```

4. Acesse no navegador:
   ```
   http://localhost:3000
   ```

---

## 📁 Estrutura do Projeto

```
conversor-de-texto-em-fala/
├── server.ts              # Servidor Express com síntese Edge Neural + Gemini + Fallback
├── src/
│   ├── App.tsx            # Interface principal do aplicativo com importador e player
│   ├── components/
│   │   ├── VoiceCustomizer.tsx   # Painel de controle de motores, vozes, sotaques e tom
│   │   ├── AudioPlayer.tsx       # Player moderno com visualizador de ondas e download MP3/WAV/SRT
│   │   ├── AudioHistory.tsx      # Histórico de conversões com reprodução e filtro
│   │   └── ConversionProgress.tsx# Indicador dinâmico de progresso da síntese
│   ├── data/
│   │   └── options.ts     # Catálogo completo de vozes neurais, sotaques e estilos
│   └── types.ts           # Definições de tipos TypeScript
├── package.json
└── vite.config.ts
```
