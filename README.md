# REHABITA

> Sistema de cadastro e acompanhamento de famílias assistidas — front-end estático integrado ao Google Sheets via Apps Script.

---

## O que é

O **REHABITA** é uma aplicação web leve, sem servidor, desenvolvida para gerenciar o cadastro, acompanhamento e histórico de distribuição de itens para famílias em situação de vulnerabilidade social em Maringá/PR.

Toda a persistência de dados é feita via **Google Sheets**, e a comunicação entre o front-end e a planilha é feita por uma **API publicada no Google Apps Script**.

---

## 🗂️ Estrutura do Projeto

```
REHABITA/
│
├── .vscode/
│   ├── launch.json        
│   └── settings.json       
│
├── css/
│   ├── global.css         
│   └── comunidade.css     
│   ├── painel.css         
│                          
├── js/                    
│   ├── data.js            
│   ├── painel.js          
│   └── comunidade.js      
│                          
├── index.html             
└── comunidade.html        
```

---

## ⚙️ Tecnologias

| Camada | Tecnologia |
|---|---|
| Front-end | HTML + CSS + JavaScript |
| Back-end / API | Google Apps Script (Web App publicada) |
| Banco de dados | Google Sheets |
| Editor | Visual Studio Code |

---

## 🔗 Links do projeto

| Recurso | Link |
|---|---|
| Planilha (Google Sheets) | [Abrir planilha](https://docs.google.com/spreadsheets/d/1wrkvTqh4ZPH98dR4fY0IPXN58nhPGFDMGbzkoQL0gMw/edit#gid=1700429178) |
| API (Google Apps Script) | [Abrir projeto](https://script.google.com/u/0/home/projects/1yifnpb7PW6xnfCKep86fJRqwnCHCuER-RtmZPOLJ6hUAgvSNE3sIPW5L/edit) |

> ⚠️ **Atenção:** para que os dados carreguem, a URL da API no `data.js` precisa apontar para o Apps Script publicado como Web App. Sem isso, o front-end não consegue ler nem gravar na planilha.

---

## Como funciona a integração

```
Browser (HTML/JS)
      │
      │  fetch() — GET / POST
      ▼
Google Apps Script (Web App)
      │
      │  SpreadsheetApp
      ▼
Google Sheets (base de dados)
```

- **Leitura:** o `data.js` faz um `GET` para a URL do Apps Script, que retorna os dados da planilha em JSON.
- **Escrita:** novos cadastros, atualizações e histórico são enviados via `POST` e o Apps Script grava nas abas correspondentes.
- **Nenhum dado fica salvo no browser** — tudo vai e vem da planilha.

---

## Estrutura da planilha

A planilha possui as seguintes colunas principais por assistido:

| Campo | Descrição |
|---|---|
| ID | Identificador único |
| Responsavel | Nome do responsável pela família |
| CPF | CPF do responsável |
| Nascimento | Data de nascimento |
| Telefone | Contato |
| Bairro / Rua / Número | Endereço completo |
| CEP | CEP da residência |
| Pessoas | Nº de pessoas na residência |
| Moradia | Tipo (própria, alugada, cedida...) |
| Renda | Faixa de renda familiar |
| Emprego | Situação de emprego |
| Itens | Itens necessários |
| Urgencia | Nível de urgência |
| Frequencia | Frequência de atendimento |
| Status | Ativo / Inativo / Em acompanhamento / Novo |
| Observacoes | Anotações do assistente social |
| DataVisita | Última visita presencial |
| DataCadastro | Data do cadastro no sistema |
| Lat / Lng | Coordenadas para mapeamento |
| Membros | Membros da família (JSON) |
| Historico | Histórico de itens entregues (JSON) |

---

## Perfis de uso

| Perfil | Acesso | O que faz |
|---|---|---|
| Assistente social / coordenador | `index.html` | Cadastra, edita, acompanha famílias |
| Comunidade / público | `comunidade.html` | Visualiza pontos de atendimento no mapa |

---

## Arquivos de dados de teste

O arquivo `cadastro_assistidos.xlsx` contém dados fictícios gerados para testes, com CPFs falsos (matematicamente válidos), endereços reais de Maringá/PR e datas inventadas. **Não representa pessoas reais.**

---

## Observações importantes

- Os dados reais ficam **exclusivamente na planilha Google Sheets**, controlada pelos administradores do projeto.
- O acesso à planilha e ao Apps Script deve ser restrito apenas à equipe autorizada.
- CPFs e dados pessoais de assistidos reais são **sigilosos** — nunca subir dados reais no repositório.
