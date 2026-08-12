export type FaqItem = {
  id: string;
  topic: string;
  question: string;
  answer: string;
};

export  const TOPICS = [
  "Conta e Perfil",
  "Modo Lab",
  "KC — Knowledge Check",
  "Simulado",
  "Modo Revisão",
  "Arena de Batalha",
  "Desafio Semanal",
  "Trilhas de Aprendizagem",
  "Jornada do Herói",
  "Sprint e Flashcards",
  "Quiz Diário",
  "Mentor IA",
  "Biblioteca",
  "XP, Níveis e Conquistas",
  "Leaderboard e Histórico",
  "Geral do App",
] as const;

export const FAQ_ITEMS: FaqItem[] = [
  {
    id: "conta-aprovacao",
    topic: "Conta e Perfil",
    question: "Fiz o cadastro mas não consigo entrar. O que houve?",
    answer:
      "Todo cadastro novo nasce com status pendente e precisa ser aprovado por um administrador antes do primeiro login funcionar. Assim que for aprovado, o login passa a funcionar normalmente.",
  },
  {
    id: "conta-campos-obrigatorios",
    topic: "Conta e Perfil",
    question: "Quais campos do perfil são obrigatórios?",
    answer:
      "Nome de exibição, username único, certificação AWS alvo e um tema favorito (ex.: games, música, esporte) usado para deixar as quests do Lab mais divertidas. Sem esses 4 campos o app fica bloqueado até você completá-los.",
  },
  {
    id: "conta-trocar-certificacao",
    topic: "Conta e Perfil",
    question: "Posso trocar minha certificação alvo depois?",
    answer:
      "Sim, edite o perfil a qualquer momento em Perfil. Trocar a certificação também atualiza o filtro padrão da Biblioteca para a nova categoria.",
  },
  {
    id: "conta-avatar",
    topic: "Conta e Perfil",
    question: "Como troco meu avatar?",
    answer: "Na tela de perfil, clique em 'Trocar Foto' abaixo do avatar e envie uma imagem JPEG, PNG ou WebP.",
  },
  {
    id: "lab-como-funciona",
    topic: "Modo Lab",
    question: "Como funciona o Modo Lab?",
    answer:
      "Você cola o enunciado de um laboratório AWS (objetivos, etapas, serviços envolvidos) e escolhe um tema. A IA transforma esse conteúdo em uma quest gamificada, dividida em tarefas que você completa uma a uma para ganhar XP.",
  },
  {
    id: "lab-melhor-texto",
    topic: "Modo Lab",
    question: "Que tipo de texto de lab funciona melhor?",
    answer:
      "Labs com passos claros e serviços AWS específicos geram quests mais coerentes. Textos vagos ou incompletos tendem a gerar tarefas genéricas.",
  },
  {
    id: "lab-duas-quests",
    topic: "Modo Lab",
    question: "Posso ter duas quests em andamento ao mesmo tempo?",
    answer:
      "Não é recomendado — termine a quest atual antes de gerar outra, para não perder progresso nem gastar geração de IA à toa.",
  },
  {
    id: "kc-o-que-e",
    topic: "KC — Knowledge Check",
    question: "O que é o KC (Knowledge Check)?",
    answer: "Uma sessão de revisão rápida e focada por serviço AWS. Você escolhe o serviço e a quantidade de questões.",
  },
  {
    id: "kc-dificuldade",
    topic: "KC — Knowledge Check",
    question: "Como a dificuldade das questões do KC é definida?",
    answer:
      "Ela se ajusta automaticamente com base nos gaps de aprendizado detectados no seu histórico — se você erra muito em um tópico, questões daquele tópico aparecem com mais frequência.",
  },
  {
    id: "simulado-formato",
    topic: "Simulado",
    question: "Como é a prova do Simulado?",
    answer:
      "65 questões e 90 minutos de cronômetro, seguindo o exam guide oficial da sua certificação alvo. Você pode marcar questões para revisão e, antes de enviar, vê uma tela de revisão com todas as respostas.",
  },
  {
    id: "simulado-fim",
    topic: "Simulado",
    question: "O que acontece depois que envio o simulado?",
    answer:
      "Você recebe sua nota final e um resumo dos pontos fracos por serviço, para saber exatamente onde focar o próximo estudo.",
  },
  {
    id: "simulado-fechar-navegador",
    topic: "Simulado",
    question: "Fechei o navegador no meio do simulado. Perco a prova?",
    answer:
      "Não. O app detecta uma sessão de simulado pendente ao reabrir e oferece para retomar de onde parou ou limpar a sessão.",
  },
  {
    id: "revisao-o-que-e",
    topic: "Modo Revisão",
    question: "Para que serve o Modo Revisão?",
    answer:
      "Ele monta uma sessão de questões com base nos gaps de conhecimento detectados nos seus simulados — foca nos serviços onde seu desempenho foi mais fraco.",
  },
  {
    id: "arena-como-funciona",
    topic: "Arena de Batalha",
    question: "Como funciona a Arena de Batalha?",
    answer:
      "Você escolhe um boss para enfrentar. Cada resposta correta causa dano no HP do boss; cada resposta errada tira HP seu. Zere o HP do boss antes do seu esgotar para vencer.",
  },
  {
    id: "arena-recompensa",
    topic: "Arena de Batalha",
    question: "O que ganho ao vencer um boss?",
    answer:
      "XP e, quando aplicável, conquistas — que aparecem como notificação na hora da vitória, junto com a tela de revisão da batalha.",
  },
  {
    id: "arena-abandonar",
    topic: "Arena de Batalha",
    question: "Posso abandonar uma batalha no meio?",
    answer:
      "Sim, há um botão 'Abandonar' durante a luta. A próxima tentativa contra aquele boss começa com o HP dele restaurado.",
  },
  {
    id: "desafio-semanal-o-que-e",
    topic: "Desafio Semanal",
    question: "O que é o Desafio Semanal?",
    answer:
      "Um conjunto de questões liberado toda semana, igual para todos os jogadores. Responda enquanto estiver ativo para competir no ranking do desafio e ganhar XP extra.",
  },
  {
    id: "trilhas-o-que-sao",
    topic: "Trilhas de Aprendizagem",
    question: "O que são as Trilhas de Aprendizagem?",
    answer:
      "Percursos guiados por tópico AWS, organizados em etapas progressivas. Você avança etapa por etapa para reforçar um serviço específico antes de seguir para a próxima.",
  },
  {
    id: "jornada-o-que-e",
    topic: "Jornada do Herói",
    question: "O que é a Jornada do Herói?",
    answer:
      "Sua trilha de simulados rumo à certificação AWS escolhida, do nível iniciante até o simulado BOSS final. Cada etapa concluída libera a próxima.",
  },
  {
    id: "jornada-antigas",
    topic: "Jornada do Herói",
    question: "Posso ver jornadas antigas de outras certificações?",
    answer: "Sim, dá para revisitar o desempenho de uma jornada de certificação já concluída anteriormente.",
  },
  {
    id: "sprint-o-que-e",
    topic: "Sprint e Flashcards",
    question: "O que é o Sprint Mode?",
    answer:
      "Sessões ultra-rápidas de questões para manter o ritmo de estudo em poucos minutos, com diferentes modos disponíveis conforme o tempo que você tem.",
  },
  {
    id: "flashcards-o-que-e",
    topic: "Sprint e Flashcards",
    question: "Como funcionam os Flashcards?",
    answer:
      "Repetição espaçada: cada carta que você avalia reaparece em um intervalo calculado com base na sua nota, priorizando o que você mais precisa reforçar. A tela mostra quantas cartas estão pendentes para hoje.",
  },
  {
    id: "quiz-diario-nao-aparece",
    topic: "Quiz Diário",
    question: "Por que não vejo o Quiz Diário no menu?",
    answer:
      "Ele só aparece depois que você conquista pelo menos um badge de certificação. É uma sessão curta (5 questões) liberada uma vez por dia.",
  },
  {
    id: "mentor-o-que-faz",
    topic: "Mentor IA",
    question: "O que o Mentor IA (Mestre AWS) faz?",
    answer:
      "É um mentor de IA para tirar dúvidas sobre serviços e conceitos AWS e sugerir recomendações de estudo personalizadas com base no seu histórico.",
  },
  {
    id: "biblioteca-filtro-cert",
    topic: "Biblioteca",
    question: "A Biblioteca já vem filtrada pela minha certificação?",
    answer:
      "Sim — ao abrir, ela pré-seleciona o filtro de categoria mais próximo da sua certificação alvo. Você pode trocar ou limpar o filtro a qualquer momento.",
  },
  {
    id: "biblioteca-tipos",
    topic: "Biblioteca",
    question: "Que tipos de conteúdo existem na Biblioteca?",
    answer:
      "PDFs, artigos em texto, imagens/infográficos e apresentações de slides, selecionados para complementar sua preparação.",
  },
  {
    id: "xp-como-calcula",
    topic: "XP, Níveis e Conquistas",
    question: "Como o XP é calculado?",
    answer:
      "Cada atividade concluída (Lab, KC, Simulado, Arena, Sprint etc.) gera XP ponderado pela dificuldade da questão e pelo tipo de atividade.",
  },
  {
    id: "xp-notificacao-conquista",
    topic: "XP, Níveis e Conquistas",
    question: "Como sei que desbloqueei uma conquista?",
    answer:
      "No Lab, KC, Simulado e Arena aparece uma notificação no topo da tela na hora. No Sprint, Quiz Diário e Desafio Semanal, a conquista aparece listada na própria tela de resultado.",
  },
  {
    id: "xp-onde-ver-conquistas",
    topic: "XP, Níveis e Conquistas",
    question: "Onde vejo todas as minhas conquistas e badges?",
    answer:
      "Na Galeria de Conquistas — lá dá para acompanhar o progresso de cada uma e compartilhar as desbloqueadas com um link público.",
  },
  {
    id: "leaderboard-tempo-real",
    topic: "Leaderboard e Histórico",
    question: "O leaderboard atualiza em tempo real?",
    answer:
      "Sim, via um canal em tempo real — se outro jogador ganhar XP enquanto você está com o leaderboard aberto, o ranking se atualiza sozinho.",
  },
  {
    id: "historico-onde-ver",
    topic: "Leaderboard e Histórico",
    question: "Onde vejo o que já estudei?",
    answer: "No Histórico — reúne Labs finalizados e sessões de estudo (KC, Sprint, Simulado, Arena e Quiz Diário).",
  },
  {
    id: "geral-ajuda-por-tela",
    topic: "Geral do App",
    question: "Cada tela do app tem uma ajuda específica?",
    answer:
      "Sim — ao lado do título de cada modo (Lab, KC, Simulado, Arena, Trilhas etc.) há um botão '?' que abre uma explicação rápida daquela função, sem precisar sair da tela ou vir até aqui.",
  },
  {
    id: "geral-tema-fonte",
    topic: "Geral do App",
    question: "Como troco entre tema claro e escuro ou aumento a fonte?",
    answer:
      "No menu de configurações no cabeçalho (ícone de engrenagem) tem o alternador de tema e o controle de tamanho de fonte.",
  },
];

