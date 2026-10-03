# PAINEL PESSOAL 🎯

Um sistema central completo, moderno e responsivo para organizar tarefas, estudos, agenda, projetos, finanças, hábitos, metas e anotações.

---

## 🧭 Os 10 Módulos do Sistema

1. **Dashboard:** O centro de controle da sua vida. Mostra tarefas pendentes e atrasadas, hábitos do dia (com marcação direta), próximos compromissos e provas, metas em andamento, projetos ativos, resumo financeiro e alertas acadêmicos.
2. **Tarefas:** Criação, edição, exclusão, filtros por status (Todas, Pendentes, Hoje, Atrasadas, Futuras, Concluídas), prioridades (Alta, Média, Baixa), categorias, prazos e suporte a recorrência (Diária, Semanal, Mensal).
3. **Agenda:** Calendário completo com alternância entre visualização mensal e diária, exibindo compromissos, tarefas com data e provas.
4. **Estudos:** Controle de matérias, notas, cálculo automático de médias, identificação de matérias que precisam de atenção, agendamento de provas/trabalhos com contagem regressiva e registro de sessões/horas estudadas.
5. **Projetos:** Cadastro de projetos pessoais com status, prioridade, prazos, tecnologias, links (GitHub/Site), checklist de tarefas com barra de progresso automática e anotações.
6. **Finanças:** Saldo acumulado, entradas e despesas, categorias, filtros por mês e ano, gráfico de despesas e lista dos maiores gastos do mês.
7. **Hábitos:** Acompanhamento de hábitos com sequências de dias (streaks 🔥), histórico visual dos últimos 7 dias e conclusão rápida do dia atual.
8. **Metas:** Definição de objetivos com prazo, etapas/passos acionáveis e cálculo automático de progresso percentual.
9. **Notas:** Bloco de anotações com suporte a fixação de notas importantes no topo (pin), categorias e pesquisa em tempo real.
10. **Configurações:** Personalização do nome de exibição, tema claro/escuro, estatísticas de uso do armazenamento local, backup/restauração e limpeza segura dos dados.

---

## 📁 Estrutura do Projeto

```text
meu-projeto/
├── index.html                   # Estrutura HTML das 10 visões, modais e navegação
├── README.md                    # Documentação do sistema
├── css/
│   ├── variables.css            # Variáveis CSS e tokens de tema (Dark/Light)
│   ├── base.css                 # Reset, layout responsivo com sidebar e topbar
│   ├── components.css           # Botões, cards, formulários, modais, toasts e badges
│   └── modules.css              # Estilos específicos de cada um dos módulos
└── js/
    ├── app.js                   # Orquestrador da aplicação, rotas e inicialização
    ├── utils/
    │   └── helpers.js           # Funções utilitárias (moeda, datas, IDs, modal de confirmação)
    ├── storage/
    │   ├── storage-interface.js # Contrato abstrato de armazenamento (preparado para Firebase)
    │   ├── local-storage-adapter.js # Persistência no localStorage cobrindo todas as coleções
    │   └── db.js                # Repositório central de dados e eventos reativos
    └── modules/
        ├── dashboard.js         # Centro do sistema, saudações dinâmicas e widgets integrados
        ├── tasks.js             # Módulo de tarefas e recorrências
        ├── calendar.js          # Módulo de agenda (visões mensal e diária)
        ├── studies.js           # Módulo de estudos, médias e horas
        ├── projects.js          # Módulo de projetos e checklists
        ├── finance.js           # Módulo de finanças e maiores gastos
        ├── habits.js            # Módulo de hábitos e sequências
        ├── goals.js             # Módulo de metas e etapas
        ├── notes.js             # Módulo de notas e fixação
        ├── settings.js          # Módulo de configurações e estatísticas
        └── backup.js            # Exportação e importação de backups JSON
```

---

## 🚀 Como Executar o Projeto

Como o aplicativo é construído com JavaScript modular nativo (`type="module"`), execute um servidor HTTP local na pasta do projeto:

```bash
python3 -m http.server 8000
```
Em seguida, abra o navegador em: [http://localhost:8000](http://localhost:8000)

---

## 💾 Armazenamento & Dados Reais

- **Sem dados falsos:** O sistema calcula todos os números e estatísticas a partir dos seus registros reais.
- **Persistência no navegador:** Todos os dados ficam salvos de forma confiável no `localStorage` do seu navegador.
- **Backup e Restauração:** É possível exportar e importar todos os seus dados a qualquer momento em arquivo `.json`.

---

## 🔥 Preparação para o Firebase Firestore

Toda a aplicação consome a camada `db`, que implementa a interface `StorageInterface` com Promises (`async/await`). Para migrar para o Firebase no futuro, basta criar um adaptador `FirebaseAdapter` implementando essa mesma interface e injetá-lo no arquivo `db.js`. **Nenhuma linha de código da interface precisará ser reescrita.**