export const tutorialShowcase = [
  {
    id: "v2-showcase",
    title: "Tutorial: Novidades da V2",
    videoUrl: "https://youtu.be/4nzU5TrFsdA?si=pU27h-5k5RrBPFuG",
    summary: "Panorama das novidades e melhorias adicionadas na versão 2 do AWS Quest.",
   highlights: ["Resumo das principais atualizações recentes", "Tour pelas novas funcionalidades disponíveis no app"],
  },
  {
    id: "lab-quest-v1",
    title: "Tutorial: Criando uma Lab Quest",
    videoUrl: "https://youtu.be/QdR2LqiS4sQ",
    summary:
      "Mostra o fluxo completo para gerar uma quest a partir de um texto de laboratorio, concluir tarefas e finalizar com XP salvo no historico.",
    highlights: [
      "Entradas de tema e texto do lab com boas praticas",
      "Execucao tarefa por tarefa com progresso",
      "Finalizacao da jornada e validacao de XP/historico",
    ],
  },
  {
    id: "kc-v1",
    title: "Tutorial: Criando uma sessao de KC",
    videoUrl: "https://youtu.be/6Ij6GgQjoLQ",
    summary:
      "Explica como configurar topicos e dificuldade, responder com revisao por alternativa e concluir a sessao de Knowledge Check.",
    highlights: [
      "Selecao de servicos AWS e dificuldade",
      "Revisao de resposta com explicacao por alternativa",
      "Resultado final com score, XP e persistencia no historico",
    ],
  },
  {
    id: "simulado-v1",
    title: "Tutorial: Criando uma sessao de Simulado",
    videoUrl: "https://youtu.be/f1vfjb_ZEJs",
    summary:
      "Cobre o gate de regras, prova cronometrada, envio do simulado e revisao dos pontos fracos para orientar os proximos estudos.",
    highlights: [
      "Aceite de regras e inicio da prova",
      "Execucao do simulado com timer e navegacao por questao",
      "Overview de desempenho e revisao de fraquezas",
    ],
  },
] as const;

export const DIACRITICS_REGEX = new RegExp("[\\u0300-\\u036f]", "g");

export function normalize(text: string): string {
  return text.normalize("NFD").replace(DIACRITICS_REGEX, "").toLowerCase();
}

export function matchesQuery(item: FaqItem, query: string): boolean {
  const q = normalize(query);
  return (
    normalize(item.question).includes(q) || normalize(item.answer).includes(q) || normalize(item.topic).includes(q)
  );
}

export function getYoutubeEmbedUrl(url: string): string | null {
  const match = url.match(/(?:youtu\.be\/|youtube\.com\/(?:watch\?v=|embed\/))([\w-]{11})/);
  return match ? `https://www.youtube.com/embed/${match[1]}` : null;
}