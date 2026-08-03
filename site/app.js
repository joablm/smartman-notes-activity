(() => {
  'use strict';

  const STORAGE_KEY = 'humanevo_premium_studio_state_v3';
  const app = document.getElementById('app');
  const modalRoot = document.getElementById('modal-root');
  const toastRoot = document.getElementById('toast-root');
  const cloud = window.HumanevoCloud;
  const mobileMedia = window.matchMedia('(max-width: 900px), (pointer: coarse)');
  const applyDeviceMode = () => {
    const mobile = mobileMedia.matches || /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
    document.documentElement.dataset.device = mobile ? 'mobile' : 'desktop';
    document.body.classList.toggle('is-mobile', mobile);
  };
  applyDeviceMode();
  mobileMedia.addEventListener?.('change', applyDeviceMode);
  const appUrlParams = new URLSearchParams(location.search);
  const isDemoAccess = location.pathname.endsWith('/demo-profissional.html') || location.pathname.endsWith('/demo-profissional') || appUrlParams.get('demo') === '1' || sessionStorage.getItem('humanevo_demo_professional') === '1';
  const accessGate = sessionStorage.getItem('humanevo_access_granted');
  if (!isDemoAccess && (!accessGate || !cloud?.auth?.access_token)) {
    location.replace('/');
    return;
  }
  let cloudContext = null;
  let cloudSyncing = false;
  let cloudEffectivePermissions = null;
  let pendingProfileAvatarData = '';
  let pendingCredentialData = null;
  let pendingPatientInviteData = null;
  let chatNotificationBaselineReady = false;
  let lastChatNotificationId = '';
  let chatRequestSequence = 0;
  let chatSpeechRecognition = null;
  let chatSpeechTarget = null;
  let backupTimeline = [];
  let backupTimelineLoading = false;
  let backupTimelineError = '';
  let pendingBulkCredentials = [];
  let bulkProvisionRunning = false;
  let calendarTooltipElement = null;
  let deferredExternalState = null;
  const LOGO_DB_NAME = 'humanevo-assets-v1';
  const LOGO_STORE = 'assets';
  const AUDIT_STORE = 'auditSnapshots';
  const AUDITABLE_KEYS = ['patients','appointments','assessmentRecords','customForms','patientStatuses','supportTickets','formAssignments','notifications','accessProfiles','integrations','customization','rolePermissions','userPermissionExceptions','chatThreads','chatMessages'];
  let lastAuditableSnapshot = null;
  let skipNextModificationCapture = false;

  const temperamentQuestions = [{"n": 1, "text": "Fica com logo com raiva quando o ofendem, e tende a se vingar e responder com um insulto imediatamente?"}, {"n": 2, "text": "Olha a vida sempre do ponto de vista mais sério?"}, {"n": 3, "text": "Perde com facilidade a confiança nas pessoas mais próximas?"}, {"n": 4, "text": "É muito inclinado a adular (agradar,bajular) as pessoas que ama?"}, {"n": 5, "text": "Aceita as explicações cheias razões e motivos, mas fica irritado e resistente quando lhe dão ordens severas?"}, {"n": 6, "text": "Gosta de estar acompanhado e dos divertimentos?"}, {"n": 7, "text": "Seu pensamento facilmente se torna reflexivo, o que chega a atormentá-lo interiormente, mas sem deixar que os outros percebam?"}, {"n": 8, "text": "Fica perturbado pela desordem ou pela injustiça?"}, {"n": 9, "text": "Tem ou demonstra pouco interesse pelo que se passa consigo mesmo?"}, {"n": 10, "text": "Encontra dificuldade em confiar nas pessoas e sempre teme que os outros lhe guardem rancor?"}, {"n": 11, "text": "Não gosta de longas reflexões e se distrai facilmente?"}, {"n": 12, "text": "Geralmente não se abala tanto no momento de uma ofensa, mas se sente muito pior algumas horas depois, ou até mesmo no dia seguinte?"}, {"n": 13, "text": "Encontra dificuldade em negar a si mesmo a sua comida favorita?"}, {"n": 14, "text": "Irrita-se facilmente por uma ofensa, mas pouco tempo depois volta a ser amável?"}, {"n": 15, "text": "É uma pessoa entusiasta, não ficando satisfeito, por exemplo, com o quotidiano, mas aspira a coisas nobres e boas, temporais ou espirituais?"}, {"n": 16, "text": "Geralmente não gosta de admitir uma debilidade ou derrota, tentando, como consequência, esconder dos outros, inclusive por meio de mentiras evidentes?"}, {"n": 17, "text": "Gosta do silêncio, da solidão e de estar afastado da multidão?"}, {"n": 18, "text": "Fica facilmente com ciúmes, inveja ou pouco caritativo?"}, {"n": 19, "text": "Sente-se à vontade quando está em uma posição de comando?"}, {"n": 20, "text": "Passa muito tempo deliberando, ainda que lhe custe muito tomar decisões? (Deliberar: Tomar uma decisão após pensar, analisar ou refletir)"}, {"n": 21, "text": "Gosta que o adulem (agradem, bajulem)?"}, {"n": 22, "text": "Queixa-se por indisposições insignificantes e com frequência teme estar gravemente doente?"}, {"n": 23, "text": "Tem grande tendência a relaxar-se, comendo e bebendo?"}, {"n": 24, "text": "Facilmente se desanima pelas dificuldades em seus empreendimentos ou intentos?"}, {"n": 25, "text": "Encontra dificuldade em conhecer novas pessoas, falar entre estranhos, encontrar as palavras corretas para expressar seus sentimentos?"}, {"n": 26, "text": "É muito preocupado com a própria aparência e a dos demais, desde o rosto bonito até a roupa elegante e moderna?"}, {"n": 27, "text": "Persevera, mesmo com grandes dificuldades, até conseguir alcançar seu objetivo?"}, {"n": 28, "text": "Fica desconfiado e reservado diante de uma palavra rude ou uma expressão facial pouco amistosa?"}, {"n": 29, "text": "Acha difícil guardar os olhos, os ouvidos, a língua e ficar calado?"}, {"n": 30, "text": "Aborrece aparecer em público e ser elogiado?"}, {"n": 31, "text": "Deixa que os outros sejam preferidos, mas ao mesmo tempo se sente diminuído por estar sendo ignorado?"}, {"n": 32, "text": "Desagradam-lhe (e inclusive chega a odiar) as carícias e o sentimentalismo?"}, {"n": 33, "text": "Demonstra-se despreocupado (e até mesmo cruel), com respeito ao sofrimento dos demais, chegando a não se importar com o bem-estar dos outros se não pode alcançar de outra maneira suas próprias metas?"}, {"n": 34, "text": "É pouco inclinado a trabalhar, preferindo o descanso e o tempo livre?"}, {"n": 35, "text": "Não é perseverante, ou perde rapidamente o interesse no que faz?"}, {"n": 36, "text": "É inclinado a uma desordenada proximidade a outras pessoas e/ou a ser paquerador?"}, {"n": 37, "text": "Não gosta de corrigir os outros, o que se demonstra de duas formas: a) corrige de maneira tão discreta que os outros nem percebem; b) grita com raiva e irritação para corrigir?"}, {"n": 38, "text": "Vê tudo, ouve tudo e fala de tudo?"}, {"n": 39, "text": "Ama o trabalho leve que chama a atenção, no qual não seja necessária reflexão nem muito esforço?"}, {"n": 40, "text": "Considera a si mesmo alguém tão extraordinário que tem sempre razão, de modo que não precisa da ajuda dos demais?"}, {"n": 41, "text": "Menospreza ou persegue, inclusive mediante comentários e meios injustos, aos que se atrevem a se lhe opor?"}, {"n": 42, "text": "Pode passar rapidamente das lágrimas ao riso e vice-versa?"}, {"n": 43, "text": "Cativa-o facilmente uma nova ideia ou ambiente?"}, {"n": 44, "text": "Gosta de variedade em tudo?"}, {"n": 45, "text": "Mantém-se composto, pensativo, reflexivo, com juízo sensato e prático ao enfrentar o sofrimento, o fracasso ou as ofensas?"}, {"n": 46, "text": "Gosta de rir ou tirar sarro dos outros, fazer piadas?"}, {"n": 47, "text": "Surge facilmente uma aversão em seu coração contra uma pessoa que o fez sofrer ou que pisou na bola, aversão às vezes tão forte que o faz não querer lhe falar ou não poder vê-la sem fechar o semblante?"}, {"n": 48, "text": "Chateia-se com a oposição, a resistência e as ofensas pessoais e manifesta sua raiva com palavras severas que parecem corretas, mas que podem chegar a ferir a outra pessoa?"}, {"n": 49, "text": "Qual destas disposições são as suas? Escolha uma ou duas opções: a) obstinação, raiva, orgulho; b) preguiça, falta de energia; c) falta de coragem, evasão do sofrimento; d) verborreia, falta de coerência."}, {"n": 50, "text": "Qual destas características lhe são naturais? Escolha uma ou duas opções: a) bom caráter, tranquilo; b) empatia com os outros, amor pela solidão e pela oração; c) vontade firme, energia, audácia, ambição; d) alegria, facilidade para lidar bem com pessoas difíceis."}];
  const temperamentScores = {
    colerico: ['1','5','8','15','16','19','27','32','33','40','41','47','48','49a','50c'],
    sanguineo: ['4','6','11','13','14','20','21','24','26','29','34','35','36','38','39','42','43','44','46','49d','50d'],
    melancolico: ['2','3','5','7','8','10','12','13','17','18','20','22','24','25','28','30','31','37','47','49c','50b'],
    fleumatico: ['9','23','34','35','45','49b','50a']
  };

  const assessmentGroups = {
    'Clínica e saúde mental': [
      ['Triagem psicológica','triage','Levantamento inicial da demanda, urgência, contexto e encaminhamento.'],
      ['Avaliação psicológica clínica','clinical','Compreensão integrada do funcionamento emocional, comportamental e relacional.'],
      ['Psicodiagnóstico','clinical','Processo clínico aprofundado para hipóteses, compreensão e conduta.'],
      ['Diagnóstico diferencial','clinical','Comparação estruturada entre hipóteses clínicas com sintomas semelhantes.'],
      ['Planejamento terapêutico','treatment','Objetivos, prioridades, recursos, barreiras e plano de cuidado.'],
      ['Acompanhamento terapêutico','followup','Monitoramento longitudinal de evolução, adesão e necessidades.'],
      ['Avaliação de resultados','outcome','Revisão dos resultados percebidos e indicadores de mudança.'],
      ['Avaliação psicopatológica','clinical','Registro clínico de sinais, sintomas, curso e impacto funcional.'],
      ['Risco de suicídio','risk','Roteiro profissional de segurança e fatores de proteção.'],
      ['Risco de violência','risk','Análise contextual de risco, proteção e plano de segurança.'],
      ['Trauma psicológico','trauma','História, gatilhos, impacto e recursos de estabilização.'],
      ['Ansiedade','symptoms','Sintomas, frequência, situações disparadoras e prejuízo funcional.'],
      ['Humor e sintomas depressivos','symptoms','Humor, energia, interesse, sono e impacto cotidiano.'],
      ['Estresse','symptoms','Fontes de tensão, manifestações e estratégias de enfrentamento.'],
      ['Burnout','occupational','Exaustão, distanciamento e impacto profissional.'],
      ['Autoestima e autoimagem','emotional','Percepção de valor pessoal, confiança e imagem de si.'],
      ['Regulação emocional','emotional','Identificação, expressão e manejo das emoções.'],
      ['Bem-estar psicológico','wellbeing','Satisfação, propósito, vínculos e equilíbrio.'],
      ['Estratégias de enfrentamento','emotional','Recursos utilizados diante de dificuldades e crises.'],
      ['Qualidade de vida','wellbeing','Bem-estar físico, emocional, social e funcional.'],
      ['Sono','health','Rotina, qualidade, duração, despertares e impacto diurno.'],
      ['Dor e impacto psicológico','health','Experiência da dor, pensamentos, emoções e funcionalidade.'],
      ['Adesão ao tratamento','health','Facilitadores e barreiras ao seguimento do cuidado.'],
      ['Comportamento alimentar','health','Hábitos, gatilhos, crenças e relação com alimentação.'],
      ['Uso de álcool e outras drogas','substance','Padrão de uso, consequências, contexto e proteção.']
    ],
    'Cognição e neuropsicologia': [
      ['Inteligência e habilidades gerais','cognitive','Perfil geral de habilidades cognitivas e raciocínio.'],
      ['Raciocínio lógico e abstrato','cognitive','Estratégias de solução, compreensão e flexibilidade.'],
      ['Atenção','attention','Atenção sustentada, seletiva, alternada e dividida.'],
      ['Memória','memory','Memória imediata, de trabalho, visual, verbal e tardia.'],
      ['Funções executivas','executive','Planejamento, inibição, flexibilidade e monitoramento.'],
      ['Velocidade de processamento','cognitive','Rapidez, precisão e consistência na resposta.'],
      ['Linguagem','language','Compreensão, expressão, fluência e organização do discurso.'],
      ['Habilidades visuoespaciais','visuospatial','Orientação espacial, percepção de formas e relações.'],
      ['Habilidades visuoconstrutivas','visuospatial','Organização e reprodução de estímulos visuais.'],
      ['Percepção','perception','Discriminação e interpretação de estímulos.'],
      ['Psicomotricidade','motor','Coordenação, ritmo, lateralidade e integração motora.'],
      ['Criatividade','cognitive','Fluência, originalidade, flexibilidade e elaboração.'],
      ['Metacognição','cognitive','Consciência e monitoramento do próprio processo de pensar.'],
      ['Avaliação neuropsicológica','neuro','Integração entre cognição, comportamento, emoções e funcionalidade.'],
      ['Comprometimento cognitivo','neuro','Mudanças percebidas e impacto no funcionamento diário.'],
      ['Demências','neuro','Investigação de declínio cognitivo e autonomia funcional.']
    ],
    'Personalidade e comportamento': [
      ['Personalidade','personality','Padrões de pensamento, emoção, comportamento e relacionamento.'],
      ['Traços de personalidade','personality','Características predominantes e expressão em diferentes contextos.'],
      ['Inteligência emocional','emotional','Percepção, compreensão e manejo das emoções.'],
      ['Motivação','motivation','Direcionadores, persistência e significado das metas.'],
      ['Valores pessoais','motivation','Princípios e prioridades que orientam decisões.'],
      ['Interesses','motivation','Preferências, temas de interesse e experiências de engajamento.'],
      ['Impulsividade','behavior','Controle inibitório, urgência e antecipação de consequências.'],
      ['Agressividade','behavior','Expressões verbais, físicas e relacionais de agressividade.'],
      ['Resiliência','wellbeing','Recursos para adaptação e recuperação diante de adversidades.'],
      ['Habilidades sociais','social','Assertividade, empatia, comunicação e resolução de conflitos.'],
      ['Relações interpessoais','social','Padrões de vínculo, limites, confiança e reciprocidade.'],
      ['Adaptação e funcionamento adaptativo','adaptive','Autonomia, rotina e resposta às demandas do contexto.'],
      ['Tomada de decisão','executive','Critérios, riscos, alternativas e consequências.'],
      ['Vínculos e apego','relationships','Formas de proximidade, segurança, confiança e afastamento.'],
      ['Dinâmica familiar','family','Papéis, comunicação, conflitos, alianças e limites.'],
      ['Competências parentais','family','Cuidado, proteção, responsividade e organização da rotina.'],
      ['Questionário dos 4 Temperamentos','temperaments','Formulário de 50 questões baseado no material fornecido.']
    ],
    'Desenvolvimento e aprendizagem': [
      ['Desenvolvimento infantil','development','Marcos cognitivos, sociais, emocionais, motores e comunicacionais.'],
      ['Desenvolvimento do adolescente','development','Identidade, autonomia, relações, escola e comportamento.'],
      ['Atrasos do desenvolvimento','development','Áreas de desenvolvimento com sinais de atraso ou necessidade de suporte.'],
      ['Deficiência intelectual','adaptive','Funcionamento intelectual e habilidades adaptativas.'],
      ['Altas habilidades e superdotação','development','Potencial elevado, criatividade e desempenho específico.'],
      ['Transtornos do neurodesenvolvimento','development','Sinais, história e impacto em múltiplos contextos.'],
      ['Autismo - investigação clínica','development','Comunicação social, padrões restritos, sensorialidade e desenvolvimento.'],
      ['TDAH - investigação clínica','attention','Atenção, impulsividade, hiperatividade e prejuízo funcional.'],
      ['Avaliação psicológica escolar','education','Contexto escolar, aprendizagem, relações e barreiras.'],
      ['Avaliação psicoeducacional','education','Integração entre aprendizagem, cognição, comportamento e contexto.'],
      ['Dificuldades de aprendizagem','education','Leitura, escrita, matemática, atenção e estratégias de estudo.'],
      ['Transtornos específicos da aprendizagem','education','História, desempenho e impacto acadêmico.'],
      ['Prontidão escolar','education','Habilidades necessárias para a etapa escolar.'],
      ['Desempenho acadêmico','education','Pontos fortes, dificuldades e evolução educacional.'],
      ['Hábitos e métodos de estudo','education','Rotina, organização, planejamento e autorregulação.'],
      ['Adaptação escolar','education','Integração, vínculos, regras e participação.'],
      ['Bullying e violência escolar','risk','Experiências de agressão, proteção e impacto emocional.'],
      ['Inclusão educacional','education','Barreiras, acessibilidade, apoios e adaptações.']
    ],
    'Carreira e organizações': [
      ['Avaliação vocacional','career','Interesses, valores, habilidades e possibilidades profissionais.'],
      ['Orientação profissional','career','Escolha de curso, profissão ou área de atuação.'],
      ['Planejamento de carreira','career','Objetivos, competências, oportunidades e plano de desenvolvimento.'],
      ['Transição de carreira','career','Motivações, recursos, riscos e possibilidades de mudança.'],
      ['Preparação para aposentadoria','career','Identidade, rotina, vínculos e planejamento da nova fase.'],
      ['Empregabilidade','career','Competências, posicionamento e barreiras de inserção profissional.'],
      ['Recrutamento e seleção','occupational','Compatibilidade entre perfil, contexto e requisitos da função.'],
      ['Potencial profissional','occupational','Capacidades atuais e potencial de desenvolvimento.'],
      ['Competências','occupational','Conhecimentos, habilidades, atitudes e evidências comportamentais.'],
      ['Perfil profissional','occupational','Estilo de trabalho, comunicação, decisão e relacionamento.'],
      ['Liderança','leadership','Influência, comunicação, decisão, delegação e conflitos.'],
      ['Promoção e sucessão','leadership','Prontidão para responsabilidades ampliadas.'],
      ['Desempenho','occupational','Entregas, comportamentos, metas e desenvolvimento.'],
      ['Clima organizacional','organizational','Percepção sobre ambiente, liderança, comunicação e suporte.'],
      ['Cultura organizacional','organizational','Valores, crenças, práticas e padrões de comportamento.'],
      ['Engajamento','organizational','Vínculo, energia, significado e disposição para contribuir.'],
      ['Satisfação no trabalho','occupational','Percepção sobre atividade, condições e reconhecimento.'],
      ['Riscos psicossociais','occupational','Demandas, autonomia, assédio, apoio e organização do trabalho.'],
      ['Saúde mental ocupacional','occupational','Impactos psicológicos relacionados ao trabalho.'],
      ['Prontidão para função crítica','risk','Condições psicológicas e contextuais para atividades críticas.'],
      ['Avaliação de equipes','organizational','Comunicação, confiança, cooperação e conflitos.']
    ],
    'Família, jurídico e contextos especiais': [
      ['Avaliação de casal','relationships','Comunicação, vínculo, conflitos, acordos e objetivos.'],
      ['Avaliação familiar','family','Funcionamento, papéis, comunicação e necessidades.'],
      ['Avaliação psicossocial','psychosocial','Aspectos psicológicos, familiares, sociais e ambientais.'],
      ['Avaliação forense','forensic','Roteiro técnico para responder a quesitos jurídicos.'],
      ['Perícia psicológica judicial','forensic','Planejamento, fontes, documentos, hipóteses e resposta pericial.'],
      ['Guarda e convivência familiar','forensic','Vínculos, cuidado, rotina e necessidades da criança.'],
      ['Adoção','forensic','Motivações, expectativas, preparo e rede de apoio.'],
      ['Violência doméstica','risk','Contexto, impacto, risco, proteção e encaminhamento.'],
      ['Dano psicológico','forensic','Evento, nexo, impacto, evolução e funcionalidade.'],
      ['Capacidade civil','forensic','Compreensão, autonomia, decisão e suporte necessário.'],
      ['Vulnerabilidade social','psychosocial','Riscos, recursos, rede e acesso a direitos.'],
      ['Rede de apoio','psychosocial','Disponibilidade, qualidade e estabilidade dos apoios.'],
      ['Migração e refúgio','psychosocial','Adaptação, perdas, trauma, identidade e suporte.'],
      ['Pessoas com deficiência','adaptive','Funcionalidade, autonomia, barreiras e apoios.'],
      ['Acessibilidade e inclusão','adaptive','Adaptações, participação e barreiras contextuais.']
    ],
    'Saúde, hospital e esporte': [
      ['Avaliação psicológica hospitalar','health','Impacto emocional da doença, internação e tratamento.'],
      ['Avaliação pré-cirúrgica','health','Compreensão, expectativas, adesão, suporte e riscos.'],
      ['Cirurgia bariátrica','health','Comportamento alimentar, expectativas, suporte e autocuidado.'],
      ['Transplante','health','Compreensão, adesão, suporte e condições emocionais.'],
      ['Doenças crônicas','health','Adaptação, enfrentamento, adesão e qualidade de vida.'],
      ['Cuidados paliativos','health','Sofrimento, sentido, comunicação e necessidades familiares.'],
      ['Emergências e desastres','trauma','Reações agudas, proteção, trauma e necessidades imediatas.'],
      ['Avaliação psicológica esportiva','sports','Fatores mentais relacionados ao treino e competição.'],
      ['Motivação esportiva','sports','Objetivos, persistência e vínculo com a prática.'],
      ['Ansiedade competitiva','sports','Reações cognitivas, emocionais e fisiológicas na competição.'],
      ['Concentração esportiva','attention','Foco, distrações e recuperação da atenção.'],
      ['Coesão de equipe','sports','Confiança, comunicação, pertencimento e objetivos coletivos.'],
      ['Desempenho mental','sports','Foco, autoconfiança, decisão e manejo de pressão.'],
      ['Retorno após lesão','sports','Medo, confiança, prontidão e expectativas de retorno.']
    ]
  };

  const templateSchemas = {
    triage: [
      ['Motivo principal da procura','textarea'],['Urgência percebida','select',['Baixa','Moderada','Alta','Imediata']],['Há risco atual?','select',['Não identificado','Necessita investigação','Sim - plano de segurança']],['Contexto familiar/social','textarea'],['Objetivo esperado','textarea'],['Encaminhamento inicial','textarea']
    ],
    clinical: [
      ['Demanda e queixa principal','textarea'],['Início e evolução','textarea'],['Sintomas e frequência','textarea'],['Impacto funcional','textarea'],['Histórico pessoal e familiar','textarea'],['Hipóteses clínicas','textarea'],['Recursos e fatores de proteção','textarea'],['Conduta proposta','textarea']
    ],
    treatment: [['Objetivos terapêuticos','textarea'],['Prioridades','textarea'],['Metas observáveis','textarea'],['Intervenções previstas','textarea'],['Frequência sugerida','select',['Semanal','Quinzenal','Mensal','A definir']],['Indicadores de evolução','textarea']],
    followup: [['Mudanças desde o último encontro','textarea'],['Adesão às orientações','select',['Baixa','Parcial','Boa','Muito boa']],['Sintomas atuais','textarea'],['Conquistas','textarea'],['Dificuldades','textarea'],['Próximos passos','textarea']],
    outcome: [['Objetivos avaliados','textarea'],['Mudanças percebidas','textarea'],['Indicadores de evolução','textarea'],['Aspectos sem mudança','textarea'],['Feedback do paciente','textarea'],['Decisão clínica','select',['Manter plano','Ajustar plano','Encaminhar','Alta acompanhada']]],
    risk: [['Descrição do risco','textarea'],['Fatores de risco','textarea'],['Fatores de proteção','textarea'],['Acesso a meios/contextos','textarea'],['Rede acionada','textarea'],['Plano de segurança','textarea'],['Encaminhamento imediato','textarea']],
    trauma: [['Evento(s) relevante(s)','textarea'],['Reações atuais','textarea'],['Gatilhos','textarea'],['Evitação e hipervigilância','textarea'],['Impacto funcional','textarea'],['Recursos de estabilização','textarea'],['Plano de cuidado','textarea']],
    symptoms: [['Sintomas principais','textarea'],['Frequência','select',['Raro','Alguns dias','Frequente','Quase diário']],['Intensidade','range'],['Situações disparadoras','textarea'],['Impacto na rotina','textarea'],['Estratégias utilizadas','textarea']],
    emotional: [['Emoções predominantes','textarea'],['Situações associadas','textarea'],['Formas de expressão','textarea'],['Estratégias de regulação','textarea'],['Dificuldades percebidas','textarea'],['Recursos pessoais','textarea']],
    wellbeing: [['Satisfação com a vida','range'],['Qualidade dos vínculos','range'],['Senso de propósito','range'],['Autonomia percebida','range'],['Rotina de autocuidado','textarea'],['Aspectos prioritários','textarea']],
    health: [['Condição de saúde/contexto','textarea'],['Compreensão do quadro','textarea'],['Impacto emocional','textarea'],['Adesão e autocuidado','textarea'],['Rede de apoio','textarea'],['Riscos/barreiras','textarea'],['Orientação/encaminhamento','textarea']],
    substance: [['Substância/comportamento','textarea'],['Frequência e quantidade','textarea'],['Contexto de uso','textarea'],['Consequências percebidas','textarea'],['Tentativas de mudança','textarea'],['Fatores de proteção','textarea'],['Plano/encaminhamento','textarea']],
    cognitive: [['Queixa cognitiva','textarea'],['Contexto de ocorrência','textarea'],['Desempenho observado','textarea'],['Estratégias utilizadas','textarea'],['Fatores interferentes','textarea'],['Impacto funcional','textarea'],['Síntese profissional','textarea']],
    attention: [['Sustentação do foco','select',['Adequada','Oscilante','Reduzida','A investigar']],['Distrações frequentes','textarea'],['Organização e conclusão','textarea'],['Impulsividade','textarea'],['Contextos de maior dificuldade','textarea'],['Impacto funcional','textarea']],
    memory: [['Tipo de queixa','textarea'],['Início/evolução','textarea'],['Memória imediata','textarea'],['Memória recente','textarea'],['Memória remota','textarea'],['Estratégias compensatórias','textarea'],['Impacto funcional','textarea']],
    executive: [['Planejamento','textarea'],['Organização','textarea'],['Controle inibitório','textarea'],['Flexibilidade cognitiva','textarea'],['Tomada de decisão','textarea'],['Monitoramento','textarea']],
    language: [['Compreensão','textarea'],['Expressão','textarea'],['Fluência','textarea'],['Vocabulário','textarea'],['Pragmática/comunicação social','textarea'],['Impacto funcional','textarea']],
    visuospatial: [['Orientação espacial','textarea'],['Percepção de formas','textarea'],['Organização visual','textarea'],['Construção/cópia','textarea'],['Impacto funcional','textarea']],
    perception: [['Modalidade investigada','select',['Visual','Auditiva','Tátil','Multimodal']],['Discriminação de estímulos','textarea'],['Interpretação','textarea'],['Fatores interferentes','textarea'],['Síntese','textarea']],
    motor: [['Coordenação global','textarea'],['Coordenação fina','textarea'],['Lateralidade','textarea'],['Ritmo e equilíbrio','textarea'],['Integração visuomotora','textarea']],
    neuro: [['Queixa e história','textarea'],['Condições médicas/neurológicas','textarea'],['Funções investigadas','textarea'],['Atividades de vida diária','textarea'],['Mudanças comportamentais','textarea'],['Hipóteses e recomendações','textarea']],
    personality: [['Traços predominantes','textarea'],['Autopercepção','textarea'],['Relacionamentos','textarea'],['Manejo de conflitos','textarea'],['Tomada de decisão','textarea'],['Recursos e vulnerabilidades','textarea']],
    motivation: [['Objetivos atuais','textarea'],['Fontes de motivação','textarea'],['Valores associados','textarea'],['Barreiras','textarea'],['Persistência','textarea'],['Próximos passos','textarea']],
    behavior: [['Comportamento-alvo','textarea'],['Antecedentes','textarea'],['Descrição observável','textarea'],['Consequências','textarea'],['Frequência/intensidade','textarea'],['Hipótese funcional','textarea'],['Plano de intervenção','textarea']],
    social: [['Comunicação','textarea'],['Assertividade','textarea'],['Empatia','textarea'],['Limites','textarea'],['Resolução de conflitos','textarea'],['Contextos de dificuldade','textarea']],
    adaptive: [['Autocuidado','textarea'],['Rotina doméstica','textarea'],['Mobilidade/comunidade','textarea'],['Comunicação funcional','textarea'],['Autonomia decisória','textarea'],['Suportes necessários','textarea']],
    relationships: [['Qualidade do vínculo','textarea'],['Comunicação','textarea'],['Confiança e segurança','textarea'],['Conflitos recorrentes','textarea'],['Limites e acordos','textarea'],['Objetivos de intervenção','textarea']],
    family: [['Composição familiar','textarea'],['Papéis e responsabilidades','textarea'],['Comunicação','textarea'],['Conflitos e alianças','textarea'],['Rotina e cuidado','textarea'],['Recursos e rede','textarea']],
    development: [['História gestacional e neonatal','textarea'],['Marcos motores','textarea'],['Linguagem e comunicação','textarea'],['Interação social','textarea'],['Comportamento e sensorialidade','textarea'],['Escola e aprendizagem','textarea'],['Autonomia','textarea']],
    education: [['Demanda escolar','textarea'],['Histórico acadêmico','textarea'],['Leitura e escrita','textarea'],['Matemática','textarea'],['Atenção e organização','textarea'],['Aspectos emocionais','textarea'],['Apoios/adaptações','textarea']],
    career: [['História acadêmica/profissional','textarea'],['Interesses','textarea'],['Valores de carreira','textarea'],['Competências percebidas','textarea'],['Preferências de ambiente','textarea'],['Possibilidades consideradas','textarea'],['Plano de ação','textarea']],
    occupational: [['Contexto e função','textarea'],['Demandas e recursos','textarea'],['Competências observadas','textarea'],['Saúde e bem-estar','textarea'],['Riscos psicossociais','textarea'],['Recomendações','textarea']],
    leadership: [['Estilo de liderança','textarea'],['Comunicação','textarea'],['Decisão','textarea'],['Delegação','textarea'],['Gestão de conflitos','textarea'],['Desenvolvimento da equipe','textarea']],
    organizational: [['Unidade/equipe','text'],['Objetivo da avaliação','textarea'],['Percepções predominantes','textarea'],['Pontos fortes','textarea'],['Riscos e barreiras','textarea'],['Ações recomendadas','textarea']],
    psychosocial: [['Contexto de vida','textarea'],['Vulnerabilidades','textarea'],['Renda/moradia/trabalho','textarea'],['Vínculos e rede','textarea'],['Acesso a serviços e direitos','textarea'],['Fatores de proteção','textarea'],['Encaminhamentos','textarea']],
    forensic: [['Demanda/quesito','textarea'],['Documentos analisados','textarea'],['Fontes de informação','textarea'],['Procedimentos realizados','textarea'],['Achados relevantes','textarea'],['Limitações','textarea'],['Resposta técnica','textarea']],
    sports: [['Modalidade e nível','text'],['Objetivos esportivos','textarea'],['Motivação','textarea'],['Foco e concentração','textarea'],['Ansiedade/pressão','textarea'],['Autoconfiança','textarea'],['Plano mental','textarea']]
  };

  const assessmentCatalog = [];
  let assessmentCounter = 1;
  Object.entries(assessmentGroups).forEach(([category, rows]) => {
    rows.forEach(([title, template, description]) => {
      assessmentCatalog.push({
        id: `assess-${assessmentCounter++}`,
        title, category, template, description,
        duration: template === 'temperaments' ? 18 : 12,
        access: template === 'temperaments' ? 'Complementar' : 'Formulário profissional',
        source: template === 'temperaments' ? 'Material fornecido pelo usuário' : 'Modelo clínico estruturado',
        references: template === 'temperaments' ? ['HOCK, Conrad. Os Temperamentos. Referência indicada no material fornecido pelo usuário.'] : []
      });
    });
  });

  const emailTemplates = [
    {id:'appointment',title:'Confirmação de consulta',subject:'Humanevo | Confirmação da sua consulta',body:p=>`Olá, ${firstName(p.name)}.\n\nConfirmamos sua consulta na Humanevo.\n\nData e horário: [PREENCHER]\nModalidade/local: [PREENCHER]\n\nCaso precise remarcar, responda a esta mensagem com antecedência.\n\nAtenciosamente,\nEquipe Humanevo`},
    {id:'reminder',title:'Lembrete de consulta',subject:'Humanevo | Lembrete da sua consulta',body:p=>`Olá, ${firstName(p.name)}.\n\nPassando para lembrar da sua consulta agendada para [DATA] às [HORÁRIO].\n\nEstamos à disposição caso necessite de algum ajuste.\n\nAtenciosamente,\nEquipe Humanevo`},
    {id:'assessment',title:'Envio de avaliação',subject:'Humanevo | Avaliação disponível',body:p=>`Olá, ${firstName(p.name)}.\n\nUma avaliação foi disponibilizada para você. Reserve um momento tranquilo e responda com sinceridade.\n\nAvaliação: [NOME]\nPrazo sugerido: [DATA]\nLink: [LINK]\n\nO formulário não substitui a avaliação profissional e será analisado em conjunto com o acompanhamento clínico.\n\nAtenciosamente,\nEquipe Humanevo`},
    {id:'followup',title:'Acompanhamento',subject:'Humanevo | Acompanhamento do seu cuidado',body:p=>`Olá, ${firstName(p.name)}.\n\nGostaríamos de saber como você está desde nosso último encontro. Se possível, responda brevemente como se sentiu e se houve alguma mudança relevante.\n\nAtenciosamente,\nEquipe Humanevo`},
    {id:'absence',title:'Ausência e remarcação',subject:'Humanevo | Remarcação de consulta',body:p=>`Olá, ${firstName(p.name)}.\n\nNotamos que não foi possível realizar a consulta prevista. Deseja verificar uma nova data?\n\nEnvie seus melhores dias e horários para organizarmos a remarcação.\n\nAtenciosamente,\nEquipe Humanevo`},
    {id:'referral',title:'Encaminhamento',subject:'Humanevo | Orientação de encaminhamento',body:p=>`Olá, ${firstName(p.name)}.\n\nConforme conversamos, indicamos o seguinte encaminhamento: [DESCREVER].\n\nObjetivo: [DESCREVER]\nProfissional/serviço sugerido: [DESCREVER]\nOrientações adicionais: [DESCREVER]\n\nAtenciosamente,\nEquipe Humanevo`},
    {id:'discharge',title:'Alta e continuidade do cuidado',subject:'Humanevo | Síntese e continuidade do cuidado',body:p=>`Olá, ${firstName(p.name)}.\n\nRegistramos a conclusão desta etapa do acompanhamento. Parabéns pelo percurso e pelas conquistas alcançadas.\n\nRecomendações para continuidade: [PREENCHER]\nSinais para buscar novo apoio: [PREENCHER]\n\nA Humanevo permanece disponível quando necessário.\n\nAtenciosamente,\nEquipe Humanevo`}
  ];

  const initialPatients = [
  {
    "id": "p1",
    "name": "Marina Alves",
    "email": "marina.alves@example.com",
    "phone": "(65) 99911-2034",
    "birth": "1992-04-18",
    "status": "active",
    "risk": "low",
    "demand": "Ansiedade, sobrecarga profissional e dificuldade de sono.",
    "tags": [
      "Ansiedade",
      "Sono",
      "Carreira"
    ],
    "next": "2026-08-02T09:00",
    "last": "2026-07-02",
    "sessions": 8,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 72,
    "blockReason": "",
    "history": [
      {
        "id": "h1",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-02",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p2",
    "name": "Lucas Ribeiro",
    "email": "lucas.ribeiro@example.com",
    "phone": "(65) 99871-5540",
    "birth": "1986-11-02",
    "status": "active",
    "risk": "moderate",
    "demand": "Conflitos familiares, irritabilidade e dificuldade de comunicação.",
    "tags": [
      "Família",
      "Regulação emocional"
    ],
    "next": "2026-08-03T10:00",
    "last": "2026-07-03",
    "sessions": 5,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 48,
    "blockReason": "",
    "history": [
      {
        "id": "h2",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-03",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p3",
    "name": "Ana Carolina Silva",
    "email": "ana.silva@example.com",
    "phone": "(65) 99702-1115",
    "birth": "1998-08-29",
    "status": "active",
    "risk": "low",
    "demand": "Autoconhecimento, planejamento de carreira e insegurança decisória.",
    "tags": [
      "Carreira",
      "Autoestima"
    ],
    "next": "2026-08-04T11:00",
    "last": "2026-07-04",
    "sessions": 4,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 55,
    "blockReason": "",
    "history": [
      {
        "id": "h3",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-04",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p4",
    "name": "Carlos Henrique Souza",
    "email": "carlos.souza@example.com",
    "phone": "(65) 99612-0808",
    "birth": "1979-01-07",
    "status": "high",
    "risk": "none",
    "demand": "Processo concluído após alcance dos objetivos terapêuticos.",
    "tags": [
      "Alta",
      "Acompanhamento"
    ],
    "next": null,
    "last": "2026-07-05",
    "sessions": 18,
    "diagnosis": "Síntese clínica concluída conforme processo terapêutico.",
    "prognosis": "Favorável, com recursos de manutenção e prevenção de recaída.",
    "recommendation": "Manter práticas de autocuidado e retornar se necessário.",
    "referral": "Alta acompanhada; sem encaminhamento atual.",
    "treatmentProgress": 100,
    "blockReason": "",
    "history": [
      {
        "id": "h4",
        "type": "discharge",
        "title": "Alta terapêutica",
        "date": "2026-07-05",
        "content": "Objetivos principais alcançados e plano de continuidade registrado."
      }
    ],
    "evidences": []
  },
  {
    "id": "p5",
    "name": "Juliana Mendes",
    "email": "juliana.mendes@example.com",
    "phone": "(65) 99530-7755",
    "birth": "1990-09-12",
    "status": "dropout",
    "risk": "none",
    "demand": "Interrupção do processo por indisponibilidade de agenda.",
    "tags": [
      "Desistente",
      "Contato pendente"
    ],
    "next": null,
    "last": "2026-07-06",
    "sessions": 3,
    "diagnosis": "Processo interrompido antes da conclusão.",
    "prognosis": "Não conclusivo devido à interrupção.",
    "recommendation": "Retomar acompanhamento quando houver disponibilidade.",
    "referral": "Sem encaminhamento formal.",
    "treatmentProgress": 24,
    "blockReason": "",
    "history": [
      {
        "id": "h5",
        "type": "dropout",
        "title": "Interrupção do acompanhamento",
        "date": "2026-07-06",
        "content": "Registro de desistência e tentativa de contato concluída."
      }
    ],
    "evidences": []
  },
  {
    "id": "p6",
    "name": "Pedro Nascimento",
    "email": "pedro.nascimento@example.com",
    "phone": "(65) 99943-6200",
    "birth": "2004-02-15",
    "status": "active",
    "risk": "moderate",
    "demand": "Dificuldades acadêmicas, desorganização e queixas atencionais.",
    "tags": [
      "Atenção",
      "Aprendizagem"
    ],
    "next": "2026-08-07T14:00",
    "last": "2026-07-07",
    "sessions": 6,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 46,
    "blockReason": "",
    "history": [
      {
        "id": "h6",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-07",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p7",
    "name": "Beatriz Oliveira",
    "email": "beatriz.oliveira@example.com",
    "phone": "(65) 99103-4471",
    "birth": "1995-05-21",
    "status": "active",
    "risk": "low",
    "demand": "Autoestima, vínculos afetivos e assertividade.",
    "tags": [
      "Autoestima",
      "Relacionamentos"
    ],
    "next": "2026-08-08T15:00",
    "last": "2026-07-08",
    "sessions": 10,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 68,
    "blockReason": "",
    "history": [
      {
        "id": "h7",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-08",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p8",
    "name": "Rafael Martins",
    "email": "rafael.martins@example.com",
    "phone": "(65) 99218-5109",
    "birth": "1988-03-14",
    "status": "pending",
    "risk": "moderate",
    "demand": "Estresse ocupacional e sinais de esgotamento.",
    "tags": [
      "Estresse",
      "Trabalho"
    ],
    "next": null,
    "last": "2026-07-09",
    "sessions": 1,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 12,
    "blockReason": "",
    "history": [
      {
        "id": "h8",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-09",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p9",
    "name": "Camila Ferreira",
    "email": "camila.ferreira@example.com",
    "phone": "(65) 99354-6632",
    "birth": "2001-12-08",
    "status": "active",
    "risk": "low",
    "demand": "Adaptação universitária e ansiedade social.",
    "tags": [
      "Ansiedade social",
      "Universidade"
    ],
    "next": "2026-08-10T08:00",
    "last": "2026-07-10",
    "sessions": 7,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 61,
    "blockReason": "",
    "history": [
      {
        "id": "h9",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-10",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p10",
    "name": "Henrique Costa",
    "email": "henrique.costa@example.com",
    "phone": "(65) 99470-2198",
    "birth": "1983-06-26",
    "status": "blocked",
    "risk": "moderate",
    "demand": "Acompanhamento temporariamente bloqueado por pendência administrativa.",
    "tags": [
      "Bloqueado",
      "Administrativo"
    ],
    "next": null,
    "last": "2026-07-11",
    "sessions": 2,
    "diagnosis": "Informações clínicas preservadas; atendimento suspenso temporariamente.",
    "prognosis": "A reavaliar após regularização do bloqueio.",
    "recommendation": "Resolver a pendência registrada antes de novo atendimento.",
    "referral": "Não aplicável durante o bloqueio.",
    "treatmentProgress": 18,
    "blockReason": "Pendência administrativa/documental registrada para teste.",
    "history": [
      {
        "id": "h10",
        "type": "note",
        "title": "Bloqueio temporário",
        "date": "2026-07-11",
        "content": "Acesso e processo suspensos até regularização da pendência informada."
      }
    ],
    "evidences": []
  },
  {
    "id": "p11",
    "name": "Sofia Almeida",
    "email": "sofia.almeida@example.com",
    "phone": "(65) 99582-0744",
    "birth": "1997-10-17",
    "status": "active",
    "risk": "low",
    "demand": "Luto e reorganização da rotina.",
    "tags": [
      "Luto",
      "Rotina"
    ],
    "next": "2026-08-12T10:00",
    "last": "2026-07-12",
    "sessions": 9,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 64,
    "blockReason": "",
    "history": [
      {
        "id": "h11",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-12",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p12",
    "name": "Gustavo Rocha",
    "email": "gustavo.rocha@example.com",
    "phone": "(65) 99691-3350",
    "birth": "1991-02-03",
    "status": "active",
    "risk": "high",
    "demand": "Crises de ansiedade com impacto funcional relevante.",
    "tags": [
      "Ansiedade",
      "Crise"
    ],
    "next": "2026-08-13T11:00",
    "last": "2026-07-13",
    "sessions": 12,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 57,
    "blockReason": "",
    "history": [
      {
        "id": "h12",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-13",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p13",
    "name": "Larissa Moreira",
    "email": "larissa.moreira@example.com",
    "phone": "(65) 99711-4802",
    "birth": "1989-07-30",
    "status": "high",
    "risk": "none",
    "demand": "Alta após consolidação de habilidades de regulação emocional.",
    "tags": [
      "Alta",
      "Regulação emocional"
    ],
    "next": null,
    "last": "2026-07-14",
    "sessions": 20,
    "diagnosis": "Síntese clínica concluída conforme processo terapêutico.",
    "prognosis": "Favorável, com recursos de manutenção e prevenção de recaída.",
    "recommendation": "Manter práticas de autocuidado e retornar se necessário.",
    "referral": "Alta acompanhada; sem encaminhamento atual.",
    "treatmentProgress": 100,
    "blockReason": "",
    "history": [
      {
        "id": "h13",
        "type": "discharge",
        "title": "Alta terapêutica",
        "date": "2026-07-14",
        "content": "Objetivos principais alcançados e plano de continuidade registrado."
      }
    ],
    "evidences": []
  },
  {
    "id": "p14",
    "name": "Eduardo Lima",
    "email": "eduardo.lima@example.com",
    "phone": "(65) 99806-7261",
    "birth": "1975-09-11",
    "status": "active",
    "risk": "moderate",
    "demand": "Adaptação após mudança de trabalho e cidade.",
    "tags": [
      "Adaptação",
      "Trabalho"
    ],
    "next": "2026-08-15T13:00",
    "last": "2026-07-15",
    "sessions": 5,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 44,
    "blockReason": "",
    "history": [
      {
        "id": "h14",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-15",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p15",
    "name": "Isabela Freitas",
    "email": "isabela.freitas@example.com",
    "phone": "(65) 99898-1143",
    "birth": "2000-01-25",
    "status": "pending",
    "risk": "low",
    "demand": "Triagem para dificuldades de sono e ansiedade.",
    "tags": [
      "Triagem",
      "Sono"
    ],
    "next": null,
    "last": "2026-07-16",
    "sessions": 0,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 5,
    "blockReason": "",
    "history": [
      {
        "id": "h15",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-16",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p16",
    "name": "André Barbosa",
    "email": "andre.barbosa@example.com",
    "phone": "(65) 99152-3977",
    "birth": "1984-04-09",
    "status": "active",
    "risk": "moderate",
    "demand": "Conflitos conjugais e comunicação não assertiva.",
    "tags": [
      "Casal",
      "Comunicação"
    ],
    "next": "2026-08-17T15:00",
    "last": "2026-07-17",
    "sessions": 11,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 63,
    "blockReason": "",
    "history": [
      {
        "id": "h16",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-17",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p17",
    "name": "Vitória Santos",
    "email": "vitoria.santos@example.com",
    "phone": "(65) 99265-8814",
    "birth": "1999-11-19",
    "status": "active",
    "risk": "low",
    "demand": "Organização de rotina e procrastinação.",
    "tags": [
      "Rotina",
      "Procrastinação"
    ],
    "next": "2026-08-18T16:00",
    "last": "2026-07-18",
    "sessions": 6,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 52,
    "blockReason": "",
    "history": [
      {
        "id": "h17",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-18",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p18",
    "name": "Marcelo Teixeira",
    "email": "marcelo.teixeira@example.com",
    "phone": "(65) 99340-6085",
    "birth": "1972-08-02",
    "status": "dropout",
    "risk": "none",
    "demand": "Desistência comunicada após mudança de domicílio.",
    "tags": [
      "Desistente",
      "Mudança"
    ],
    "next": null,
    "last": "2026-07-19",
    "sessions": 4,
    "diagnosis": "Processo interrompido antes da conclusão.",
    "prognosis": "Não conclusivo devido à interrupção.",
    "recommendation": "Retomar acompanhamento quando houver disponibilidade.",
    "referral": "Sem encaminhamento formal.",
    "treatmentProgress": 29,
    "blockReason": "",
    "history": [
      {
        "id": "h18",
        "type": "dropout",
        "title": "Interrupção do acompanhamento",
        "date": "2026-07-19",
        "content": "Registro de desistência e tentativa de contato concluída."
      }
    ],
    "evidences": []
  },
  {
    "id": "p19",
    "name": "Gabriela Monteiro",
    "email": "gabriela.monteiro@example.com",
    "phone": "(65) 99436-9907",
    "birth": "1994-03-28",
    "status": "active",
    "risk": "moderate",
    "demand": "Sintomas depressivos leves e baixa energia.",
    "tags": [
      "Humor",
      "Autocuidado"
    ],
    "next": "2026-08-20T09:00",
    "last": "2026-07-20",
    "sessions": 13,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 59,
    "blockReason": "",
    "history": [
      {
        "id": "h19",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-20",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p20",
    "name": "Thiago Pereira",
    "email": "thiago.pereira@example.com",
    "phone": "(65) 99541-7718",
    "birth": "1987-12-13",
    "status": "blocked",
    "risk": "none",
    "demand": "Bloqueio solicitado para revisão documental.",
    "tags": [
      "Bloqueado",
      "Documentação"
    ],
    "next": null,
    "last": "2026-07-21",
    "sessions": 1,
    "diagnosis": "Informações clínicas preservadas; atendimento suspenso temporariamente.",
    "prognosis": "A reavaliar após regularização do bloqueio.",
    "recommendation": "Resolver a pendência registrada antes de novo atendimento.",
    "referral": "Não aplicável durante o bloqueio.",
    "treatmentProgress": 10,
    "blockReason": "Pendência administrativa/documental registrada para teste.",
    "history": [
      {
        "id": "h20",
        "type": "note",
        "title": "Bloqueio temporário",
        "date": "2026-07-21",
        "content": "Acesso e processo suspensos até regularização da pendência informada."
      }
    ],
    "evidences": []
  },
  {
    "id": "p21",
    "name": "Manuela Cardoso",
    "email": "manuela.cardoso@example.com",
    "phone": "(65) 99677-1554",
    "birth": "2003-05-06",
    "status": "active",
    "risk": "low",
    "demand": "Habilidades sociais e insegurança em apresentações.",
    "tags": [
      "Habilidades sociais",
      "Estudos"
    ],
    "next": "2026-08-22T11:00",
    "last": "2026-07-22",
    "sessions": 8,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 66,
    "blockReason": "",
    "history": [
      {
        "id": "h21",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-22",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p22",
    "name": "Daniel Araújo",
    "email": "daniel.araujo@example.com",
    "phone": "(65) 99780-3429",
    "birth": "1993-09-23",
    "status": "pending",
    "risk": "moderate",
    "demand": "Aguardando entrevista inicial para avaliação de estresse.",
    "tags": [
      "Pendente",
      "Estresse"
    ],
    "next": null,
    "last": "2026-07-23",
    "sessions": 0,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 0,
    "blockReason": "",
    "history": [
      {
        "id": "h22",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-23",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p23",
    "name": "Renata Campos",
    "email": "renata.campos@example.com",
    "phone": "(65) 99892-4056",
    "birth": "1981-01-31",
    "status": "active",
    "risk": "low",
    "demand": "Redefinição de projetos pessoais após transição familiar.",
    "tags": [
      "Família",
      "Propósito"
    ],
    "next": "2026-08-02T13:00",
    "last": "2026-07-24",
    "sessions": 15,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 76,
    "blockReason": "",
    "history": [
      {
        "id": "h23",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-24",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p24",
    "name": "Felipe Moraes",
    "email": "felipe.moraes@example.com",
    "phone": "(65) 99128-6084",
    "birth": "1996-06-12",
    "status": "active",
    "risk": "moderate",
    "demand": "Uso excessivo de tecnologia e prejuízo do sono.",
    "tags": [
      "Tecnologia",
      "Sono"
    ],
    "next": "2026-08-03T14:00",
    "last": "2026-07-01",
    "sessions": 7,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 49,
    "blockReason": "",
    "history": [
      {
        "id": "h24",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-01",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p25",
    "name": "Patrícia Gonçalves",
    "email": "patricia.goncalves@example.com",
    "phone": "(65) 99239-7540",
    "birth": "1978-10-04",
    "status": "high",
    "risk": "none",
    "demand": "Alta terapêutica com plano de manutenção.",
    "tags": [
      "Alta",
      "Prevenção de recaída"
    ],
    "next": null,
    "last": "2026-07-02",
    "sessions": 22,
    "diagnosis": "Síntese clínica concluída conforme processo terapêutico.",
    "prognosis": "Favorável, com recursos de manutenção e prevenção de recaída.",
    "recommendation": "Manter práticas de autocuidado e retornar se necessário.",
    "referral": "Alta acompanhada; sem encaminhamento atual.",
    "treatmentProgress": 100,
    "blockReason": "",
    "history": [
      {
        "id": "h25",
        "type": "discharge",
        "title": "Alta terapêutica",
        "date": "2026-07-02",
        "content": "Objetivos principais alcançados e plano de continuidade registrado."
      }
    ],
    "evidences": []
  },
  {
    "id": "p26",
    "name": "Bruno Carvalho",
    "email": "bruno.carvalho@example.com",
    "phone": "(65) 99348-2276",
    "birth": "1990-02-20",
    "status": "active",
    "risk": "high",
    "demand": "Oscilação de humor e dificuldades de controle de impulsos.",
    "tags": [
      "Humor",
      "Impulsividade"
    ],
    "next": "2026-08-05T16:00",
    "last": "2026-07-03",
    "sessions": 14,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 54,
    "blockReason": "",
    "history": [
      {
        "id": "h26",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-03",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p27",
    "name": "Lívia Fernandes",
    "email": "livia.fernandes@example.com",
    "phone": "(65) 99459-6381",
    "birth": "2002-07-15",
    "status": "active",
    "risk": "low",
    "demand": "Ansiedade diante de decisões acadêmicas.",
    "tags": [
      "Ansiedade",
      "Decisão"
    ],
    "next": "2026-08-06T08:00",
    "last": "2026-07-04",
    "sessions": 5,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 47,
    "blockReason": "",
    "history": [
      {
        "id": "h27",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-04",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p28",
    "name": "Rodrigo Neves",
    "email": "rodrigo.neves@example.com",
    "phone": "(65) 99564-8032",
    "birth": "1985-05-27",
    "status": "dropout",
    "risk": "none",
    "demand": "Processo interrompido por ausência recorrente.",
    "tags": [
      "Desistente",
      "Faltas"
    ],
    "next": null,
    "last": "2026-07-05",
    "sessions": 2,
    "diagnosis": "Processo interrompido antes da conclusão.",
    "prognosis": "Não conclusivo devido à interrupção.",
    "recommendation": "Retomar acompanhamento quando houver disponibilidade.",
    "referral": "Sem encaminhamento formal.",
    "treatmentProgress": 15,
    "blockReason": "",
    "history": [
      {
        "id": "h28",
        "type": "dropout",
        "title": "Interrupção do acompanhamento",
        "date": "2026-07-05",
        "content": "Registro de desistência e tentativa de contato concluída."
      }
    ],
    "evidences": []
  },
  {
    "id": "p29",
    "name": "Aline Batista",
    "email": "aline.batista@example.com",
    "phone": "(65) 99670-9916",
    "birth": "1992-12-01",
    "status": "pending",
    "risk": "low",
    "demand": "Cadastro inicial para orientação parental.",
    "tags": [
      "Pendente",
      "Parentalidade"
    ],
    "next": null,
    "last": "2026-07-06",
    "sessions": 0,
    "diagnosis": "Hipótese clínica em avaliação; sem diagnóstico automatizado.",
    "prognosis": "Potencial de evolução favorável com continuidade e adesão.",
    "recommendation": "Manter acompanhamento e revisar metas terapêuticas periodicamente.",
    "referral": "Avaliar encaminhamento conforme evolução clínica.",
    "treatmentProgress": 0,
    "blockReason": "",
    "history": [
      {
        "id": "h29",
        "type": "evolution",
        "title": "Evolução clínica",
        "date": "2026-07-06",
        "content": "Registro fictício para validação do histórico longitudinal e dos indicadores."
      }
    ],
    "evidences": []
  },
  {
    "id": "p30",
    "name": "João Victor Melo",
    "email": "joao.melo@example.com",
    "phone": "(65) 99786-1449",
    "birth": "2005-04-22",
    "status": "blocked",
    "risk": "low",
    "demand": "Acesso bloqueado até atualização do responsável legal.",
    "tags": [
      "Bloqueado",
      "Responsável legal"
    ],
    "next": null,
    "last": "2026-07-07",
    "sessions": 1,
    "diagnosis": "Informações clínicas preservadas; atendimento suspenso temporariamente.",
    "prognosis": "A reavaliar após regularização do bloqueio.",
    "recommendation": "Resolver a pendência registrada antes de novo atendimento.",
    "referral": "Não aplicável durante o bloqueio.",
    "treatmentProgress": 8,
    "blockReason": "Pendência administrativa/documental registrada para teste.",
    "history": [
      {
        "id": "h30",
        "type": "note",
        "title": "Bloqueio temporário",
        "date": "2026-07-07",
        "content": "Acesso e processo suspensos até regularização da pendência informada."
      }
    ],
    "evidences": []
  }
];

  const initialAppointments = [
    {id:'a1',patientId:'p1',start:'2026-07-27T14:00',end:'2026-07-27T14:50',duration:50,type:'Consulta',mode:'Online',status:'confirmed',professional:'Equipe Humanevo',location:'Link da sessão',reminder:'24h',notes:'Acompanhamento semanal'},
    {id:'a2',patientId:'p2',start:'2026-07-28T09:30',end:'2026-07-28T10:20',duration:50,type:'Consulta',mode:'Presencial',status:'confirmed',professional:'Equipe Humanevo',location:'Consultório 1',reminder:'24h',notes:'Regulação emocional'},
    {id:'a3',patientId:'p3',start:'2026-07-29T16:00',end:'2026-07-29T17:00',duration:60,type:'Orientação profissional',mode:'Online',status:'pending',professional:'Equipe Humanevo',location:'Link da sessão',reminder:'2h',notes:'Devolutiva parcial'},
    {id:'a4',patientId:'p6',start:'2026-07-30T11:00',end:'2026-07-30T12:00',duration:60,type:'Avaliação',mode:'Presencial',status:'confirmed',professional:'Equipe Humanevo',location:'Sala de avaliação',reminder:'24h',notes:'Atenção e funções executivas'},
    {id:'a5',patientId:'p1',start:'2026-08-03T14:00',end:'2026-08-03T14:50',duration:50,type:'Consulta',mode:'Online',status:'confirmed',professional:'Equipe Humanevo',location:'Link da sessão',reminder:'24h',notes:''}
  ];

  const dailyVerses = [
    ['Provérbios 3:5','Confie no Senhor de todo o coração e não se apoie apenas no próprio entendimento.'],
    ['Salmos 46:10','Aquietem-se e reconheçam que Deus está presente.'],
    ['Filipenses 4:13','Em Cristo encontro força para enfrentar cada etapa.'],
    ['Isaías 41:10','Não tema: Deus está com você, fortalece e sustenta.'],
    ['Salmos 23:4','Mesmo em caminhos difíceis, não estou sozinho.'],
    ['Romanos 12:12','Alegrem-se na esperança, sejam pacientes na dificuldade e perseverem na oração.'],
    ['Mateus 11:28','Venham a mim os cansados e sobrecarregados; em mim encontrarão descanso.'],
    ['Salmos 37:5','Entregue seu caminho ao Senhor, confie e siga com esperança.'],
    ['Jeremias 29:11','Deus conhece os planos de paz, esperança e futuro.'],
    ['1 Coríntios 13:7','O amor protege, confia, espera e persevera.'],
    ['Salmos 34:18','Deus está perto de quem tem o coração ferido.'],
    ['João 14:27','Receba a paz que acalma o coração e afasta o medo.'],
    ['Gálatas 6:9','Não desista de fazer o bem; a colheita chega no tempo certo.'],
    ['Salmos 121:2','O auxílio vem do Senhor, Criador dos céus e da terra.'],
    ['2 Timóteo 1:7','Deus nos concede coragem, amor e equilíbrio.'],
    ['Eclesiastes 3:1','Há um tempo certo para cada propósito debaixo do céu.'],
    ['Salmos 139:14','Você foi criado de maneira singular e admirável.'],
    ['Colossenses 3:15','Permita que a paz governe o coração.'],
    ['Josué 1:9','Seja forte e corajoso; Deus acompanha seus passos.'],
    ['Salmos 30:5','O choro pode durar uma noite, mas a alegria encontra um novo amanhecer.'],
    ['Provérbios 16:3','Consagre seus projetos ao Senhor e organize seus caminhos.'],
    ['Romanos 8:28','Deus pode transformar todas as coisas em aprendizado e bem.'],
    ['Salmos 55:22','Entregue suas preocupações ao Senhor; Ele sustentará você.'],
    ['Tiago 1:5','Peça sabedoria a Deus, que oferece generosamente.'],
    ['Mateus 6:34','Viva um dia de cada vez; cada dia possui seu próprio cuidado.'],
    ['Salmos 119:105','A Palavra ilumina os próximos passos do caminho.'],
    ['Hebreus 11:1','A fé dá firmeza à esperança e sentido ao que ainda não vemos.'],
    ['Provérbios 17:22','Um coração alegre favorece a recuperação e renova as forças.'],
    ['Salmos 91:4','Em Deus encontramos abrigo, cuidado e segurança.'],
    ['1 Pedro 5:7','Entregue a Deus toda ansiedade, pois Ele cuida de você.'],
    ['Lamentações 3:22-23','A misericórdia se renova a cada manhã; sempre há um novo começo.']
  ];

  const defaultPatientStatuses = [
    {id:'active',label:'Em acompanhamento',color:'#2d7770',repository:false,system:true},
    {id:'pending',label:'Pendente',color:'#c68a32',repository:false,system:true},
    {id:'high',label:'Alta',color:'#4b9272',repository:true,system:true},
    {id:'dropout',label:'Desistente',color:'#9f6471',repository:true,system:true},
    {id:'blocked',label:'Bloqueado',color:'#7d8588',repository:true,system:true}
  ];

  const appointmentStatuses = [
    ['confirmed','Confirmado'],['pending','Pendente'],['cancelled','Cancelado'],['completed','Realizado']
  ];

  const appointmentVisuals = {
    type: {
      'Consulta': {tone:'teal', label:'Consulta clínica'},
      'Retorno': {tone:'blue', label:'Retorno de acompanhamento'},
      'Avaliação': {tone:'purple', label:'Avaliação estruturada'},
      'Devolutiva': {tone:'gold', label:'Sessão de devolutiva'},
      'Orientação profissional': {tone:'cyan', label:'Orientação profissional'},
      'Entrevista inicial': {tone:'rose', label:'Entrevista inicial'}
    },
    mode: {
      'Presencial': {tone:'green', label:'Atendimento presencial'},
      'Online': {tone:'blue', label:'Atendimento online'},
      'Híbrida': {tone:'purple', label:'Atendimento híbrido'}
    },
    status: {
      confirmed: {tone:'green', label:'Confirmado'},
      pending: {tone:'amber', label:'Pendente'},
      cancelled: {tone:'red', label:'Cancelado'},
      completed: {tone:'blue', label:'Realizado'}
    }
  };

  const supportTypeMeta = {
    'ELOGIO': {tone:'green', label:'Reconhecimento positivo'},
    'CRÍTICA': {tone:'amber', label:'Análise crítica construtiva'},
    'RECLAMAÇÃO': {tone:'orange', label:'Insatisfação que requer retorno'},
    'SUGESTÃO': {tone:'blue', label:'Ideia para evolução da plataforma'},
    'ERRO': {tone:'red', label:'Falha técnica ou comportamento inesperado'}
  };

  const questionTypes = {
    shortText: {label:'Texto curto', icon:'edit', description:'Resposta breve em uma linha.'},
    longText: {label:'Parágrafo', icon:'file', description:'Texto livre para respostas detalhadas.'},
    email: {label:'E-mail', icon:'mail', description:'Campo com validação de endereço eletrônico.'},
    phone: {label:'Telefone', icon:'phone', description:'Campo preparado para contato telefônico.'},
    number: {label:'Número', icon:'activity', description:'Resposta exclusivamente numérica.'},
    singleChoice: {label:'Múltipla escolha', icon:'check', description:'Permite escolher apenas uma alternativa.'},
    multipleChoice: {label:'Caixas de seleção', icon:'list', description:'Permite marcar uma ou várias alternativas.'},
    dropdown: {label:'Lista suspensa', icon:'chevronRight', description:'Escolha compacta em uma lista.'},
    yesNo: {label:'Sim / Não', icon:'check', description:'Resposta binária objetiva.'},
    scale: {label:'Escala linear', icon:'activity', description:'Escala numérica com limites configuráveis.'},
    rating: {label:'Classificação', icon:'star', description:'Avaliação visual de 1 a 5 pontos.'},
    date: {label:'Data', icon:'calendar', description:'Seleção de uma data.'},
    time: {label:'Horário', icon:'calendar', description:'Seleção de hora e minuto.'},
    matching: {label:'Ligar / relacionar', icon:'arrow', description:'Relaciona itens de duas colunas.'},
    section: {label:'Título e descrição', icon:'library', description:'Cria uma seção para organizar o formulário.'},
    info: {label:'Texto informativo', icon:'file', description:'Orientação sem campo de resposta.'}
  };

  const questionTypeGroups = [
    {label:'Texto e dados', types:['shortText','longText','email','phone','number']},
    {label:'Escolha e avaliação', types:['singleChoice','multipleChoice','dropdown','yesNo','scale','rating']},
    {label:'Data e organização', types:['date','time','matching','section','info']}
  ];

  function questionTypeSelectOptions(selected='shortText') {
    return questionTypeGroups.map(group=>`<optgroup label="${group.label}">${group.types.map(type=>`<option value="${type}" ${selected===type?'selected':''}>${questionTypes[type].label}</option>`).join('')}</optgroup>`).join('');
  }

  const defaultCustomization = {
    logoData: '',
    logoSize: 46,
    logoRadius: 15,
    titleFont: 'Aptos Display',
    bodyFont: 'Aptos',
    cardRadius: 22,
    controlRadius: 13,
    sidebarWidth: 264,
    shadowIntensity: 1,
    uiScale: 1,
    brand: '#174a47',
    brand2: '#2d7770',
    animations: true
  };


const accessRoleTemplates = [
  {
    id:'administrator',
    label:'Administrador',
    summary:'Controle integral da clínica, da estrutura da plataforma e da governança digital.',
    permissions:[
      'Acesso irrestrito à operação, aos indicadores executivos e às configurações estruturais.',
      'Exclusividade na Customização: logo, cores, tipografia, formas, escala e animações.',
      'Controle total do Studio de formulários: criar, editar, duplicar, publicar e excluir.',
      'Exportação e restauração integral por XLSX, com abas organizadas por módulo.',
      'Trilha de auditoria para visualizações, alterações, exclusões, exportações e restaurações.',
      'Hub de integrações para WhatsApp, Google Calendar e plataformas administrativas.'
    ],
    capabilities:['Dashboard completo','Customização','Formulários','Backup XLSX','Auditoria','Integrações'],
    badge:'Acesso total',
    color:'#174a47'
  },
  {
    id:'psychologist',
    label:'Psicólogo',
    summary:'Gestão clínica completa, instrumentos, prontuário e acompanhamento terapêutico.',
    permissions:[
      'Gerencia pacientes, evoluções, hipóteses diagnósticas, prognósticos e recomendações.',
      'Acessa a Biblioteca de avaliações e registra resultados e sínteses profissionais.',
      'Controla sua agenda e movimenta pacientes para alta, desistência ou outros repositórios.',
      'Mapeamento de decisão clínica com sintomas, hipóteses e rotas terapêuticas estruturadas.',
      'Assistente de transcrição e resumo em formato SOAP, sujeito à revisão antes do prontuário.'
    ],
    capabilities:['Pacientes','Prontuário','Avaliações','Agenda própria','Decisão clínica','Resumo SOAP'],
    badge:'Acesso clínico',
    color:'#2d7770'
  },
  {
    id:'intake_manager',
    label:'Gestor de Acolhimento',
    summary:'Recepção e fluxo administrativo com proteção do conteúdo clínico sensível.',
    permissions:[
      'Agenda consultas, avaliações, devolutivas, retornos e reuniões familiares.',
      'Inicia cadastros demográficos e de contato sem acessar o prontuário clínico.',
      'Envia confirmações, lembretes, avisos de ausência e remarcações.',
      'Gerencia fila de espera e oportunidades de antecipação quando surgem horários vagos.',
      'Opera check-in, autorizações, coparticipações e status de recepção.',
      'Pode utilizar modo Totem/autoatendimento com QR Code vinculado ao agendamento.'
    ],
    capabilities:['Agenda','Novo paciente','Mensagens','Fila de espera','Check-in','Modo Totem'],
    badge:'Acesso ao calendário',
    color:'#7b5f80'
  },
  {
    id:'patient',
    label:'Paciente',
    summary:'Ambiente individual, externo e controlado, focado no próprio processo.',
    permissions:[
      'Recebe lembretes, confirmações e comunicações autorizadas pela clínica.',
      'Responde formulários e instrumentos remotos encaminhados pelo psicólogo.',
      'Instala o Portal do Paciente como PWA em celular ou computador.',
      'Acessa materiais de psicoeducação disponibilizados pelo profissional.',
      'Acompanha assiduidade, metas terapêuticas e indicadores simples de humor e bem-estar.'
    ],
    capabilities:['Portal PWA','Formulários','Comunicações','Psicoeducação','Metas','Bem-estar'],
    badge:'Acesso individual',
    color:'#c68a32'
  }
];


const accessPermissionCatalog = [
  {id:'delete_patients',label:'Excluir pacientes',description:'Permite excluir individualmente um cadastro de paciente.'},
  {id:'delete_patients_bulk',label:'Exclusão em massa',description:'Permite selecionar e excluir vários pacientes em uma única operação.'},
  {id:'medical_records',label:'Prontuários',description:'Libera o acesso ao conteúdo clínico, histórico e evidências.'},
  {id:'forms',label:'Formulários',description:'Libera biblioteca, criação, envio e revisão de formulários.'},
  {id:'calendar',label:'Agenda',description:'Libera visualização e gestão da agenda clínica.'},
  {id:'export',label:'Exportação',description:'Libera exportações, backups XLSX e relatórios administrativos.'},
  {id:'administration',label:'Administração',description:'Libera a área de Administração & Customização. O cockpit permanece exclusivo do perfil Administrador.'},
  {id:'chat',label:'Chat interno',description:'Libera conversas protegidas entre usuários da clínica e pacientes vinculados.'}
];

const defaultRolePermissions = {
  administrator:{delete_patients:true,delete_patients_bulk:true,medical_records:true,forms:true,calendar:true,export:true,administration:true,chat:true},
  psychologist:{delete_patients:true,delete_patients_bulk:false,medical_records:true,forms:true,calendar:true,export:false,administration:false,chat:true},
  intake_manager:{delete_patients:false,delete_patients_bulk:false,medical_records:false,forms:false,calendar:true,export:false,administration:false,chat:true},
  patient:{delete_patients:false,delete_patients_bulk:false,medical_records:false,forms:false,calendar:false,export:false,administration:false,chat:true}
};

const defaultAccessProfiles = [
  {
    "id": "acc-admin-master",
    "name": "Joab Lopes Mata",
    "email": "joab.mata@gmail.com",
    "roleId": "administrator",
    "status": "active",
    "avatarData": "",
    "notes": "Conta administrativa principal utilizada para configuração, backup, governança e auditoria.",
    "locked": true,
    "createdAt": "2026-07-25T10:00:00.000Z",
    "updatedAt": "2026-07-25T10:00:00.000Z"
  },
  {
    "id": "acc-fabiane-psychologist",
    "name": "Dra. Fabiane Ferreira",
    "email": "fabianeferreirapsic@gmail.com",
    "roleId": "psychologist",
    "status": "active",
    "avatarData": "",
    "notes": "Conta profissional de psicóloga preparada para testes de agenda, pacientes, formulários e cockpit clínico.",
    "locked": false,
    "createdAt": "2026-07-25T10:00:00.000Z",
    "updatedAt": "2026-07-25T10:00:00.000Z"
  }
];

const defaultIntegrations = [
  {id:'whatsapp',name:'WhatsApp Business API',category:'Comunicação',status:'not_configured',endpoint:'',notes:'Automação de lembretes, confirmações e envio de links de formulários.',lastSync:''},
  {id:'google-calendar',name:'Google Calendar',category:'Agenda',status:'not_configured',endpoint:'',notes:'Sincronização bidirecional de consultas e bloqueios de agenda.',lastSync:''},
  {id:'accounting',name:'Plataforma contábil',category:'Administrativo',status:'not_configured',endpoint:'',notes:'Preparação para integração financeira e conciliação administrativa.',lastSync:''}
];

const defaultAuditLogs = [
  {id:'log-initial',createdAt:'2026-07-25T10:00:00.000Z',actor:'Administrador Humanevo',action:'Ambiente inicializado',module:'Sistema',detail:'Estrutura administrativa e matriz de perfis criada.'}
];

  const titleFontOptions = [
    ['Aptos Display','Aptos Display'],
    ['Segoe UI Variable Display','Segoe UI Variable Display'],
    ['Avenir Next','Avenir Next'],
    ['Trebuchet MS','Trebuchet MS'],
    ['Georgia','Georgia'],
    ['System UI','system-ui']
  ];
  const bodyFontOptions = [
    ['Aptos','Aptos'],
    ['Segoe UI Variable Text','Segoe UI Variable Text'],
    ['Inter / System','Inter'],
    ['Trebuchet MS','Trebuchet MS'],
    ['Georgia','Georgia'],
    ['System UI','system-ui']
  ];

  function localIsoDate(date=new Date()) {
    const year=date.getFullYear();
    const month=String(date.getMonth()+1).padStart(2,'0');
    const day=String(date.getDate()).padStart(2,'0');
    return `${year}-${month}-${day}`;
  }

  const defaultState = {
    patients: initialPatients,
    appointments: initialAppointments,
    assessmentRecords: [],
    customForms: [],
    libraryReferences: {},
    patientStatuses: structuredClone(defaultPatientStatuses),
    supportTickets: [],
    formAssignments: [],
    notifications: [],
    chatThreads: [],
    chatMessages: [],
    chatUsers: [],
    activeChatThreadId: '',
    chatSearch: '',
    chatChannelFilter: 'all',
    cloudPendingProfiles: [],
    accessProfiles: structuredClone(defaultAccessProfiles),
    rolePermissions: structuredClone(defaultRolePermissions),
    userPermissionExceptions: {},
    accessCockpitTab: 'pending',
    integrations: structuredClone(defaultIntegrations),
    auditLogs: structuredClone(defaultAuditLogs),
    modificationLogs: [],
    customization: structuredClone(defaultCustomization),
    nav: 'dashboard',
    patientView: 'cards',
    patientRepository: 'all',
    patientSort: {key:'name',direction:'asc'},
    patientSearch: '',
    assessmentSearch: '',
    assessmentCategory: 'Todas',
    assessmentPage: 1,
    formSearch: '',
    calendarCursor: `${localIsoDate().slice(0,7)}-01`,
    selectedDate: localIsoDate(),
    agendaView: 'month',
    calendarDetailAppointmentId: '',
    dashboardTab: 'overview',
    modal: null,
    patientDetailTab: 'summary',
    adminProfileDraftId: null,
    adminOpenGroup: null,
    selectedPatientId: null,
    selectedPatientIds: [],
    sidebarOpen: false,
    sidebarCollapsed: false,
    profileMenuOpen: false
  };

  let state = loadState();
  let stateHydrated = true;

  function loadState() {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      const merged = saved ? {...structuredClone(defaultState), ...saved} : structuredClone(defaultState);
      merged.customization = {...structuredClone(defaultCustomization), ...(saved?.customization || {})};
      merged.customForms = Array.isArray(saved?.customForms) ? saved.customForms : [];
      merged.patientStatuses = Array.isArray(saved?.patientStatuses) && saved.patientStatuses.length ? saved.patientStatuses : structuredClone(defaultPatientStatuses);
      merged.supportTickets = Array.isArray(saved?.supportTickets) ? saved.supportTickets : [];
      merged.formAssignments = Array.isArray(saved?.formAssignments) ? saved.formAssignments : [];
      merged.notifications = Array.isArray(saved?.notifications) ? saved.notifications : [];
      merged.cloudPendingProfiles = [];
      merged.libraryReferences = merged.libraryReferences && typeof merged.libraryReferences==='object' ? merged.libraryReferences : {};
      merged.adminOpenGroup = null;
      merged.selectedPatientIds = [];
      const savedProfiles = Array.isArray(saved?.accessProfiles) ? saved.accessProfiles : [];
      const profileMatch = seed => savedProfiles.find(item => item.id===seed.id || (item.email && seed.email && String(item.email).toLowerCase()===String(seed.email).toLowerCase()));
      merged.accessProfiles = defaultAccessProfiles.map(seed => ({...structuredClone(seed), ...(profileMatch(seed) || {})}));
      savedProfiles.forEach(item => { if(!merged.accessProfiles.some(seed => seed.id===item.id || (seed.email && item.email && String(seed.email).toLowerCase()===String(item.email).toLowerCase()))) merged.accessProfiles.push(item); });
      merged.accessProfiles = merged.accessProfiles.map(item => { const clean={...item}; delete clean.temporaryPassword; return clean; });
      merged.rolePermissions = Object.fromEntries(Object.entries(defaultRolePermissions).map(([role,defaults])=>[role,{...defaults,...(saved?.rolePermissions?.[role]||{})}]));
      merged.userPermissionExceptions = saved?.userPermissionExceptions && typeof saved.userPermissionExceptions==='object' ? saved.userPermissionExceptions : {};
      merged.accessCockpitTab = ['pending','roles','users'].includes(saved?.accessCockpitTab) ? saved.accessCockpitTab : 'pending';
      merged.dashboardTab = ['overview','performance','insights'].includes(saved?.dashboardTab) ? saved.dashboardTab : 'overview';
      const patientSortKeys=['name','status','demand','next','evidence'];
      merged.patientSort={
        key:patientSortKeys.includes(saved?.patientSort?.key)?saved.patientSort.key:'name',
        direction:saved?.patientSort?.direction==='desc'?'desc':'asc'
      };
      merged.calendarDetailAppointmentId=String(saved?.calendarDetailAppointmentId||'');
      const savedPatients = Array.isArray(saved?.patients) ? saved.patients : [];
      const patientMatch = seed => savedPatients.find(item => item.id===seed.id || (item.email && seed.email && String(item.email).toLowerCase()===String(seed.email).toLowerCase()));
      merged.patients = initialPatients.map(seed => ({...structuredClone(seed), ...(patientMatch(seed) || {})}));
      savedPatients.forEach(item => { if(!merged.patients.some(seed => seed.id===item.id || (seed.email && item.email && String(seed.email).toLowerCase()===String(item.email).toLowerCase()))) merged.patients.push(item); });
      merged.integrations = Array.isArray(saved?.integrations) && saved.integrations.length ? saved.integrations : structuredClone(defaultIntegrations);
      merged.auditLogs = Array.isArray(saved?.auditLogs) && saved.auditLogs.length ? saved.auditLogs : structuredClone(defaultAuditLogs);
      merged.modificationLogs = Array.isArray(saved?.modificationLogs) ? saved.modificationLogs : [];
      merged.patients = (merged.patients || []).map(p => ({...p, evidences:Array.isArray(p.evidences)?p.evidences:[], blockReason:p.blockReason||'', treatmentProgress:Number.isFinite(Number(p.treatmentProgress))?Number(p.treatmentProgress):Math.min(100,Math.max(18,(Number(p.sessions)||0)*6+25))}));
      merged.appointments = (merged.appointments || []).map(a => {
        const start = a.start;
        const duration = Number(a.duration)||50;
        const endDate = a.end ? new Date(a.end) : new Date(new Date(start).getTime()+duration*60000);
        return {...a, duration, end:a.end||endDate.toISOString().slice(0,16), status:a.status||'confirmed', professional:a.professional||'Equipe Humanevo', location:a.location||'', reminder:a.reminder||'24h'};
      });
      merged.customForms = (merged.customForms || []).map(form => ensureMinimumQuestionDepth(form));
      merged.formAssignments = (merged.formAssignments || []).map(assignment => {
        if(['submitted','reviewed','cancelled'].includes(assignment.status)) return assignment;
        const snapshot=assignment.formSnapshot||{};
        if((snapshot.questions||[]).filter(q=>!['section','info'].includes(q.type)).length>=25) return assignment;
        const source={...snapshot,id:snapshot.id||assignment.formId||uid('form'),title:snapshot.title||'Avaliação clínica',category:snapshot.category||'Clínica',template:snapshot.template||'clinical'};
        return {...assignment,formSnapshot:{...snapshot,questions:buildProfessionalQuestions(source)}};
      });
      if(!['all',...merged.patientStatuses.filter(s=>s.repository).map(s=>s.id)].includes(merged.patientRepository)) merged.patientRepository='all';
      if(merged.nav==='customization') merged.nav='dashboard';
      return merged;
    } catch (_) { return structuredClone(defaultState); }
  }
  function captureAuditableState() {
    const snapshot={};
    AUDITABLE_KEYS.forEach(key=>{ snapshot[key]=structuredClone(state[key]); });
    if(snapshot.customization) snapshot.customization.logoData='';
    return snapshot;
  }
  function changedAuditableKeys(before,after) {
    if(!before) return [];
    return AUDITABLE_KEYS.filter(key=>JSON.stringify(before[key])!==JSON.stringify(after[key]));
  }
  function moduleFromKeys(keys=[]) {
    const labels={patients:'Pacientes',appointments:'Agenda',assessmentRecords:'Avaliações',customForms:'Formulários',patientStatuses:'Status clínicos',supportTickets:'Suporte',formAssignments:'Formulários enviados',notifications:'Notificações',accessProfiles:'Perfis de acesso',integrations:'Integrações',customization:'Customização'};
    return keys.map(key=>labels[key]||key).join(', ')||'Sistema';
  }
  function latestAuditHint() {
    const log=(state.auditLogs||[])[0];
    if(!log) return null;
    const age=Date.now()-new Date(log.createdAt).getTime();
    return age>=0&&age<5000?log:null;
  }
  function captureModificationIfNeeded(currentSnapshot) {
    if(skipNextModificationCapture){skipNextModificationCapture=false;lastAuditableSnapshot=structuredClone(currentSnapshot);return;}
    const changed=changedAuditableKeys(lastAuditableSnapshot,currentSnapshot);
    if(!changed.length){lastAuditableSnapshot=structuredClone(currentSnapshot);return;}
    const hint=latestAuditHint();
    const id=uid('change');
    const now=new Date();
    const entry={
      id,createdAt:now.toISOString(),actor:currentProfile().fullName||'Administrador Humanevo',actorEmail:currentProfile().email||'',
      action:hint?.action||'Dados atualizados',module:hint?.module||moduleFromKeys(changed),detail:hint?.detail||`Alteração em ${moduleFromKeys(changed)}.`,
      changedKeys:changed,status:'updated',canUndo:true,snapshotId:id
    };
    state.modificationLogs=Array.isArray(state.modificationLogs)?state.modificationLogs:[];
    state.modificationLogs.unshift(entry);
    if(state.modificationLogs.length>300) state.modificationLogs=state.modificationLogs.slice(0,300);
    storeAuditSnapshot(id,lastAuditableSnapshot).catch(error=>console.warn('Snapshot de auditoria não armazenado.',error));
    lastAuditableSnapshot=structuredClone(currentSnapshot);
  }
  function saveState(options={}) {
    const currentSnapshot=captureAuditableState();
    if(options.skipModificationCapture) { skipNextModificationCapture=true; }
    captureModificationIfNeeded(currentSnapshot);
    const persist = structuredClone({...state, modal:null, sidebarOpen:false, profileMenuOpen:false, selectedPatientIds:[]});
    if(persist.customization) persist.customization.logoData = '';
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(persist)); }
    catch (_) {
      try {
        (persist.patients||[]).forEach(patient => (patient.evidences||[]).forEach(file => { if(file.data) file.data=''; }));
        localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
        toast('Configurações salvas. Arquivos grandes serão mantidos no banco central ou somente nesta sessão.', 'warning');
      } catch (error) { toast('Não foi possível gravar os dados locais. Exporte um backup e libere espaço no navegador.', 'error'); }
    }
  }
  function openLogoDb() {
    return new Promise((resolve,reject)=>{
      if(!('indexedDB' in window)) return reject(new Error('IndexedDB indisponível'));
      const request=indexedDB.open(LOGO_DB_NAME,2);
      request.onupgradeneeded=()=>{const db=request.result;if(!db.objectStoreNames.contains(LOGO_STORE))db.createObjectStore(LOGO_STORE);if(!db.objectStoreNames.contains(AUDIT_STORE))db.createObjectStore(AUDIT_STORE);};
      request.onsuccess=()=>resolve(request.result); request.onerror=()=>reject(request.error);
    });
  }
  async function storeVisualAsset(key,value) { const db=await openLogoDb(); return new Promise((resolve,reject)=>{const tx=db.transaction(LOGO_STORE,'readwrite');tx.objectStore(LOGO_STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); }
  async function readVisualAsset(key) { const db=await openLogoDb(); return new Promise((resolve,reject)=>{const req=db.transaction(LOGO_STORE,'readonly').objectStore(LOGO_STORE).get(key);req.onsuccess=()=>resolve(req.result||'');req.onerror=()=>reject(req.error);}); }
  async function deleteVisualAsset(key) { const db=await openLogoDb(); return new Promise((resolve,reject)=>{const tx=db.transaction(LOGO_STORE,'readwrite');tx.objectStore(LOGO_STORE).delete(key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); }
  async function storeAuditSnapshot(key,value) { if(!value) return; const db=await openLogoDb(); return new Promise((resolve,reject)=>{const tx=db.transaction(AUDIT_STORE,'readwrite');tx.objectStore(AUDIT_STORE).put(value,key);tx.oncomplete=()=>resolve();tx.onerror=()=>reject(tx.error);}); }
  async function readAuditSnapshot(key) { const db=await openLogoDb(); return new Promise((resolve,reject)=>{const req=db.transaction(AUDIT_STORE,'readonly').objectStore(AUDIT_STORE).get(key);req.onsuccess=()=>resolve(req.result||null);req.onerror=()=>reject(req.error);}); }
  async function rollbackModification(logId) {
    const log=(state.modificationLogs||[]).find(item=>item.id===logId);
    if(!log?.canUndo) return toast('Este registro não possui estado anterior disponível.','error');
    try {
      const snapshot=await readAuditSnapshot(log.snapshotId||log.id);
      if(!snapshot) throw new Error('O estado anterior não foi encontrado neste dispositivo.');
      AUDITABLE_KEYS.forEach(key=>{ if(key in snapshot) state[key]=structuredClone(snapshot[key]); });
      log.canUndo=false; log.status='restored'; log.restoredAt=new Date().toISOString(); log.restoredBy=currentProfile().fullName;
      audit('Modificação desfeita','Log de modificações',`${log.action} · ${log.module}`);
      state.modificationLogs.unshift({id:uid('change'),createdAt:new Date().toISOString(),actor:currentProfile().fullName,actorEmail:currentProfile().email,action:'Rollback executado',module:log.module,detail:`Estado restaurado antes de: ${log.action}.`,changedKeys:log.changedKeys||[],status:'restored',canUndo:false});
      skipNextModificationCapture=true;
      lastAuditableSnapshot=captureAuditableState();
      saveState({skipModificationCapture:true});
      state.modal=null;render();toast('Modificação desfeita e estado anterior restaurado.');
    } catch(error) { toast(error.message||'Não foi possível desfazer a modificação.','error'); }
  }
  function brandingRowLogo(row) {
    const value=Array.isArray(row)?row[0]:row;
    return value&&Object.prototype.hasOwnProperty.call(value,'logo_data')?String(value.logo_data||''):null;
  }
  async function applySharedLogo(logo, options={}) {
    if(logo===null) return false;
    state.customization.logoData=String(logo||'');
    if(state.customization.logoData) await storeVisualAsset('brand-logo',state.customization.logoData).catch(()=>{});
    else await deleteVisualAsset('brand-logo').catch(()=>{});
    applyCustomization();
    if(options.render!==false) renderWhenSafe();
    return true;
  }
  async function loadGlobalBranding(options={}) {
    if(!cloud?.configured||typeof cloud.getClinicBranding!=='function') return false;
    try {
      const row=await cloud.getClinicBranding(cloudContext?.membership?.clinic_id||window.HUMANEVO_CONFIG?.DEFAULT_CLINIC_ID||'');
      return await applySharedLogo(brandingRowLogo(row),options);
    } catch(error) {
      console.warn('Logo global temporariamente indisponível:',error);
      return false;
    }
  }
  async function persistGlobalLogo(logoData='', metadata={}) {
    if(currentRole()!=='administrator') throw new Error('Somente o Administrador pode alterar a logo institucional.');
    if(!cloud?.configured||!cloud.auth?.access_token) throw new Error('Conecte a conta Administrador ao Supabase antes de alterar a logo global.');
    cloudContext=cloudContext||await cloud.currentContext();
    if(!cloudContext?.membership||cloudContext.membership.role!=='administrator'||cloudContext.membership.status!=='approved') throw new Error('A conta conectada não possui permissão administrativa aprovada.');
    await cloud.saveClinicBranding({
      clinicId:cloudContext.membership.clinic_id,
      logoData:String(logoData||''),
      logoMime:String(metadata.mime||''),
      logoName:String(metadata.name||'')
    });
    await applySharedLogo(String(logoData||''),{render:false});
    return true;
  }
  async function restoreStoredLogo() {
    try { const logo=await readVisualAsset('brand-logo'); if(logo) await applySharedLogo(logo,{render:true}); } catch(_){}
    await loadGlobalBranding({render:true});
  }
  async function compressLogo(file) {
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=reject;r.readAsDataURL(file);});
    if(file.type==='image/svg+xml') return data;
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data;});
    const source=document.createElement('canvas');
    const sourceMax=1200,sourceScale=Math.min(1,sourceMax/Math.max(image.naturalWidth||sourceMax,image.naturalHeight||sourceMax));
    source.width=Math.max(1,Math.round((image.naturalWidth||sourceMax)*sourceScale));source.height=Math.max(1,Math.round((image.naturalHeight||sourceMax)*sourceScale));
    const sctx=source.getContext('2d',{willReadFrequently:true});sctx.drawImage(image,0,0,source.width,source.height);
    const pixels=sctx.getImageData(0,0,source.width,source.height);const d=pixels.data;
    const corner=[d[0],d[1],d[2],d[3]];let minX=source.width,minY=source.height,maxX=-1,maxY=-1;
    for(let y=0;y<source.height;y+=1){for(let x=0;x<source.width;x+=1){const i=(y*source.width+x)*4;const alpha=d[i+3];const dist=Math.abs(d[i]-corner[0])+Math.abs(d[i+1]-corner[1])+Math.abs(d[i+2]-corner[2])+Math.abs(alpha-corner[3]);if(alpha>12&&dist>36){if(x<minX)minX=x;if(x>maxX)maxX=x;if(y<minY)minY=y;if(y>maxY)maxY=y;}}}
    if(maxX<minX||maxY<minY){minX=0;minY=0;maxX=source.width-1;maxY=source.height-1;}
    const pad=Math.max(2,Math.round(Math.max(maxX-minX,maxY-minY)*.035));minX=Math.max(0,minX-pad);minY=Math.max(0,minY-pad);maxX=Math.min(source.width-1,maxX+pad);maxY=Math.min(source.height-1,maxY+pad);
    const cropW=maxX-minX+1,cropH=maxY-minY+1,max=900,scale=Math.min(1,max/Math.max(cropW,cropH));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round(cropW*scale));canvas.height=Math.max(1,Math.round(cropH*scale));
    canvas.getContext('2d').drawImage(source,minX,minY,cropW,cropH,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/webp',.9);
  }
  async function compressProfileImage(file) {
    if(!file) return '';
    const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=reject;r.readAsDataURL(file);});
    const image=await new Promise((resolve,reject)=>{const img=new Image();img.onload=()=>resolve(img);img.onerror=reject;img.src=data;});
    const max=320,scale=Math.min(1,max/Math.max(image.naturalWidth||max,image.naturalHeight||max));
    const canvas=document.createElement('canvas');canvas.width=Math.max(1,Math.round((image.naturalWidth||max)*scale));canvas.height=Math.max(1,Math.round((image.naturalHeight||max)*scale));
    const ctx=canvas.getContext('2d');ctx.fillStyle='#eef7f4';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.drawImage(image,0,0,canvas.width,canvas.height);
    return canvas.toDataURL('image/webp',.82);
  }
  function renderAvatar(profile={},className='avatar') {
    const image=profile.avatarData||profile.avatar_url||profile.avatarUrl||'';
    const label=profile.fullName||profile.name||'Usuário';
    return `<span class="${className}${image?' has-photo':''}">${image?`<img src="${image}" alt="Foto de ${escapeHtml(label)}">`:initials(label)}</span>`;
  }
  function audit(action, module='Sistema', detail='') {
    state.auditLogs = Array.isArray(state.auditLogs) ? state.auditLogs : [];
    state.auditLogs.unshift({id:uid('log'),createdAt:new Date().toISOString(),actor:(cloudContext?.profile?.full_name||(typeof currentProfile==='function'?currentProfile().fullName:'Administrador Humanevo')||'Administrador Humanevo'),action,module,detail:String(detail||'')});
    if(state.auditLogs.length>500) state.auditLogs=state.auditLogs.slice(0,500);
  }
  function uid(prefix='id') { return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2,7)}`; }
  function escapeHtml(value='') { return String(value).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c])); }
  function firstName(name='') { return String(name).trim().split(/\s+/)[0] || ''; }
  function initials(name='') { return String(name).split(/\s+/).filter(Boolean).slice(0,2).map(x=>x[0]).join('').toUpperCase(); }
  function formatDate(value, opts={day:'2-digit',month:'short',year:'numeric'}) { if(!value) return '—'; const d=new Date(value.length===10?`${value}T12:00:00`:value); return Number.isNaN(d.getTime())?'—':new Intl.DateTimeFormat('pt-BR',opts).format(d); }
  function formatTime(value) { if(!value) return '—'; const d=new Date(value); return new Intl.DateTimeFormat('pt-BR',{hour:'2-digit',minute:'2-digit'}).format(d); }
  function ageFromBirth(birth) { if(!birth) return '—'; const b=new Date(`${birth}T12:00:00`),t=new Date(); let age=t.getFullYear()-b.getFullYear(); if(t < new Date(t.getFullYear(),b.getMonth(),b.getDate())) age--; return age; }
  function patientById(id) { return state.patients.find(p=>p.id===id); }
  function statusConfig(id) { return state.patientStatuses.find(s=>s.id===id) || defaultPatientStatuses.find(s=>s.id===id) || {id,label:id,color:'#7d8588',repository:false}; }
  function isRepositoryStatus(id) { return !!statusConfig(id).repository; }
  function statusOptions(selected='active') { return state.patientStatuses.map(s=>`<option value="${escapeHtml(s.id)}" ${selected===s.id?'selected':''}>${escapeHtml(s.label)}</option>`).join(''); }
  function statusInline(id) { const c=statusConfig(id).color; return `style="--status-color:${escapeHtml(c)}"`; }
  function appointmentStatusLabel(id) { return Object.fromEntries(appointmentStatuses)[id] || id; }
  function appointmentVisualMeta(kind,value) {
    return appointmentVisuals[kind]?.[value] || {tone:'neutral',label:String(value||'Não definido')};
  }
  function appointmentToneClass(kind,value) { return `appointment-tone-${appointmentVisualMeta(kind,value).tone}`; }
  function nextAppointmentForPatient(patientId) {
    return (state.appointments||[]).filter(item=>item.patientId===patientId&&new Date(item.end||item.start)>=new Date()&&item.status!=='cancelled').sort((a,b)=>String(a.start).localeCompare(String(b.start)))[0]||null;
  }
  function patientAppointmentCardStatus(patientId) {
    const appointment=nextAppointmentForPatient(patientId);if(!appointment)return '';
    const meta=appointmentVisualMeta('status',appointment.status);
    return `<span class="patient-next-status ${appointmentToneClass('status',appointment.status)}"><i></i>${escapeHtml(meta.label)}</span>`;
  }
  function renderAppointmentConditionalSelect(kind,label,name,options,selected) {
    const normalized=options.map(item=>Array.isArray(item)?item:[item,item]);
    const meta=appointmentVisualMeta(kind,selected);
    return `<div class="field appointment-condition ${appointmentToneClass(kind,selected)}" data-appointment-condition="${kind}"><label>${label}</label><select name="${name}" data-appointment-conditional="${kind}">${normalized.map(([value,labelText])=>`<option value="${escapeHtml(value)}" ${String(selected)===String(value)?'selected':''}>${escapeHtml(labelText)}</option>`).join('')}</select><span class="appointment-condition-badge ${appointmentToneClass(kind,selected)}" data-appointment-condition-badge><i></i><span>${escapeHtml(meta.label)}</span></span></div>`;
  }
  function applyAppointmentConditionalStyle(select) {
    const field=select?.closest?.('[data-appointment-condition]');if(!field)return;
    const kind=field.dataset.appointmentCondition;const meta=appointmentVisualMeta(kind,select.value);
    [...field.classList].filter(name=>name.startsWith('appointment-tone-')).forEach(name=>field.classList.remove(name));
    field.classList.add(`appointment-tone-${meta.tone}`);
    const badge=field.querySelector('[data-appointment-condition-badge]');
    if(badge){[...badge.classList].filter(name=>name.startsWith('appointment-tone-')).forEach(name=>badge.classList.remove(name));badge.classList.add(`appointment-tone-${meta.tone}`);const label=badge.querySelector('span');if(label)label.textContent=meta.label;}
  }
  function supportTypeClass(value) { return `support-tone-${supportTypeMeta[String(value||'').toUpperCase()]?.tone||'neutral'}`; }
  function applySupportTypeStyle(value) {
    const type=String(value||'ELOGIO').toUpperCase();const meta=supportTypeMeta[type]||supportTypeMeta.ELOGIO;
    const card=document.querySelector('.support-form-card');
    if(card){[...card.classList].filter(name=>name.startsWith('support-tone-')).forEach(name=>card.classList.remove(name));card.classList.add(`support-tone-${meta.tone}`);}
    const pill=document.getElementById('support-type-indicator');
    if(pill){pill.className=`support-type-indicator support-tone-${meta.tone}`;pill.innerHTML=`<i></i><span><strong>${escapeHtml(type)}</strong><small>${escapeHtml(meta.label)}</small></span>`;}
  }
  function toDateTimeLocalValue(value) {
    if(!value)return '';
    const date=new Date(value);if(Number.isNaN(date.getTime()))return String(value).slice(0,16);
    const local=new Date(date.getTime()-date.getTimezoneOffset()*60000);return local.toISOString().slice(0,16);
  }
  function dailyVerse() { const now=new Date(); const start=new Date(now.getFullYear(),0,0); const day=Math.floor((now-start)/86400000); return dailyVerses[day%dailyVerses.length]; }
  function toDateInput(value) { return value ? String(value).slice(0,10) : new Date().toISOString().slice(0,10); }
  function toTimeInput(value) { return value ? String(value).slice(11,16) : '09:00'; }
  function addMinutes(dateTime, minutes) { const d=new Date(dateTime); return new Date(d.getTime()+Number(minutes||50)*60000).toISOString().slice(0,16); }

  function downloadDataUrl(dataUrl, filename) { const a=document.createElement('a'); a.href=dataUrl; a.download=filename||'arquivo'; document.body.appendChild(a); a.click(); a.remove(); }
  function downloadBlob(blob, filename) { const url=URL.createObjectURL(blob); const a=document.createElement('a'); a.href=url; a.download=filename; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(url),1200); }
  function sanitizeSpreadsheetText(value='') {
    let text=String(value ?? '')
      .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')
      .replace(/[\uFFFE\uFFFF]/g,'');
    if(text.length>32760) text=`${text.slice(0,32730)}… [CONTEÚDO TRUNCADO]`;
    return text;
  }
  function escapeXml(value='') { return sanitizeSpreadsheetText(value).replace(/[<>&"']/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;'}[c])); }
  function colLetter(index) { let n=index+1, out=''; while(n>0){ const rem=(n-1)%26; out=String.fromCharCode(65+rem)+out; n=Math.floor((n-1)/26);} return out; }
  function colIndex(label='') { return String(label).split('').reduce((acc,ch)=>acc*26 + ch.charCodeAt(0)-64,0)-1; }
  function sheetCell(ref, value, style=0) {
    if(value===null||value===undefined||value==='') return '';
    if(typeof value==='number' && Number.isFinite(value)) return `<c r="${ref}" s="${style}" t="n"><v>${value}</v></c>`;
    return `<c r="${ref}" s="${style}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(String(value))}</t></is></c>`;
  }
  function buildWorksheetXml({title, subtitle='', headers=[], rows=[]}) {
    const cols = Math.max(headers.length, ...(rows.map(row=>row.length)), 1);
    const lastCol = colLetter(cols-1);
    const xmlRows = [];
    xmlRows.push(`<row r="1" ht="26" customHeight="1">${sheetCell('A1', title || 'Humanevo', 1)}</row>`);
    xmlRows.push(`<row r="2" ht="21" customHeight="1">${sheetCell('A2', subtitle || 'Backup do sistema Humanevo', 2)}</row>`);
    xmlRows.push(`<row r="3">${headers.map((header,index)=>sheetCell(`${colLetter(index)}3`, header, 3)).join('')}</row>`);
    rows.forEach((row,rowIndex)=>{ const cells = row.map((cell,col)=>sheetCell(`${colLetter(col)}${rowIndex+4}`, cell, 4)).join(''); xmlRows.push(`<row r="${rowIndex+4}">${cells}</row>`); });
    const widths = Array.from({length:cols}, (_,index)=>`<col min="${index+1}" max="${index+1}" width="${index===0?22:30}" customWidth="1"/>`).join('');
    return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="A1:${lastCol}${Math.max(3, rows.length+3)}"/><sheetViews><sheetView workbookViewId="0"><pane ySplit="3" topLeftCell="A4" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="18"/><cols>${widths}</cols><sheetData>${xmlRows.join('')}</sheetData><mergeCells count="2"><mergeCell ref="A1:${lastCol}1"/><mergeCell ref="A2:${lastCol}2"/></mergeCells><autoFilter ref="A3:${lastCol}3"/></worksheet>`;
  }
  function utf8Bytes(text='') { return new TextEncoder().encode(text); }
  function crc32(bytes) {
    if(!crc32.table){ const table = new Uint32Array(256); for(let i=0;i<256;i++){ let c=i; for(let k=0;k<8;k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1); table[i]=c>>>0; } crc32.table=table; }
    let crc = 0xFFFFFFFF; for(const b of bytes) crc = crc32.table[(crc ^ b) & 0xFF] ^ (crc >>> 8); return (crc ^ 0xFFFFFFFF) >>> 0;
  }
  function dosZipTimestamp(date=new Date()) {
    const year=Math.max(1980,date.getFullYear());
    return {
      time:(date.getHours()<<11)|(date.getMinutes()<<5)|Math.floor(date.getSeconds()/2),
      date:((year-1980)<<9)|((date.getMonth()+1)<<5)|date.getDate()
    };
  }
  function makeZip(entries) {
    const fileParts=[]; const centralParts=[]; let offset=0;
    const stamp=dosZipTimestamp(); const utf8Flag=0x0800;
    entries.forEach(entry=>{
      const nameBytes=utf8Bytes(entry.name); const dataBytes=utf8Bytes(entry.content); const crc=crc32(dataBytes);
      const header=new Uint8Array(30+nameBytes.length); const view=new DataView(header.buffer);
      view.setUint32(0,0x04034b50,true); view.setUint16(4,20,true); view.setUint16(6,utf8Flag,true); view.setUint16(8,0,true);
      view.setUint16(10,stamp.time,true); view.setUint16(12,stamp.date,true); view.setUint32(14,crc,true);
      view.setUint32(18,dataBytes.length,true); view.setUint32(22,dataBytes.length,true); view.setUint16(26,nameBytes.length,true); view.setUint16(28,0,true);
      header.set(nameBytes,30); fileParts.push(header,dataBytes);
      const central=new Uint8Array(46+nameBytes.length); const cView=new DataView(central.buffer);
      cView.setUint32(0,0x02014b50,true); cView.setUint16(4,20,true); cView.setUint16(6,20,true); cView.setUint16(8,utf8Flag,true); cView.setUint16(10,0,true);
      cView.setUint16(12,stamp.time,true); cView.setUint16(14,stamp.date,true); cView.setUint32(16,crc,true);
      cView.setUint32(20,dataBytes.length,true); cView.setUint32(24,dataBytes.length,true); cView.setUint16(28,nameBytes.length,true);
      cView.setUint16(30,0,true); cView.setUint16(32,0,true); cView.setUint16(34,0,true); cView.setUint16(36,0,true);
      cView.setUint32(38,0,true); cView.setUint32(42,offset,true); central.set(nameBytes,46); centralParts.push(central);
      offset+=header.length+dataBytes.length;
    });
    const centralSize=centralParts.reduce((sum,part)=>sum+part.length,0); const end=new Uint8Array(22); const endView=new DataView(end.buffer);
    endView.setUint32(0,0x06054b50,true); endView.setUint16(4,0,true); endView.setUint16(6,0,true);
    endView.setUint16(8,entries.length,true); endView.setUint16(10,entries.length,true); endView.setUint32(12,centralSize,true); endView.setUint32(16,offset,true); endView.setUint16(20,0,true);
    return new Blob([...fileParts,...centralParts,end],{type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'});
  }
  function workbookParts(sheets) {
    const contentTypes = [`<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/><Override PartName="/docProps/core.xml" ContentType="application/vnd.openxmlformats-package.core-properties+xml"/><Override PartName="/docProps/app.xml" ContentType="application/vnd.openxmlformats-officedocument.extended-properties+xml"/>`, ...sheets.map((_,index)=>`<Override PartName="/xl/worksheets/sheet${index+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`), `</Types>`].join('');
    const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties" Target="docProps/core.xml"/><Relationship Id="rId3" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties" Target="docProps/app.xml"/></Relationships>`;
    const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><bookViews><workbookView xWindow="0" yWindow="0" windowWidth="24000" windowHeight="12800"/></bookViews><sheets>${sheets.map((sheet,index)=>`<sheet name="${escapeXml(sheet.name.slice(0,31))}" sheetId="${index+1}" r:id="rId${index+1}"/>`).join('')}</sheets><calcPr calcId="191029" fullCalcOnLoad="1"/></workbook>`;
    const workbookRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((sheet,index)=>`<Relationship Id="rId${index+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${index+1}.xml"/>`).join('')}<Relationship Id="rId${sheets.length+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
    const styles = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="5"><font><sz val="11"/><name val="Aptos"/><family val="2"/></font><font><b/><sz val="16"/><color rgb="FFFFFFFF"/><name val="Aptos Display"/><family val="2"/></font><font><i/><sz val="10"/><color rgb="FFE4FFFA"/><name val="Aptos"/><family val="2"/></font><font><b/><sz val="11"/><color rgb="FFFFFFFF"/><name val="Aptos"/><family val="2"/></font><font><sz val="11"/><color rgb="FF1F3D3B"/><name val="Aptos"/><family val="2"/></font></fonts><fills count="5"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF174A47"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FF2D7770"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFEAF5F2"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="2"><border><left/><right/><top/><bottom/><diagonal/></border><border><left style="thin"><color rgb="FFE2ECE8"/></left><right style="thin"><color rgb="FFE2ECE8"/></right><top style="thin"><color rgb="FFE2ECE8"/></top><bottom style="thin"><color rgb="FFE2ECE8"/></bottom><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="5"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="2" fillId="3" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="left" vertical="center"/></xf><xf numFmtId="0" fontId="3" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="center" vertical="center"/></xf><xf numFmtId="0" fontId="4" fillId="4" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1"><alignment vertical="top" wrapText="1"/></xf></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles><dxfs count="0"/><tableStyles count="0" defaultTableStyle="TableStyleMedium2" defaultPivotStyle="PivotStyleLight16"/></styleSheet>`;
    const now = new Date().toISOString();
    const core = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<cp:coreProperties xmlns:cp="http://schemas.openxmlformats.org/package/2006/metadata/core-properties" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:dcterms="http://purl.org/dc/terms/" xmlns:dcmitype="http://purl.org/dc/dcmitype/" xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"><dc:title>Humanevo Premium Studio - Backup XLSX</dc:title><dc:creator>Humanevo Premium Studio</dc:creator><cp:lastModifiedBy>Humanevo Premium Studio</cp:lastModifiedBy><dcterms:created xsi:type="dcterms:W3CDTF">${now}</dcterms:created><dcterms:modified xsi:type="dcterms:W3CDTF">${now}</dcterms:modified></cp:coreProperties>`;
    const appXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Properties xmlns="http://schemas.openxmlformats.org/officeDocument/2006/extended-properties" xmlns:vt="http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes"><Application>Humanevo Premium Studio</Application><HeadingPairs><vt:vector size="2" baseType="variant"><vt:variant><vt:lpstr>Worksheets</vt:lpstr></vt:variant><vt:variant><vt:i4>${sheets.length}</vt:i4></vt:variant></vt:vector></HeadingPairs><TitlesOfParts><vt:vector size="${sheets.length}" baseType="lpstr">${sheets.map(sheet=>`<vt:lpstr>${escapeXml(sheet.name)}</vt:lpstr>`).join('')}</vt:vector></TitlesOfParts></Properties>`;
    return [{name:'[Content_Types].xml', content:contentTypes},{name:'_rels/.rels', content:rootRels},{name:'xl/workbook.xml', content:workbook},{name:'xl/_rels/workbook.xml.rels', content:workbookRels},{name:'xl/styles.xml', content:styles},{name:'docProps/core.xml', content:core},{name:'docProps/app.xml', content:appXml},...sheets.map((sheet,index)=>({name:`xl/worksheets/sheet${index+1}.xml`, content:buildWorksheetXml(sheet)}))];
  }
  function chunkText(value='', size=28000) { const chunks=[]; for(let i=0;i<value.length;i+=size) chunks.push(value.slice(i,i+size)); return chunks.length?chunks:['']; }
  function exportDataset() {
    const summaryRows = [['Aplicação','Humanevo Premium Studio'],['Versão','3.10.9'],['Exportado em',new Date().toLocaleString('pt-BR')],['Pacientes cadastrados',state.patients.length],['Agendamentos',state.appointments.length],['Avaliações registradas',state.assessmentRecords.length],['Formulários customizados',state.customForms.length],['Formulários enviados',(state.formAssignments||[]).length],['Notificações',(state.notifications||[]).length],['Chamados de suporte',state.supportTickets.length],['Perfis de acesso',state.accessProfiles.length],['Registros de auditoria',state.auditLogs.length],['Modificações rastreadas',(state.modificationLogs||[]).length],['Integrações catalogadas',state.integrations.length],['Canais de chat',(state.chatThreads||[]).length],['Mensagens de chat',(state.chatMessages||[]).length]];
    const patientsRows = state.patients.map(p=>[p.id,p.name,p.email,formatBrazilPhone(p.phone),p.birth,p.addressZip||'',p.addressStreet||'',p.addressNumber||'',p.addressComplement||'',p.addressNeighborhood||'',p.addressCity||'',p.addressState||'',statusLabel(p.status),p.risk||'',p.demand||'',(p.tags||[]).join(' | '),p.next||'',p.last||'',p.sessions||0,p.diagnosis||'',p.prognosis||'',p.recommendation||'',p.referral||'',p.blockReason||'',p.treatmentProgress||'']);
    const historyRows = state.patients.flatMap(p=>(p.history||[]).map(h=>[p.id,p.name,h.id||'',h.date||'',h.type||'',humanType(h.type||''),h.title||'',h.content||'']));
    const evidenceRows = state.patients.flatMap(p=>(p.evidences||[]).map(f=>[p.id,p.name,f.id||'',f.name||'',f.type||'',f.size||0,f.createdAt||'',f.data?'SIM':'NÃO']));
    const appointmentsRows = state.appointments.map(a=>[a.id,patientById(a.patientId)?.name||'',a.patientId||'',a.start||'',a.end||'',a.duration||'',a.type||'',a.mode||'',a.status||'',appointmentStatusLabel(a.status||''),a.professional||'',a.location||'',a.reminder||'',a.notes||'']);
    const assessmentRows = state.assessmentRecords.map(r=>[r.id,assessmentById(r.assessmentId)?.title||r.assessmentId||'',r.assessmentId||'',patientById(r.patientId)?.name||'',r.patientId||'',r.date||'',r.summary||'',r.recommendations||'',JSON.stringify(r.result||{}),JSON.stringify(r.fields||{})]);
    const formRows = state.customForms.map(f=>[f.id,f.title||'',f.category||'',f.description||'',f.template||'',f.status||'',f.duration||'',(f.references||[]).join('\n'),(f.questions||[]).length]);
    const questionRows = state.customForms.flatMap(f=>(f.questions||[]).map((q,index)=>[f.id,f.title,index+1,q.id||'',questionTypeLabel(q.type),q.label||'',q.help||'',q.required?'SIM':'NÃO',(q.options||[]).join(' | '),JSON.stringify(q.pairs||[]),q.min??'',q.max??'']));
    const assignmentRows = (state.formAssignments||[]).map(a=>[a.id,a.patientId||'',patientById(a.patientId)?.name||'',a.formId||'',a.formSnapshot?.title||assessmentById(a.formId)?.title||'',a.status||'',a.dueAt||'',a.createdAt||'',a.submittedAt||'',a.professionalSummary||'',a.professionalRecommendations||'',a.cloud?'SIM':'NÃO']);
    const notificationRows = (state.notifications||[]).map(n=>[n.id,n.patientId||'',patientById(n.patientId)?.name||'',n.recipientRole||'',n.type||n.notification_type||'',n.title||'',n.message||'',n.createdAt||n.created_at||'',n.readAt||n.read_at||'',n.assignmentId||n.assignment_id||'']);
    const statusRows = state.patientStatuses.map(s=>[s.id,s.label,s.color,s.repository?'SIM':'NÃO',s.system?'SIM':'NÃO']);
    const supportRows = state.supportTickets.map(t=>[t.id,t.type,t.subject,t.name,t.email,t.createdAt,t.message,(t.files||[]).length,(t.files||[]).map(f=>f.name).join(' | ')]);
    const customizationRows = Object.entries(state.customization||{}).map(([key,value])=>[key, typeof value==='object' ? JSON.stringify(value) : String(value)]);
    const accessRows = state.accessProfiles.map(profile=>{const role=getAccessRole(profile.roleId); return [profile.id,profile.name,profile.email,role.label,profile.roleId,profile.status,profile.notes||'',profile.locked?'SIM':'NÃO',profile.createdAt||'',profile.updatedAt||''];});
    const permissionRows = accessRoleTemplates.flatMap(role=>role.permissions.map((permission,index)=>[role.id,role.label,role.badge,index+1,permission,(role.capabilities||[]).join(' | ')]));
    const auditRows = (state.auditLogs||[]).map(log=>[log.id,log.createdAt,log.actor,log.action,log.module,log.detail]);
    const modificationRows = (state.modificationLogs||[]).map(log=>[log.id,log.createdAt,log.actor,log.actorEmail||'',log.action,log.module,log.detail,(log.changedKeys||[]).join(' | '),log.status||'updated',log.canUndo?'SIM':'NÃO',log.restoredAt||'',log.restoredBy||'']);
    const integrationRows = (state.integrations||[]).map(item=>[item.id,item.name,item.category,item.status,item.endpoint||'',item.notes||'',item.lastSync||'']);
    const chatThreadRows=(state.chatThreads||[]).map(normalizeChatThread).map(thread=>[thread.id,chatDisplayTitle(thread),thread.channelType,thread.systemKey||'',thread.isSystem?'SIM':'NÃO',thread.canPost===false?'NÃO':'SIM',thread.last_message||'',thread.updated_at||thread.updatedAt||'',thread.unreadCount,(thread.participants||[]).map(p=>p.full_name||p.email||p.user_id).join(' | ')]);
    const chatMessageRows=(state.chatMessages||[]).map(message=>[message.id||'',message.thread_id||message.threadId||'',message.sender_id||message.senderId||'',message.sender_name||message.senderName||'',message.body||'',message.created_at||message.createdAt||'',(message.attachments||[]).length,(message.attachments||[]).map(file=>file.file_name||file.name).join(' | ')]);
    const backupPayload = JSON.stringify({app:'Humanevo Premium Studio', version:'3.10.9', exportedAt:new Date().toISOString(), state});
    const backupRows = chunkText(backupPayload).map((chunk,index)=>[index+1, chunk]);
    const readmeRows = [['1','Este XLSX foi gerado exclusivamente pelo menu Administração do Humanevo.'],['2','As abas organizam todos os módulos para consulta, auditoria e contingência.'],['3','Utilize "Importar backup XLSX" para restaurar um arquivo originalmente exportado pelo Humanevo.'],['4','A restauração usa a aba BACKUP_JSON; não altere essa aba.'],['5','Por segurança, códigos e senhas provisórias não são exportados nas abas de consulta.'],['6','Arquivos de evidência permanecem no backup técnico; a aba EVIDENCIAS contém apenas metadados.']];
    return [
      {name:'CAPA_RESUMO', title:'Humanevo • Backup completo do sistema', subtitle:'Template oficial de exportação, auditoria e contingência', headers:['Indicador','Valor'], rows:summaryRows},
      {name:'PACIENTES', title:'Pacientes', subtitle:'Cadastros, situação clínica e direcionadores do cuidado', headers:['ID','Nome','E-mail','Telefone','Nascimento','CEP','Logradouro','Número','Complemento','Bairro','Cidade','UF','Status','Risco','Demanda','Tags','Próxima sessão','Último atendimento','Sessões','Hipótese diagnóstica','Prognóstico','Recomendação','Encaminhamento','Motivo de bloqueio','Progresso (%)'], rows:patientsRows},
      {name:'HISTORICO_CLINICO', title:'Histórico clínico', subtitle:'Linha do tempo consolidada por paciente', headers:['Patient ID','Paciente','Registro ID','Data','Tipo','Tipo descrito','Título','Conteúdo'], rows:historyRows},
      {name:'EVIDENCIAS', title:'Evidências', subtitle:'Inventário de anexos e documentos vinculados aos pacientes', headers:['Patient ID','Paciente','Arquivo ID','Nome','Tipo MIME','Tamanho (bytes)','Criado em','Conteúdo no backup'], rows:evidenceRows},
      {name:'AGENDAMENTOS', title:'Agendamentos', subtitle:'Compromissos e atributos registrados no calendário', headers:['ID','Paciente','Patient ID','Início','Fim','Duração (min)','Tipo','Modalidade','Status ID','Status','Profissional','Local/link','Lembrete','Observações'], rows:appointmentsRows},
      {name:'AVALIACOES', title:'Avaliações registradas', subtitle:'Resultados e sínteses vinculados aos pacientes', headers:['ID','Avaliação','Assessment ID','Paciente','Patient ID','Data','Síntese','Recomendações','Resultado (JSON)','Campos (JSON)'], rows:assessmentRows},
      {name:'FORMULARIOS', title:'Formulários customizados', subtitle:'Catálogo criado no Studio de formulários', headers:['ID','Título','Categoria','Descrição','Template','Status','Duração (min)','Referências','Qtd. perguntas'], rows:formRows},
      {name:'FORMULARIOS_ENVIADOS', title:'Formulários enviados', subtitle:'Atribuições, prazos e revisão profissional', headers:['ID','Patient ID','Paciente','Form ID','Formulário','Status','Prazo','Criado em','Enviado em','Síntese profissional','Recomendações','Sincronizado'], rows:assignmentRows},
      {name:'NOTIFICACOES', title:'Notificações', subtitle:'Avisos encaminhados aos perfis da plataforma', headers:['ID','Patient ID','Paciente','Destinatário','Tipo','Título','Mensagem','Criada em','Lida em','Assignment ID'], rows:notificationRows},
      {name:'QUESTOES_FORMULARIOS', title:'Questões dos formulários', subtitle:'Estrutura didática dos formulários customizados', headers:['Form ID','Formulário','Ordem','Questão ID','Tipo','Pergunta/título','Texto de apoio','Obrigatória','Opções','Pares (JSON)','Mínimo','Máximo'], rows:questionRows},
      {name:'STATUS_PROCESSO', title:'Status de processo', subtitle:'Catálogo de status e regras de repositório', headers:['ID','Rótulo','Cor','Vai para repositório','Status de sistema'], rows:statusRows},
      {name:'SUPORTE', title:'Chamados de suporte', subtitle:'Histórico de comunicações preparadas ao desenvolvedor', headers:['ID','Tipo','Assunto','Nome','E-mail','Criado em','Mensagem','Qtd. anexos','Nomes dos anexos'], rows:supportRows},
      {name:'CUSTOMIZACAO', title:'Customização', subtitle:'Parâmetros visuais e identidade da plataforma', headers:['Parâmetro','Valor'], rows:customizationRows},
      {name:'PERFIS_ACESSO', title:'Perfis de acesso', subtitle:'Usuários e papéis operacionais cadastrados', headers:['ID','Nome','E-mail','Perfil','Role ID','Status','Observações','Protegido','Criado em','Atualizado em'], rows:accessRows},
      {name:'MATRIZ_PERMISSOES', title:'Matriz de permissões', subtitle:'Escopo funcional previsto para cada perfil', headers:['Role ID','Perfil','Nível','Ordem','Permissão','Capacidades'], rows:permissionRows},
      {name:'AUDITORIA', title:'Trilha de auditoria', subtitle:'Rastreabilidade local das ações sensíveis', headers:['ID','Data e hora','Responsável','Ação','Módulo','Detalhes'], rows:auditRows},
      {name:'LOG_MODIFICACOES', title:'Log de modificações', subtitle:'Rastreamento granular e disponibilidade de rollback', headers:['ID','Data e hora','Usuário','E-mail','Ação','Módulo','Detalhes','Chaves alteradas','Status','Pode desfazer','Restaurado em','Restaurado por'], rows:modificationRows},
      {name:'INTEGRACOES', title:'Hub de integrações', subtitle:'Configurações catalogadas para conexões externas', headers:['ID','Integração','Categoria','Status','Endpoint/identificador','Objetivo/observações','Última sincronização'], rows:integrationRows},
      {name:'CANAIS_CHAT', title:'Canais de comunicação', subtitle:'Canais gerais, internos, acolhimento e conversas privadas', headers:['ID','Título','Tipo','Chave de sistema','Canal de sistema','Pode publicar','Última mensagem','Atualizado em','Não lidas','Participantes'], rows:chatThreadRows},
      {name:'MENSAGENS_CHAT', title:'Mensagens do chat', subtitle:'Mensagens e metadados de anexos armazenados no estado local', headers:['ID','Thread ID','Sender ID','Remetente','Mensagem','Criada em','Qtd. anexos','Anexos'], rows:chatMessageRows},
      {name:'BACKUP_JSON', title:'Backup técnico interno', subtitle:'Não editar: conteúdo usado para restauração integral', headers:['Parte','JSON_FRAGMENTO'], rows:backupRows},
      {name:'README', title:'Como usar este arquivo', subtitle:'Instruções de exportação e restauração', headers:['Passo','Descrição'], rows:readmeRows}
    ];
  }
  function assertValidXml(xmlText='',label='XML'){
    const doc=new DOMParser().parseFromString(xmlText,'application/xml');
    if(doc.querySelector('parsererror'))throw new Error(`${label} contém caracteres ou estrutura inválida.`);
  }
  async function validateWorkbookBlob(blob,expectedSheets=0){
    if(!(blob instanceof Blob)||blob.size<2500)throw new Error('arquivo gerado incompleto');
    const entries=await readZipEntries(await blob.arrayBuffer());
    const required=['[Content_Types].xml','_rels/.rels','xl/workbook.xml','xl/_rels/workbook.xml.rels','xl/styles.xml','docProps/core.xml','docProps/app.xml'];
    required.forEach(name=>{if(!entries[name]?.length)throw new Error(`componente obrigatório ausente: ${name}`);});
    Object.entries(entries).filter(([name])=>name.endsWith('.xml')||name.endsWith('.rels')).forEach(([name,bytes])=>assertValidXml(bytesToString(bytes),name));
    const sheetMap=workbookSheetMap(entries);const sheetNames=Object.keys(sheetMap);
    if(expectedSheets&&sheetNames.length!==expectedSheets)throw new Error(`quantidade de abas divergente (${sheetNames.length}/${expectedSheets})`);
    const backupPath=sheetMap.BACKUP_JSON;if(!backupPath||!entries[backupPath])throw new Error('aba técnica BACKUP_JSON ausente');
    const rows=worksheetRows(bytesToString(entries[backupPath]));const payloadText=rows.slice(3).map(row=>row[1]||'').filter(Boolean).join('');
    const payload=JSON.parse(payloadText);if(payload.app!=='Humanevo Premium Studio'||!payload.state)throw new Error('conteúdo técnico de restauração inválido');
    return true;
  }
  async function exportSystemWorkbook(){
    try{
      audit('Backup XLSX exportado','Governança','Exportação completa de todos os módulos.');saveState();
      const sheets=exportDataset();const parts=workbookParts(sheets);const blob=makeZip(parts);await validateWorkbookBlob(blob,sheets.length);
      const fileName=`Backup_${new Date().toISOString().slice(0,10)}.xlsx`;downloadBlob(blob,fileName);toast(`Backup XLSX validado e exportado com ${sheets.length} abas.`);
    }catch(error){console.error(error);toast(`Falha ao gerar XLSX: ${error.message||'erro inesperado'}.`,'error');}
  }
  async function readFileArrayBuffer(file) { return await file.arrayBuffer(); }
  function bytesToString(bytes) { return new TextDecoder('utf-8').decode(bytes); }
  async function inflateZipEntry(bytes) {
    if(typeof DecompressionStream!=='function') throw new Error('O navegador não oferece descompactação compatível. Atualize o navegador e tente novamente.');
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'));
    return new Uint8Array(await new Response(stream).arrayBuffer());
  }
  async function readZipEntries(arrayBuffer) {
    const data=new Uint8Array(arrayBuffer); const view=new DataView(arrayBuffer); let eocd=-1;
    for(let i=data.length-22;i>=0;i--){ if(view.getUint32(i,true)===0x06054b50){eocd=i;break;} }
    if(eocd<0) throw new Error('Estrutura ZIP do XLSX não encontrada.');
    const totalEntries=view.getUint16(eocd+10,true); const centralOffset=view.getUint32(eocd+16,true); const entries={}; let pointer=centralOffset;
    for(let n=0;n<totalEntries;n++){
      if(view.getUint32(pointer,true)!==0x02014b50) throw new Error('Diretório central do XLSX inválido.');
      const method=view.getUint16(pointer+10,true); const compressedSize=view.getUint32(pointer+20,true); const fileNameLength=view.getUint16(pointer+28,true); const extraLength=view.getUint16(pointer+30,true); const commentLength=view.getUint16(pointer+32,true); const localHeaderOffset=view.getUint32(pointer+42,true);
      const name=bytesToString(data.slice(pointer+46,pointer+46+fileNameLength)); const localNameLength=view.getUint16(localHeaderOffset+26,true); const localExtraLength=view.getUint16(localHeaderOffset+28,true); const dataStart=localHeaderOffset+30+localNameLength+localExtraLength; const raw=data.slice(dataStart,dataStart+compressedSize);
      if(method===0) entries[name]=raw;
      else if(method===8) entries[name]=await inflateZipEntry(raw);
      else throw new Error(`Método de compactação não suportado (${method}).`);
      pointer+=46+fileNameLength+extraLength+commentLength;
    }
    return entries;
  }
  function workbookSheetMap(entries) {
    const workbookXml = bytesToString(entries['xl/workbook.xml'] || new Uint8Array()); const relsXml = bytesToString(entries['xl/_rels/workbook.xml.rels'] || new Uint8Array()); const parser = new DOMParser(); const workbookDoc = parser.parseFromString(workbookXml, 'application/xml'); const relsDoc = parser.parseFromString(relsXml, 'application/xml'); const relMap = {}; relsDoc.querySelectorAll('Relationship').forEach(rel=>{ relMap[rel.getAttribute('Id')] = `xl/${rel.getAttribute('Target').replace(/^\/?/, '')}`; }); const sheetMap = {}; workbookDoc.querySelectorAll('sheet').forEach(sheet=>{ sheetMap[sheet.getAttribute('name')] = relMap[sheet.getAttribute('r:id')]; }); return sheetMap;
  }
  function worksheetRows(xmlText='') {
    const parser = new DOMParser(); const doc = parser.parseFromString(xmlText, 'application/xml'); const rows = []; doc.querySelectorAll('sheetData row').forEach(row=>{ const arr = []; row.querySelectorAll('c').forEach(cell=>{ const ref = cell.getAttribute('r') || 'A1'; const col = colIndex(ref.replace(/\d+/g,'')); let value = ''; if(cell.getAttribute('t')==='inlineStr') value = [...cell.querySelectorAll('is t')].map(node=>node.textContent || '').join(''); else value = cell.querySelector('v')?.textContent || ''; arr[col] = value; }); rows.push(arr); }); return rows;
  }
  function restoreImportedState(rawState) { localStorage.setItem(STORAGE_KEY, JSON.stringify(rawState)); state = loadState(); state.nav = 'dashboard'; state.modal = null; state.sidebarOpen = false; state.adminProfileDraftId = null; saveState(); render(); }
  async function importSystemWorkbook(file) {
    if(!hasPermission('export')) return toast('Seu perfil não possui permissão para restaurar backups.','error');
    if(!file) return;
    try {
      const buffer = await readFileArrayBuffer(file); const entries = await readZipEntries(buffer); const sheetMap = workbookSheetMap(entries); const backupPath = sheetMap['BACKUP_JSON']; if(!backupPath || !entries[backupPath]) throw new Error('A aba BACKUP_JSON não foi encontrada.'); const rows = worksheetRows(bytesToString(entries[backupPath])); const chunks = rows.slice(3).map(row=>row[1] || '').filter(Boolean).join(''); if(!chunks) throw new Error('O conteúdo técnico do backup está vazio.'); const payload = JSON.parse(chunks); if(payload.app !== 'Humanevo Premium Studio') throw new Error('Arquivo incompatível com o Humanevo.'); if(!confirm('A importação substituirá os dados atuais do sistema. Deseja continuar?')) return; restoreImportedState(payload.state || payload); audit('Backup XLSX importado','Governança','Restauração integral confirmada pelo administrador.'); saveState(); toast('Backup XLSX importado com sucesso.');
    } catch (error) { console.error(error); toast(`Falha ao importar o XLSX: ${error.message || 'arquivo inválido.'}`, 'error'); }
  }
  function generateStrongPassword(length=16) {
    const upper='ABCDEFGHJKLMNPQRSTUVWXYZ';
    const lower='abcdefghijkmnopqrstuvwxyz';
    const digits='23456789';
    const symbols='!@#$%&*_-+=';
    const all=upper+lower+digits+symbols;
    const random=max=>{const buffer=new Uint32Array(1);crypto.getRandomValues(buffer);return buffer[0]%max;};
    const chars=[upper[random(upper.length)],lower[random(lower.length)],digits[random(digits.length)],symbols[random(symbols.length)]];
    while(chars.length<length) chars.push(all[random(all.length)]);
    for(let i=chars.length-1;i>0;i--){const j=random(i+1);[chars[i],chars[j]]=[chars[j],chars[i]];}
    return chars.join('');
  }

  async function saveAccessProfile() {
    const form=document.getElementById('access-profile-form'); if(!form?.reportValidity()) return;
    const fd=new FormData(form); const role=getAccessRole(String(fd.get('roleId')||'psychologist'));
    const id=String(fd.get('profileId')||'').trim()||uid('access'); const existing=state.accessProfiles.find(profile=>profile.id===id);
    const syncSupabase=form.querySelector('[name="createInSupabase"]')?.checked!==false;
    const password=String(fd.get('temporaryPassword')||'');
    const passwordConfirm=String(fd.get('temporaryPasswordConfirm')||'');
    const forcePasswordChange=!!fd.get('forcePasswordChange');
    if(password!==passwordConfirm) return toast('A confirmação da senha não confere.','error');
    if(password && password.length<8) return toast('A senha deve ter pelo menos 8 caracteres.','error');
    if(!existing && syncSupabase && password.length<8) return toast('Defina uma senha temporária com pelo menos 8 caracteres.','error');
    let avatarData=existing?.avatarData||'';
    if(fd.get('removeAvatar')) avatarData='';
    if(pendingProfileAvatarData) avatarData=pendingProfileAvatarData;
    else {
      const avatarFile=form.querySelector('[name="profileImage"]')?.files?.[0];
      if(avatarFile){
        if(avatarFile.size>6_000_000) return toast('A imagem de perfil deve ter no máximo 6 MB.','error');
        try { avatarData=await compressProfileImage(avatarFile); } catch(_) { return toast('Não foi possível processar a imagem de perfil.','error'); }
      }
    }
    const profile={
      id,
      name:String(fd.get('name')||'').trim(),
      email:String(fd.get('email')||'').trim().toLowerCase(),
      roleId:role.id,
      status:String(fd.get('status')||'active'),
      avatarData,
      notes:String(fd.get('notes')||'').trim(),
      forcePasswordChange,
      locked:existing?.locked||false,
      authUserId:existing?.authUserId||'',
      cloudProvisionedAt:existing?.cloudProvisionedAt||'',
      createdAt:existing?.createdAt||new Date().toISOString(),
      updatedAt:new Date().toISOString()
    };
    let cloudResult=null;
    if(syncSupabase && !isDemoAccess){
      if(!cloudReady() || currentRole()!=='administrator') return toast('Entre como Administrador conectado ao banco central para salvar o usuário no Supabase Authentication. A senha não será guardada para uso posterior.','error');
      try {
        cloudResult=await cloud.createManagedUser({
          userId:profile.authUserId||null,
          email:profile.email,
          password:password||undefined,
          fullName:profile.name,
          role:profile.roleId,
          status:profile.status==='active'?'approved':profile.status,
          forcePasswordChange,
          avatarData:profile.avatarData||''
        });
        profile.authUserId=cloudResult?.user?.id||cloudResult?.user_id||profile.authUserId;
        profile.cloudProvisionedAt=new Date().toISOString();
      } catch(error) {
        const msg=String(error?.message||'Falha ao atualizar o usuário no Supabase Authentication.');
        if(error?.code==='CLOUDFLARE_ADMIN_API_UNREACHABLE') return toast('O serviço administrativo do Cloudflare não respondeu. Publique o pacote completo mantendo o arquivo _worker.js na raiz. Verifique a lista de usuários antes de tentar novamente, pois a operação não pôde ser confirmada.','error');
        if(error?.code==='CLOUDFLARE_ADMIN_TIMEOUT') return toast('O serviço administrativo excedeu o tempo de resposta. Verifique a lista de usuários antes de tentar novamente, pois a operação não pôde ser confirmada.','error');
        if(error?.status===404||error?.code==='CLOUDFLARE_WORKER_NOT_FOUND') return toast('O backend administrativo não foi encontrado. Publique o ZIP completo no Cloudflare e confirme que _worker.js está na raiz do pacote.','error');
        if(error?.status===401||error?.code==='ADMIN_API_UNAUTHORIZED') return toast('A sessão administrativa expirou. Saia, entre novamente e repita o cadastro.','error');
        if(error?.status===503||error?.data?.code==='WORKER_SECRET_MISSING') return toast('O backend do Cloudflare está publicado, mas falta configurar SUPABASE_SECRET_KEY nas variáveis do projeto.','error');
        return toast(msg,'error');
      }
    }
    if(existing) Object.assign(existing,profile); else state.accessProfiles.unshift(profile);
    if(profile.authUserId && state.userPermissionExceptions[profile.id] && !state.userPermissionExceptions[profile.authUserId]) {
      state.userPermissionExceptions[profile.authUserId]=state.userPermissionExceptions[profile.id];
      delete state.userPermissionExceptions[profile.id];
    }
    pendingProfileAvatarData=''; state.adminProfileDraftId=null;
    audit(existing?'Perfil de acesso atualizado':'Perfil de acesso criado','Perfis de acesso',`${profile.name} · ${role.label}${cloudResult?' · Supabase Authentication atualizado':isDemoAccess?' · simulação local':''}`);
    if(password){
      pendingCredentialData={name:profile.name,email:profile.email,password,forcePasswordChange,roleLabel:role.label,created:!existing};
      state.modal={type:'accessCredentials'};
    } else {
      pendingCredentialData=null;
      state.modal=null;
    }
    saveState(); render();
    if(password) toast(existing?'Senha redefinida. Prepare o envio das credenciais pelo Outlook.':'Usuário salvo. Prepare o envio das credenciais pelo Outlook.');
    else toast(existing?'Usuário e permissões atualizados. A senha atual foi mantida.':'Usuário cadastrado com sucesso.');
    if(cloudResult) syncCloudData(false).catch(()=>{});
  }

  function allAssessments() { return [...assessmentCatalog, ...(state.customForms || [])]; }
  function assessmentById(id) { return allAssessments().find(a=>a.id===id); }
  function isCustomAssessment(a) { return !!a?.custom; }
  function questionTypeLabel(type) { return questionTypes[type]?.label || type; }
  function renderBrandMark(className='brand-mark') {
    const logo=state.customization?.logoData || './assets/logo-humanevo.svg';
    return `<div class="${className}"><img src="${escapeHtml(logo)}" alt="Logo Humanevo" width="56" height="56"></div>`;
  }
  function fontStack(value, fallback) {
    if(value==='system-ui') return 'system-ui, sans-serif';
    return `"${String(value||fallback).replace(/"/g,'')}", system-ui, sans-serif`;
  }
  function applyCustomization() {
    const c={...defaultCustomization,...(state.customization||{})};
    const root=document.documentElement;
    root.style.setProperty('--logo-size', `${c.logoSize}px`);
    root.style.setProperty('--logo-radius', `${c.logoRadius}px`);
    root.style.setProperty('--radius-lg', `${c.cardRadius}px`);
    root.style.setProperty('--control-radius', `${c.controlRadius}px`);
    root.style.setProperty('--sidebar-width', `${c.sidebarWidth}px`);
    root.style.setProperty('--shadow-strength', String(c.shadowIntensity));
    root.style.setProperty('--ui-scale', String(c.uiScale));
    root.style.setProperty('--brand', c.brand);
    root.style.setProperty('--brand-2', c.brand2);
    root.style.setProperty('--brand-soft', `${c.brand}18`);
    root.style.setProperty('--display', fontStack(c.titleFont,'Aptos Display'));
    root.style.setProperty('--body', fontStack(c.bodyFont,'Aptos'));
    document.body.classList.toggle('reduce-motion', c.animations===false);
  }
  function statusLabel(s) { return statusConfig(s).label; }
  function cardStatusLabel(s) { return statusConfig(s).label; }
  function statusClass(s) { return `status-dynamic status-${s}`; }
  function riskLabel(r) { return ({none:'Sem alerta',low:'Baixo',moderate:'Moderado',high:'Elevado',critical:'Crítico'}[r]||r); }
  function isClinicalRole(role=currentRole()) { return ['administrator','psychologist'].includes(role); }
  function formatBrazilPhone(value='') {
    const digits=String(value||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'').slice(0,11);
    if(!digits) return '';
    if(digits.length<=2) return `(${digits}`;
    if(digits.length<=6) return `(${digits.slice(0,2)}) ${digits.slice(2)}`;
    if(digits.length<=10) return `(${digits.slice(0,2)}) ${digits.slice(2,6)}-${digits.slice(6)}`;
    return `(${digits.slice(0,2)}) ${digits.slice(2,7)}-${digits.slice(7)}`;
  }
  function normalizePhoneDigits(value='') { return String(value||'').replace(/\D/g,'').replace(/^55(?=\d{10,11}$)/,'').slice(0,11); }
  function formatCep(value='') { const d=String(value||'').replace(/\D/g,'').slice(0,8); return d.length>5?`${d.slice(0,5)}-${d.slice(5)}`:d; }
  function formatPatientAddress(p={}) {
    const line1=[p.addressStreet,p.addressNumber].filter(Boolean).join(', ');
    const line2=[p.addressComplement,p.addressNeighborhood].filter(Boolean).join(' · ');
    const city=[p.addressCity,p.addressState].filter(Boolean).join(' - ');
    return [line1,line2,city,p.addressZip?`CEP ${formatCep(p.addressZip)}`:''].filter(Boolean).join(' | ')||'Não informado';
  }
  function patientSignupUrl(patient={}) {
    const base=new URL(window.HUMANEVO_CONFIG?.PATIENT_PORTAL_PATH||'/portal-paciente.html',window.HUMANEVO_CONFIG?.PUBLIC_APP_URL||location.origin);
    base.searchParams.set('signup','1');
    if(patient.email) base.searchParams.set('email',patient.email);
    return base.href;
  }
  function patientAccessUrl() { return new URL(window.HUMANEVO_CONFIG?.PATIENT_PORTAL_PATH||'/portal-paciente.html',window.HUMANEVO_CONFIG?.PUBLIC_APP_URL||location.origin).href; }
  function whatsappLink(phone,message) {
    const digits=normalizePhoneDigits(phone);
    return digits.length>=10?`https://wa.me/55${digits}?text=${encodeURIComponent(message)}`:'';
  }
  function humanType(t) { return ({evolution:'Evolução',recommendation:'Recomendação',diagnosis:'Diagnóstico/hipótese',prognosis:'Prognóstico',referral:'Encaminhamento',assessment:'Avaliação',discharge:'Alta',dropout:'Desistência',note:'Nota clínica'}[t]||t); }

  function icon(name, size=18) {
    const paths={
      home:'<path d="m3 11 9-8 9 8"/><path d="M5 10v10h14V10"/><path d="M9 20v-6h6v6"/>',
      dashboard:'<rect x="3" y="3" width="7" height="7" rx="2"/><rect x="14" y="3" width="7" height="7" rx="2"/><rect x="3" y="14" width="7" height="7" rx="2"/><rect x="14" y="14" width="7" height="7" rx="2"/>',
      users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>',
      library:'<path d="M4 5.5h13.5a2 2 0 0 1 2 2v10.5H6a2 2 0 0 1-2-2Z"/><path d="M6 3h12a2 2 0 0 1 2 2v10.5"/><path d="M2.5 8h13a2 2 0 0 1 2 2v11H4.5a2 2 0 0 1-2-2Z"/><path d="M6.5 12h7M6.5 15h5"/>',
      calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M16 3v4M8 3v4M3 11h18"/>',
      archive:'<path d="M21 8v13H3V8M1 3h22v5H1zM10 12h4"/>',
      settings:'<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .34 1.88l.06.06-2.83 2.83-.06-.06A1.7 1.7 0 0 0 15 19.4a1.7 1.7 0 0 0-1 .6 1.7 1.7 0 0 0-.4 1.1V21h-4v-.1A1.7 1.7 0 0 0 8.6 19.4a1.7 1.7 0 0 0-1.88.34l-.06.06-2.83-2.83.06-.06A1.7 1.7 0 0 0 4.6 15a1.7 1.7 0 0 0-.6-1 1.7 1.7 0 0 0-1.1-.4H3v-4h.1A1.7 1.7 0 0 0 4.6 8.6a1.7 1.7 0 0 0-.34-1.88l-.06-.06 2.83-2.83.06.06A1.7 1.7 0 0 0 9 4.6a1.7 1.7 0 0 0 1-.6 1.7 1.7 0 0 0 .4-1.1V3h4v.1A1.7 1.7 0 0 0 15.4 4.6a1.7 1.7 0 0 0 1.88-.34l.06-.06 2.83 2.83-.06.06A1.7 1.7 0 0 0 19.4 9c.17.38.39.72.6 1 .28.38.67.6 1.1.6h.1v4h-.1c-.43 0-.82.22-1.1.6-.21.28-.43.62-.6 1Z"/>',
      search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
      menu:'<path d="M4 6h16M4 12h16M4 18h16"/>',
      plus:'<path d="M12 5v14M5 12h14"/>',
      mail:'<rect x="3" y="5" width="18" height="14" rx="2"/><path d="m3 7 9 6 9-6"/>',
      bell:'<path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9M10 21h4"/>',
      grid:'<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>',
      list:'<path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/>',
      clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
      chevronLeft:'<path d="m15 18-6-6 6-6"/>',
      chevronRight:'<path d="m9 18 6-6-6-6"/>',
      close:'<path d="M18 6 6 18M6 6l12 12"/>',
      user:'<path d="M20 21a8 8 0 0 0-16 0"/><circle cx="12" cy="7" r="4"/>',
      logout:'<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="m16 17 5-5-5-5M21 12H9"/>',
      switchUser:'<path d="M16 3h5v5M21 3l-6 6"/><path d="M8 4a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z"/><path d="M2 21a6 6 0 0 1 12 0"/>',
      chevronDown:'<path d="m6 9 6 6 6-6"/>',
      file:'<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z"/><path d="M14 2v6h6M8 13h8M8 17h5"/>',
      activity:'<path d="M3 12h4l3-8 4 16 3-8h4"/>',
      arrow:'<path d="M5 12h14M13 6l6 6-6 6"/>',
      edit:'<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/>',
      phone:'<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3.1 19.5 19.5 0 0 1-6-6A19.8 19.8 0 0 1 2.1 4.2 2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1 1 .4 2 .7 2.9a2 2 0 0 1-.5 2.1L8.1 9.9a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.9.3 1.9.6 2.9.7a2 2 0 0 1 1.7 2Z"/>',
      check:'<path d="m20 6-11 11-5-5"/>',
      heart:'<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 0 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8Z"/>',
      brain:'<path d="M9.5 4.5A3.5 3.5 0 0 0 6 8v1a3.5 3.5 0 0 0-1 6.8A3.5 3.5 0 0 0 8.5 21H12V4.5A3.5 3.5 0 0 0 9.5 4.5Z"/><path d="M14.5 4.5A3.5 3.5 0 0 1 18 8v1a3.5 3.5 0 0 1 1 6.8A3.5 3.5 0 0 1 15.5 21H12V4.5a3.5 3.5 0 0 1 2.5 0Z"/><path d="M8 10h4M12 14h4M8 17h4"/>',
      trash:'<path d="M3 6h18M8 6V4h8v2M19 6l-1 15H6L5 6M10 11v6M14 11v6"/>',
      copy:'<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>',
      send:'<path d="m22 2-7 20-4-9-9-4Z"/><path d="M22 2 11 13"/>',
      mic:'<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2M12 19v3M8 22h8"/>',
      reset:'<path d="M3 12a9 9 0 1 0 3-6.7L3 8"/><path d="M3 3v5h5"/>',
      form:'<path d="M6 2h9l3 3v17H6z"/><path d="M14 2v5h5M9 12h6M9 16h6M9 8h2"/>',
      palette:'<path d="M12 3a9 9 0 0 0 0 18h1.5a1.5 1.5 0 0 0 0-3H12a2 2 0 0 1 0-4h3a6 6 0 0 0 0-12Z"/><circle cx="7.5" cy="10.5" r=".6" fill="currentColor"/><circle cx="10" cy="7" r=".6" fill="currentColor"/><circle cx="14" cy="7" r=".6" fill="currentColor"/><circle cx="17" cy="10" r=".6" fill="currentColor"/>',
      upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M4 20h16"/>',
      duplicate:'<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>',
      up:'<path d="m18 15-6-6-6 6"/>',
      down:'<path d="m6 9 6 6 6-6"/>',
      book:'<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2Z"/>',
      preview:'<path d="M2.5 12s3.5-6 9.5-6 9.5 6 9.5 6-3.5 6-9.5 6-9.5-6-9.5-6Z"/><circle cx="12" cy="12" r="2.5"/>',
      support:'<path d="M8 4H6a3 3 0 0 0-3 3v7a3 3 0 0 0 3 3h2"/><path d="M16 4h2a3 3 0 0 1 3 3v7a3 3 0 0 1-3 3h-2"/><path d="M8 8l-3 3 3 3M16 8l3 3-3 3M13.5 6l-3 10"/>',
      chat:'<path d="M20 14a4 4 0 0 1-4 4H9l-5 3v-7a4 4 0 0 1-2-3.5V7a4 4 0 0 1 4-4h10a4 4 0 0 1 4 4Z"/><path d="M7 8h8M7 12h6"/>',
      paperclip:'<path d="m21.4 11.6-8.9 8.9a6 6 0 0 1-8.5-8.5l9.6-9.6a4 4 0 0 1 5.7 5.7l-9.6 9.6a2 2 0 1 1-2.8-2.8l8.9-8.9"/>',
      developer:'<path d="M8 9 4 12l4 3M16 9l4 3-4 3M14 5l-4 14"/><rect x="2" y="3" width="20" height="18" rx="3"/>',
      lock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/>',
      unlock:'<rect x="4" y="10" width="16" height="11" rx="2"/><path d="M8 10V7a4 4 0 0 1 7.5-2"/>',
      upload:'<path d="M12 16V4M7 9l5-5 5 5"/><path d="M5 20h14"/>',
      download:'<path d="M12 4v12M7 11l5 5 5-5"/><path d="M5 20h14"/>',
      image:'<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>',
      chart:'<path d="M4 19V9M10 19V5M16 19v-7M22 19H2"/>',
      cloud:'<path d="M17.5 19H7a5 5 0 0 1-.8-9.9A7 7 0 0 1 19.7 11 4 4 0 0 1 17.5 19Z"/>',
      database:'<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v6c0 1.7 3.6 3 8 3s8-1.3 8-3V5M4 11v6c0 1.7 3.6 3 8 3s8-1.3 8-3v-6"/>',
      link:'<path d="M10 13a5 5 0 0 0 7.1 0l2-2a5 5 0 0 0-7.1-7.1l-1.1 1.1"/><path d="M14 11a5 5 0 0 0-7.1 0l-2 2A5 5 0 0 0 12 20.1l1.1-1.1"/>',
      inbox:'<path d="M4 4h16l2 10v6H2v-6Z"/><path d="M2 14h5l2 3h6l2-3h5"/>',
      insight:'<path d="M9 18h6M10 22h4"/><path d="M8.5 14.5A6 6 0 1 1 15.5 14.5C14.7 15.2 14 16 14 17h-4c0-1-.7-1.8-1.5-2.5Z"/>',
      shield:'<path d="M12 3 5 6v5c0 4.4 2.8 8 7 9.5 4.2-1.5 7-5.1 7-9.5V6l-7-3Z"/><path d="m8.8 12.1 2.1 2.1 4.5-5"/>',
      key:'<circle cx="8" cy="15" r="4"/><path d="m11 12 8-8M15 8l2 2M18 5l2 2"/>'
    };
    return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${paths[name]||paths.file}</svg>`;
  }

  function toast(message,type='success') {
    const el=document.createElement('div'); el.className=`toast ${type}`; el.textContent=message; toastRoot.appendChild(el); setTimeout(()=>el.remove(),3300);
  }
  function cloudReady() { return !!(cloud?.configured && cloudContext?.membership?.status==='approved'); }
  function cloudRole() { return cloudContext?.membership?.role || ''; }
  const roleLabels = {administrator:'Administrador',psychologist:'Psicóloga(o)',intake_manager:'Gestor de Acolhimento',patient:'Paciente'};
  function currentRole() { return cloudRole() || 'administrator'; }
  function currentRoleLabel() { return roleLabels[currentRole()] || 'Profissional'; }
  function currentProfile() {
    const authUser=cloud?.auth?.user||{};
    const profile=cloudContext?.profile||{};
    const fullName=profile.full_name||authUser.user_metadata?.full_name||(currentRole()==='administrator'?'Joab Lopes Mata':'Equipe Humanevo');
    const email=profile.email||authUser.email||(currentRole()==='administrator'?'joab.mata@gmail.com':'');
    const localProfile=(state.accessProfiles||[]).find(item=>String(item.email||'').toLowerCase()===String(email||'').toLowerCase());
    const avatarData=localProfile?.avatarData||profile.avatar_path||profile.avatar_url||authUser.user_metadata?.avatar_url||'';
    return {fullName,email,role:currentRole(),roleLabel:currentRoleLabel(),avatarData};
  }
  function currentAccessProfile() {
    const userId=cloudContext?.user?.id||cloud?.auth?.user?.id||'';
    const email=String(cloudContext?.profile?.email||cloudContext?.user?.email||cloud?.auth?.user?.email||'').toLowerCase();
    return (state.accessProfiles||[]).find(item=>(userId&&item.authUserId===userId)||(email&&String(item.email||'').toLowerCase()===email))||null;
  }
  function permissionSubjectKey(profile=currentAccessProfile()) { return profile?.authUserId||profile?.id||cloudContext?.user?.id||''; }
  function hasPermission(permissionKey, profile=currentAccessProfile(), role=currentRole()) {
    if(profile?.locked && role==='administrator') return true;
    const current=currentAccessProfile();
    const isCurrent=permissionSubjectKey(profile)===permissionSubjectKey(current);
    if(isCurrent&&cloudEffectivePermissions&&Object.prototype.hasOwnProperty.call(cloudEffectivePermissions,permissionKey)) return cloudEffectivePermissions[permissionKey]===true;
    const key=permissionSubjectKey(profile);
    const overrides=key?(state.userPermissionExceptions?.[key]||{}):{};
    if(Object.prototype.hasOwnProperty.call(overrides,permissionKey)) return overrides[permissionKey]===true;
    return state.rolePermissions?.[role]?.[permissionKey] ?? defaultRolePermissions?.[role]?.[permissionKey] ?? false;
  }
  function navAllowed(id) {
    const role=currentRole();
    const matrix={
      administrator:['dashboard','patients','library','forms','calendar','chat','repository','modifications','customization','support'],
      psychologist:['dashboard','patients','library','forms','calendar','chat','repository','modifications','customization','support'],
      intake_manager:['dashboard','patients','calendar','chat','modifications','customization','support'],
      patient:[]
    };
    if(!(matrix[role]||matrix.psychologist).includes(id)) return false;
    if(id==='forms' && !hasPermission('forms')) return false;
    if(id==='library' && role!=='intake_manager' && !hasPermission('forms')) return false;
    if(id==='calendar' && !hasPermission('calendar')) return false;
    if(id==='chat' && !hasPermission('chat')) return false;
    if(['customization','modifications'].includes(id) && !hasPermission('administration')) return false;
    return true;
  }
  function localPatientByCloudId(id) { return state.patients.find(p=>p.cloudId===id); }
  function cloudPatientByLocalId(id) { return patientById(id)?.cloudId || ''; }
  function formSnapshot(assessment) { const enriched=assessment.custom?ensureMinimumQuestionDepth(assessment):assessment; return {id:enriched.id,title:enriched.title,category:enriched.category,description:enriched.description||'',duration:Math.max(Number(enriched.duration)||10,18),template:enriched.template,questions:enriched.questions||templateToQuestions(enriched),references:enriched.references||[]}; }
  function unreadNotificationCount() { return (state.notifications||[]).filter(n=>!(n.readAt||n.read_at) && (n.recipientRole!=='patient')).length; }
  function isTextEntryActive() {
    const el=document.activeElement;
    if(!el) return false;
    if(el.isContentEditable) return true;
    if(!['INPUT','TEXTAREA','SELECT'].includes(el.tagName)) return false;
    const passive=['range','color','checkbox','radio','file','button','submit'];
    return !passive.includes(String(el.type||'').toLowerCase());
  }
  function renderWhenSafe() {
    if(isTextEntryActive() || state.modal) return false;
    render();
    return true;
  }

  function renderPageOnly() {
    const container=document.querySelector('.main .container');
    if(!container) { render(); return; }
    const active=document.activeElement;
    const focusName=active?.getAttribute?.('name')||active?.id||'';
    const selectionStart=typeof active?.selectionStart==='number'?active.selectionStart:null;
    const selectionEnd=typeof active?.selectionEnd==='number'?active.selectionEnd:null;
    const messageList=document.getElementById('chat-message-list');
    const scrollTop=messageList?.scrollTop||0;
    container.classList.add('page-updating');
    try {
      container.innerHTML=renderPage();
    } catch(error) {
      console.error('Falha ao atualizar a tela ativa:',error);
      container.innerHTML=`<section class="card dashboard-render-recovery"><div class="card-body">${emptyState('activity','Não foi possível atualizar esta visão','Recarregue a página. Seus dados permanecem preservados.')}</div></section>`;
    }
    requestAnimationFrame(()=>{
      container.classList.remove('page-updating');
      const nextList=document.getElementById('chat-message-list');
      if(nextList) nextList.scrollTop=scrollTop;
      if(focusName){
        const selector=active?.id?`#${CSS.escape(active.id)}`:`[name="${CSS.escape(focusName)}"]`;
        const next=document.querySelector(selector);
        if(next){next.focus({preventScroll:true});try{if(selectionStart!==null)next.setSelectionRange(selectionStart,selectionEnd??selectionStart);}catch(_){}}
      }
    });
  }

  function promiseTimeout(promise, milliseconds=5000) {
    let timer;
    return Promise.race([
      promise,
      new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error('Sincronização temporariamente indisponível.')),milliseconds); })
    ]).finally(()=>clearTimeout(timer));
  }
  async function initializeCloudSession() {
    if(!cloud?.configured || !cloud.auth?.access_token || sessionStorage.getItem('humanevo_fast_start')==='1') return;
    try {
      cloudContext=await promiseTimeout(cloud.currentContext(),4500);
      renderWhenSafe();
      if (cloudContext?.membership?.synthetic) {
        toast('Perfil reconhecido. A sincronização completa será ativada após a correção do banco.','success');
        return;
      }
      setTimeout(()=>syncCloudData(false),250);
    } catch(error){ console.warn('Sincronização inicial adiada:',error); }
  }
  async function syncCloudData(showToast=true) {
    if(!cloud?.configured || !cloud.auth?.access_token || cloudSyncing) return;
    cloudSyncing=true;
    try {
      cloudContext=cloudContext||await cloud.currentContext();
      if(!cloudContext?.membership || !['administrator','psychologist','intake_manager'].includes(cloudRole())) throw new Error('A conta conectada não possui acesso profissional aprovado.');
      await cloud.ensureChatChannels().catch(error=>console.warn('Canais padrão ainda não foram sincronizados:',error));
      const [remotePatients,remoteAppointments,remoteForms,remoteAssignments,remoteNotifications,remoteMemberships,remoteAccessControl,remoteEffectivePermissions,remoteChatThreads,remoteChatUsers,remoteBranding]=await Promise.all([
        cloud.listPatients(),cloud.listAppointments().catch(()=>[]),cloud.listForms(),cloud.listAssignmentsForStaff(),cloud.listNotifications(),
        cloudRole()==='administrator'?cloud.listMemberships():Promise.resolve([]),
        cloudRole()==='administrator'?cloud.listAccessControl().catch(()=>null):Promise.resolve(null),
        cloud.getMyPermissions().catch(()=>null),
        cloud.listChatThreads().catch(()=>[]),
        cloud.listChatUsers().catch(()=>[]),
        cloud.getClinicBranding(cloudContext?.membership?.clinic_id||'').catch(()=>null)
      ]);
      await applySharedLogo(brandingRowLogo(remoteBranding),{render:false});
      (remotePatients||[]).forEach(row=>{
        let local=state.patients.find(p=>p.cloudId===row.id || (row.email && p.email?.toLowerCase()===row.email.toLowerCase()));
        const mapped={cloudId:row.id,authUserId:row.user_id||'',name:row.full_name,email:row.email||'',phone:formatBrazilPhone(row.phone||''),birth:row.birth_date||'',addressZip:row.address_zip||'',addressStreet:row.address_street||'',addressNumber:row.address_number||'',addressComplement:row.address_complement||'',addressNeighborhood:row.address_neighborhood||'',addressCity:row.address_city||'',addressState:row.address_state||'',status:row.process_status||'active',risk:row.risk_level||'none',demand:row.demand||'',diagnosis:row.diagnosis||'',prognosis:row.prognosis||'',recommendation:row.recommendation||'',referral:row.referral||'',treatmentProgress:Number(row.treatment_progress)||0,blockReason:row.block_reason||'',tags:Array.isArray(row.tags)?row.tags:[],history:local?.history||[],evidences:local?.evidences||[],sessions:local?.sessions||0,last:local?.last||row.updated_at?.slice(0,10),next:local?.next||null};
        if(local) Object.assign(local,mapped); else state.patients.push({id:uid('p'),...mapped});
      });
      (remoteAppointments||[]).forEach(row=>{
        const patient=localPatientByCloudId(row.patient_id);if(!patient)return;
        let local=state.appointments.find(item=>item.cloudId===row.id||item.id===row.id);
        const start=toDateTimeLocalValue(row.starts_at);const end=toDateTimeLocalValue(row.ends_at);
        const mapped={cloudId:row.id,patientId:patient.id,start,end,duration:Math.max(1,Math.round((new Date(row.ends_at)-new Date(row.starts_at))/60000)),type:row.session_type||'Consulta',mode:row.mode||'Presencial',status:row.status||'pending',professional:local?.professional||'Equipe Humanevo',location:row.location||'',reminder:row.reminder||'24h',notes:row.notes||''};
        if(local)Object.assign(local,mapped);else state.appointments.push({id:row.id,...mapped});
      });
      state.appointments.sort((a,b)=>String(a.start||'').localeCompare(String(b.start||'')));
      state.patients.forEach(patient=>{const future=state.appointments.filter(item=>item.patientId===patient.id&&new Date(item.start)>=new Date()&&item.status!=='cancelled').sort((a,b)=>String(a.start).localeCompare(String(b.start)));patient.next=future[0]?.start||null;});
      (remoteForms||[]).forEach(row=>{
        let local=state.customForms.find(f=>f.cloudId===row.id || (row.external_key && f.id===row.external_key));
        const mapped={cloudId:row.id,id:local?.id||row.external_key||row.id,custom:true,title:row.title,category:row.category,description:row.description,duration:row.estimated_minutes,status:row.status,template:'custom',access:'Customizado',source:'Banco central',questions:row.questions||[],references:row.references_list||[],updatedAt:row.updated_at};
        if(local) Object.assign(local,mapped); else state.customForms.push(mapped);
      });
      state.formAssignments=(remoteAssignments||[]).map(row=>{
        const patient=localPatientByCloudId(row.patient_id); const f=row.humanevo_forms||{}; const response=Array.isArray(row.humanevo_form_responses)?row.humanevo_form_responses[0]:row.humanevo_form_responses;
        return {id:row.id,cloud:true,patientId:patient?.id||'',cloudPatientId:row.patient_id,formId:f.external_key||f.id,cloudFormId:row.form_id,status:row.status,dueAt:row.due_at,message:row.message,createdAt:row.created_at,submittedAt:row.submitted_at,answers:response?.answers||{},professionalSummary:response?.professional_summary||'',professionalRecommendations:response?.professional_recommendations||'',formSnapshot:{id:f.external_key||f.id,title:f.title,category:f.category,description:f.description,duration:f.estimated_minutes,questions:f.questions||[],references:f.references_list||[]}};
      });
      processChatNotifications(remoteNotifications);
      state.chatThreads=Array.isArray(remoteChatThreads)?remoteChatThreads:[];
      state.chatUsers=Array.isArray(remoteChatUsers)?remoteChatUsers:[];
      if(state.activeChatThreadId&&!state.chatThreads.some(t=>String(t.id)===String(state.activeChatThreadId)))state.activeChatThreadId='';
      (remoteMemberships||[]).forEach(membership=>{
        const remoteEmail=String(membership.humanevo_profiles?.email||'').trim().toLowerCase();
        let local=state.accessProfiles.find(profile=>profile.authUserId===membership.user_id||(remoteEmail&&String(profile.email||'').toLowerCase()===remoteEmail));
        const mapped={
          name:membership.humanevo_profiles?.full_name||local?.name||'Usuário Humanevo',
          email:remoteEmail||local?.email||'',
          roleId:membership.role||local?.roleId||'patient',
          status:membership.status==='approved'?'active':membership.status,
          authUserId:membership.user_id,
          cloudProvisionedAt:local?.cloudProvisionedAt||membership.created_at||new Date().toISOString(),
          avatarData:membership.humanevo_profiles?.avatar_path||local?.avatarData||'',
          updatedAt:new Date().toISOString()
        };
        if(local)Object.assign(local,mapped);
        else state.accessProfiles.push({id:uid('access'),avatarData:'',notes:'Perfil sincronizado do Supabase Authentication.',locked:false,createdAt:membership.created_at||new Date().toISOString(),forcePasswordChange:false,...mapped});
      });
      state.cloudPendingProfiles=(remoteMemberships||[]).filter(m=>m.status!=='approved').map(m=>({id:m.id,userId:m.user_id,role:m.role,status:m.status,createdAt:m.created_at,name:m.humanevo_profiles?.full_name||'Novo usuário',email:m.humanevo_profiles?.email||'',phone:m.humanevo_profiles?.phone||''}));
      if(remoteAccessControl){
        (remoteAccessControl.roles||[]).forEach(row=>{if(state.rolePermissions[row.role]&&row.permission_key in state.rolePermissions[row.role])state.rolePermissions[row.role][row.permission_key]=row.allowed===true;});
        const nextExceptions={};(remoteAccessControl.users||[]).forEach(row=>{nextExceptions[row.user_id]=nextExceptions[row.user_id]||{};nextExceptions[row.user_id][row.permission_key]=row.allowed===true;});
        state.userPermissionExceptions={...state.userPermissionExceptions,...nextExceptions};
      }
      if(Array.isArray(remoteEffectivePermissions)) cloudEffectivePermissions=Object.fromEntries(remoteEffectivePermissions.map(row=>[row.permission_key,row.allowed===true]));
      saveState();renderWhenSafe();if(showToast)toast('Dados sincronizados com o banco central.');
    } catch(error){ if(showToast)toast(error.message,'error'); }
    finally{cloudSyncing=false;}
  }
  async function ensureCloudForm(assessment) {
    if(!cloudReady()) throw new Error('Conecte uma conta profissional no Banco central.');
    if(assessment.cloudId) return assessment.cloudId;
    const existing=await cloud.rest('humanevo_forms',`external_key=eq.${encodeURIComponent(assessment.id)}&select=id&limit=1`);
    if(existing?.[0]?.id){
      assessment.cloudId=existing[0].id;
      const snapshot=formSnapshot(assessment);
      await cloud.rest('humanevo_forms',`id=eq.${encodeURIComponent(assessment.cloudId)}`,{method:'PATCH',body:{title:snapshot.title,category:snapshot.category||'Customizado',description:snapshot.description||'',estimated_minutes:Number(snapshot.duration)||20,questions:snapshot.questions,references_list:snapshot.references||[],metadata:{source:assessment.source||'Humanevo',quality_standard:'25-plus'}}}).catch(()=>{});
      saveState();return assessment.cloudId;
    }
    const snapshot=formSnapshot(assessment);
    const payload={clinic_id:cloudContext.membership.clinic_id,owner_id:cloudContext.user.id,external_key:assessment.id,title:snapshot.title,category:snapshot.category||'Customizado',description:snapshot.description||'',estimated_minutes:Number(snapshot.duration)||20,status:'active',questions:snapshot.questions,references_list:snapshot.references||[],metadata:{source:assessment.source||'Humanevo',quality_standard:'25-plus'}};
    const rows=await cloud.rest('humanevo_forms','',{method:'POST',body:payload}); assessment.cloudId=rows?.[0]?.id||'';saveState();return assessment.cloudId;
  }

  function renderFatalState(error) {
    console.error('Falha ao abrir o painel Humanevo:', error);
    app.innerHTML = `<main class="boot-recovery"><section><div class="boot-logo">H</div><h1>Não foi possível concluir a abertura</h1><p>O painel encontrou dados temporários incompatíveis ou um arquivo antigo armazenado no navegador.</p><div><button type="button" id="humanevo-retry">Tentar novamente</button><button type="button" id="humanevo-clear-local">Limpar dados temporários</button></div></section></main>`;
    document.getElementById('humanevo-retry')?.addEventListener('click',()=>location.reload());
    document.getElementById('humanevo-clear-local')?.addEventListener('click',async()=>{
      try { localStorage.removeItem(STORAGE_KEY); sessionStorage.removeItem('humanevo_fast_start'); } catch(_) {}
      try { if('caches' in window){ for(const key of await caches.keys()) await caches.delete(key); } } catch(_) {}
      location.reload();
    });
  }

  function render() {
    try {
      if(!navAllowed(state.nav)) state.nav='dashboard';
      applyCustomization();
      app.innerHTML = `<div class="app-shell ${state.sidebarCollapsed?'sidebar-collapsed':''}">${renderGlobalHeader()}${renderSidebar()}${state.sidebarOpen?'<button class=\"sidebar-overlay\" data-action=\"close-sidebar\" aria-label=\"Fechar menu lateral\"></button>':''}<div class="content-shell">${renderTopbar()}<main class="main"><div class="container">${renderPage()}</div></main>${renderFooter()}</div></div>`;
      renderModal();
      window.__HUMANEVO_APP_READY__ = true;
      window.dispatchEvent(new CustomEvent('humanevo:ready'));
    } catch (error) {
      renderFatalState(error);
    }
  }


  function rerenderAndRestoreInput(selector) {
    const current = document.activeElement;
    const isTarget = !!(current && typeof current.matches==='function' && current.matches(selector));
    const start = isTarget && typeof current.selectionStart==='number' ? current.selectionStart : null;
    const end = isTarget && typeof current.selectionEnd==='number' ? current.selectionEnd : null;
    render();
    requestAnimationFrame(() => {
      const field = document.querySelector(selector);
      if(!field) return;
      field.focus({preventScroll:true});
      const nextStart = typeof start==='number' ? Math.min(start, field.value.length) : field.value.length;
      const nextEnd = typeof end==='number' ? Math.min(end, field.value.length) : nextStart;
      try { field.setSelectionRange(nextStart, nextEnd); } catch(_) {}
    });
  }

  function renderGlobalHeader() {
    const customLogo=state.customization?.logoData||'';
    const logoMarkup=customLogo
      ? `<span class="global-brand-logo custom-brand-logo"><img src="${customLogo}" alt="Logo da plataforma"></span>`
      : renderBrandMark('global-brand-logo');
    const brandContent=`${logoMarkup}<span class="global-brand-text"><strong><span class="human">Human</span><span class="evo">evo</span></strong><small>Psicologia e Desenvolvimento Humano</small></span>`;
    return `<header class="global-brandbar"><button class="global-brand-home ${customLogo?'has-custom-logo':''}" data-action="home" title="Voltar para o início" aria-label="Voltar para o início">${brandContent}</button><div class="global-brand-meta"><span>Gestão clínica integrada</span><i></i><span>v3.10.9</span></div></header>`;
  }

  function renderFooter() {
    return `<footer class="app-footer"><span>Humanevo · versão 3.10.9</span><span>Desenvolvido por: <strong>JLM</strong></span></footer>`;
  }

  function renderSidebar() {
    const counts={active:state.patients.filter(p=>!isRepositoryStatus(p.status)).length, archived:state.patients.filter(p=>isRepositoryStatus(p.status)).length};
    const verse=dailyVerse();
    const items=[
      ['dashboard','dashboard','Visão geral',''],
      ['patients','users','Pacientes',counts.active],
      ['library','library','Biblioteca',allAssessments().length],
      ['forms','form','Formulários',state.customForms.length],
      ['calendar','calendar','Agendamentos',state.appointments.length],
      ['chat','chat','Chat',Number((state.chatThreads||[]).reduce((sum,t)=>sum+Number(t.unread_count||t.unreadCount||0),0))],
      ['repository','archive','Repositório',counts.archived],
      ['modifications','activity','Log de modificações',(state.modificationLogs||[]).length],
      ['customization','settings','Administração',''],
      ['support','developer','Mensagem ao desenvolvedor','']
    ].filter(([id])=>navAllowed(id));
    return `<aside class="sidebar ${state.sidebarOpen?'open':''} ${state.sidebarCollapsed?'collapsed':''}">
      <div class="brand"><button class="sidebar-home-icon" data-action="home" aria-label="Voltar ao início" title="Voltar ao início">${icon('home',22)}</button><div class="brand-copy"><strong>Início</strong><small>Painel principal</small></div></div>
      <div class="nav-label">Gestão clínica</div>
      <nav class="nav">${items.map(([id,ic,label,count])=>`<button class="nav-btn ${state.nav===id?'active':''}" data-action="nav" data-nav="${id}" data-tooltip="${escapeHtml(label)}" aria-label="${escapeHtml(label)}">${icon(ic)}<span class="nav-text">${label}</span>${count!==''?`<span class="count">${count}</span>`:''}</button>`).join('')}</nav>
      <div class="sidebar-bottom"><div class="daily-verse"><span class="verse-label">Palavra do dia</span><p>“${escapeHtml(verse[1])}”</p><small>${escapeHtml(verse[0])}</small></div></div>
    </aside>`;
  }
  function renderTopbar() {
    const contextual = state.nav==='forms' && ['administrator','psychologist'].includes(currentRole()) ? `<button class="icon-btn primary-icon" data-action="open-form-builder" title="Criar novo formulário" aria-label="Criar novo formulário">${icon('plus')}</button>` : '';
    const profile=currentProfile();
    return `<header class="topbar">
      <div class="topbar-left">
        <button class="icon-btn mobile-menu" data-action="toggle-sidebar" aria-label="Abrir menu" title="Abrir menu">${icon('menu')}</button>
        <button class="icon-btn desktop-collapse" data-action="toggle-sidebar-collapse" aria-label="${state.sidebarCollapsed?'Expandir menu':'Recolher menu'}" title="${state.sidebarCollapsed?'Expandir menu':'Recolher menu'}">${icon('menu')}</button>
        <div class="search">${icon('search')}<input id="global-search" placeholder="Buscar paciente, avaliação ou agenda..." value="${escapeHtml(state.patientSearch)}"></div>
      </div>
      <div class="topbar-right">
        ${contextual}
        <button class="icon-btn notification-button" data-action="open-notifications" title="Notificações" aria-label="Notificações">${icon('bell')}${unreadNotificationCount()?`<span class="notification-count">${unreadNotificationCount()}</span>`:''}</button>
        ${['administrator','psychologist','intake_manager'].includes(currentRole())?`<button class="icon-btn" data-action="open-appointment" title="Novo agendamento" aria-label="Novo agendamento">${icon('calendar')}</button><button class="icon-btn" data-action="open-patient-form" title="Novo paciente" aria-label="Novo paciente">${icon('plus')}</button>`:''}
        <span class="topbar-divider"></span>
        <div class="profile-menu-wrap">
          <button class="profile-chip profile-chip-button" data-action="toggle-profile-menu" aria-expanded="${state.profileMenuOpen?'true':'false'}" aria-haspopup="menu" title="Abrir opções do perfil">
            <div class="profile-chip-copy"><strong>${escapeHtml(profile.fullName)}</strong><small>${escapeHtml(profile.roleLabel)}${profile.email?` · ${escapeHtml(profile.email)}`:''}</small></div>
            ${renderAvatar(profile,'avatar')}<span class="profile-chevron">${icon('chevronDown',15)}</span>
          </button>
          ${state.profileMenuOpen?`<div class="profile-dropdown" role="menu"><div class="profile-dropdown-head">${renderAvatar(profile,'profile-dropdown-avatar')}<div><strong>${escapeHtml(profile.fullName)}</strong><small>${escapeHtml(profile.email||'Sessão local')}</small><span>${escapeHtml(profile.roleLabel)}</span></div></div><button data-action="open-switch-user" role="menuitem">${icon('switchUser')}<span><strong>Trocar usuário</strong><small>Autenticar outra conta sem voltar ao início</small></span></button><button data-action="logout-session" class="danger-menu" role="menuitem">${icon('logout')}<span><strong>${isDemoAccess?'Sair do ambiente de teste':'Sair da plataforma'}</strong><small>${isDemoAccess?'Voltar ao portal de acesso':'Encerrar esta sessão com segurança'}</small></span></button></div>`:''}
        </div>
      </div>
    </header>`;
  }

  function renderPage() {
    if(!navAllowed(state.nav)) state.nav='dashboard';
    if(state.nav==='patients') return renderPatientsPage(false);
    if(state.nav==='repository') return renderPatientsPage(true);
    if(state.nav==='library') return renderLibraryPage();
    if(state.nav==='forms') return renderFormStudioPage();
    if(state.nav==='customization') return renderCustomizationPage();
    if(state.nav==='modifications') return renderModificationLogsPage();
    if(state.nav==='calendar') return renderCalendarPage();
    if(state.nav==='chat') return renderChatPage();
    if(state.nav==='support') return renderSupportPage();
    return renderDashboard();
  }
  function renderDashboard() {
    const patients=Array.isArray(state.patients)?state.patients:[];
    const appointments=Array.isArray(state.appointments)?state.appointments:[];
    const assessmentRecords=Array.isArray(state.assessmentRecords)?state.assessmentRecords:[];
    const active=patients.filter(p=>!isRepositoryStatus(p?.status)).length;
    const today=new Date();
    const upcoming=appointments.filter(a=>a?.start&&new Date(a.start)>=today&&a.status!=='cancelled').sort((a,b)=>new Date(a.start)-new Date(b.start));
    const assessmentsThisMonth=assessmentRecords.filter(r=>r?.date&&new Date(r.date).getMonth()===today.getMonth()).length;
    const alerts=patients.filter(p=>['moderate','high','critical'].includes(p?.risk)).length;
    const tabs=[['overview','Resumo executivo'],['performance','Desempenho do tratamento'],['insights','Pesquisas e insights']];
    if(!tabs.some(([id])=>id===state.dashboardTab)) state.dashboardTab='overview';
    let content='';
    if(state.dashboardTab==='performance') content=renderTreatmentPerformance();
    else if(state.dashboardTab==='insights') content=renderResearchInsights();
    else content=`<section class="stats-grid">
        ${statCard('users',active,'Pacientes em acompanhamento','Visão atual')}
        ${statCard('calendar',upcoming.length,'Consultas futuras','Agenda ativa')}
        ${statCard('file',assessmentsThisMonth,'Avaliações registradas','Mês atual')}
        ${statCard('activity',alerts,'Pontos de atenção','Revisão profissional')}
      </section>
      <section class="dashboard-groups">
        <details class="dashboard-group" open><summary><span>${icon('calendar')} Agenda e próximos passos</span><small>${upcoming.length} compromissos futuros</small></summary><div class="dashboard-group-body">${renderAgendaList(upcoming.slice(0,6))}</div></details>
        <details class="dashboard-group" open><summary><span>${icon('activity')} Atividade clínica recente</span><small>Histórico consolidado</small></summary><div class="dashboard-group-body">${renderRecentActivity()}</div></details>
      </section>`;
    return `<div class="page-head"><div><h1>Visão geral da clínica</h1><p>Indicadores agrupados para decisões clínicas, acompanhamento e gestão do cuidado.</p></div></div>
      <div class="dashboard-tabs" role="tablist" aria-label="Indicadores da visão geral">${tabs.map(([id,label])=>`<button type="button" role="tab" aria-selected="${state.dashboardTab===id?'true':'false'}" class="${state.dashboardTab===id?'active':''}" data-action="dashboard-tab" data-value="${id}">${label}</button>`).join('')}</div><div class="dashboard-tab-content" data-dashboard-view="${state.dashboardTab}">${content}</div>`;
  }

  function statCard(ic,value,label,trend) { return `<article class="stat-card"><div class="stat-top"><span class="stat-icon">${icon(ic)}</span><span class="stat-trend">${trend}</span></div><div><strong>${value}</strong><p>${label}</p></div></article>`; }

  function renderTreatmentPerformance() {
    const patients=Array.isArray(state.patients)?state.patients:[];
    const appointments=Array.isArray(state.appointments)?state.appointments:[];
    const clamp=value=>Math.max(0,Math.min(100,Number.isFinite(Number(value))?Number(value):0));
    const activeRows=patients
      .filter(p=>p&&!isRepositoryStatus(p.status))
      .map(p=>({...p,treatmentProgress:clamp(p.treatmentProgress)}))
      .sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
    const avg=activeRows.length?Math.round(activeRows.reduce((sum,p)=>sum+p.treatmentProgress,0)/activeRows.length):0;
    const validAppointments=appointments.filter(a=>a&&a.status!=='cancelled');
    const completed=validAppointments.filter(a=>a.status==='completed').length;
    const attendance=validAppointments.length?Math.round(completed/validAppointments.length*100):0;
    const stable=activeRows.filter(p=>['none','low'].includes(p.risk||'none')).length;
    const rows=activeRows.length?activeRows.map(p=>`<button type="button" class="performance-row" data-action="open-patient" data-id="${escapeHtml(p.id||'')}" aria-label="Abrir acompanhamento de ${escapeHtml(p.name||'Paciente')}">
        <span class="table-avatar" aria-hidden="true">${initials(p.name||'Paciente')}</span>
        <span class="performance-name"><strong>${escapeHtml(p.name||'Paciente sem nome')}</strong><small>${escapeHtml(p.demand||'Demanda não informada')}</small></span>
        <span class="performance-bar" role="progressbar" aria-label="Evolução do tratamento" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${p.treatmentProgress}"><i style="width:${p.treatmentProgress}%"></i></span>
        <b>${p.treatmentProgress}%</b>
      </button>`).join(''):emptyState('activity','Nenhum paciente em acompanhamento','Cadastre ou reative um paciente para visualizar os indicadores de desempenho.');
    return `<section class="analytics-grid performance-summary-grid">
        <article class="analytics-card"><span>Evolução média</span><strong>${avg}%</strong><div class="big-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${avg}"><i style="width:${avg}%"></i></div><small>Média do progresso registrado nos acompanhamentos ativos.</small></article>
        <article class="analytics-card"><span>Comparecimento</span><strong>${attendance}%</strong><div class="big-progress" role="progressbar" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${attendance}"><i style="width:${attendance}%"></i></div><small>Sessões realizadas em relação à agenda válida.</small></article>
        <article class="analytics-card"><span>Pacientes estáveis</span><strong>${stable}</strong><small>Pacientes ativos sem alerta elevado no acompanhamento atual.</small></article>
      </section>
      <section class="card performance-panel"><div class="card-head"><div><h2>Desempenho por paciente</h2><p>Visão resumida do progresso de tratamento.</p></div><span class="performance-count">${activeRows.length} ${activeRows.length===1?'paciente':'pacientes'}</span></div><div class="card-body"><div class="performance-list">${rows}</div></div></section>`;
  }

  function renderResearchInsights() {
    const total=state.assessmentRecords.length;
    const linked=state.assessmentRecords.filter(r=>r.patientId).length;
    const byAssessment={}; state.assessmentRecords.forEach(r=>{const name=assessmentById(r.assessmentId)?.title||'Outros';byAssessment[name]=(byAssessment[name]||0)+1;});
    const top=Object.entries(byAssessment).sort((a,b)=>b[1]-a[1]).slice(0,5);
    const insightRows=[
      `Foram registradas ${total} avaliações; ${linked} estão vinculadas a pacientes.`,
      `${state.customForms.length} formulários customizados integram a biblioteca.`,
      `${state.patients.filter(p=>p.risk==='moderate').length} pacientes apresentam atenção moderada e ${state.patients.filter(p=>['high','critical'].includes(p.risk)).length} atenção elevada.`,
      `${state.patients.filter(p=>isRepositoryStatus(p.status)).length} processos estão organizados no repositório clínico.`
    ];
    return `<section class="analytics-grid"><article class="analytics-card"><span>Avaliações realizadas</span><strong>${total}</strong><small>Registros salvos na plataforma.</small></article><article class="analytics-card"><span>Formulários ativos</span><strong>${allAssessments().length}</strong><small>Biblioteca e modelos customizados.</small></article><article class="analytics-card"><span>Taxa de vínculo</span><strong>${total?Math.round(linked/total*100):0}%</strong><small>Avaliações associadas a pacientes.</small></article></section><section class="grid-2"><article class="card"><div class="card-head"><h2>Pesquisas mais aplicadas</h2></div><div class="card-body">${top.length?`<div class="metric-bars">${top.map(([name,value])=>`<div><span>${escapeHtml(name)}</span><div><i style="width:${Math.min(100,value/(top[0]?.[1]||1)*100)}%"></i></div><b>${value}</b></div>`).join('')}</div>`:emptyState('chart','Sem dados suficientes','Aplique avaliações para gerar comparações.')}</div></article><article class="card"><div class="card-head"><h2>Insights automáticos</h2></div><div class="card-body"><div class="insight-list">${insightRows.map(t=>`<div>${icon('insight')}<p>${escapeHtml(t)}</p></div>`).join('')}</div></div></article></section>`;
  }

  function renderRecentActivity() {
    const items=[];
    state.patients.forEach(p=>(p.history||[]).forEach(h=>items.push({...h,patient:p.name,patientId:p.id})));
    items.sort((a,b)=>new Date(b.date)-new Date(a.date));
    if(!items.length) return emptyState('activity','Sem atividade recente','Novos registros clínicos aparecerão aqui.');
    return `<div class="timeline">${items.slice(0,5).map(h=>`<div class="timeline-item"><span class="timeline-dot">${icon(h.type==='assessment'?'file':'activity',12)}</span><div class="timeline-card"><strong>${escapeHtml(h.title)} · ${escapeHtml(h.patient)}</strong><p>${escapeHtml(h.content)}</p><time>${formatDate(h.date)}</time></div></div>`).join('')}</div>`;
  }

  function patientSortValue(patient,key) {
    if(key==='status') return statusLabel(patient.status||'').toLocaleLowerCase('pt-BR');
    if(key==='demand') return String(isClinicalRole()?patient.demand:(patient.phone||patient.email)||'').toLocaleLowerCase('pt-BR');
    if(key==='next') return patient.next ? new Date(patient.next).getTime() : Number.MAX_SAFE_INTEGER;
    if(key==='evidence') return isClinicalRole() ? Number((patient.evidences||[]).length) : (patient.authUserId?1:0);
    return String(patient.name||'').toLocaleLowerCase('pt-BR');
  }

  function sortPatients(rows=[]) {
    const sort=state.patientSort||{key:'name',direction:'asc'};
    const factor=sort.direction==='desc'?-1:1;
    return [...rows].sort((a,b)=>{
      const av=patientSortValue(a,sort.key),bv=patientSortValue(b,sort.key);
      if(typeof av==='number'&&typeof bv==='number') return (av-bv)*factor;
      return String(av).localeCompare(String(bv),'pt-BR',{numeric:true,sensitivity:'base'})*factor;
    });
  }

  function renderSortablePatientHeader(key,label) {
    const active=state.patientSort?.key===key;
    const direction=active?(state.patientSort.direction==='desc'?'descending':'ascending'):'none';
    const glyph=active?(state.patientSort.direction==='desc'?'↓':'↑'):'↕';
    return `<th class="sortable-column" aria-sort="${direction}"><button type="button" class="patient-sort-button ${active?'active':''}" data-action="patient-sort" data-sort-key="${key}" title="Ordenar por ${escapeHtml(label)}"><span>${escapeHtml(label)}</span><b aria-hidden="true">${glyph}</b></button></th>`;
  }

  function visiblePatients(repository=false) {
    const repo=repository?state.patientRepository:'active';
    let patients=state.patients.filter(p=>repository?(repo==='all'?isRepositoryStatus(p.status):p.status===repo):!isRepositoryStatus(p.status));
    const query=state.patientSearch.trim().toLowerCase();
    if(query) patients=patients.filter(p=>`${p.name} ${p.email} ${p.demand} ${(p.tags||[]).join(' ')}`.toLowerCase().includes(query));
    return sortPatients(patients);
  }

  function selectedPatientSet() {
    return new Set(Array.isArray(state.selectedPatientIds)?state.selectedPatientIds:[]);
  }

  function renderPatientBulkToolbar(patients) {
    if(!hasPermission('delete_patients_bulk')) return '';
    const selected=selectedPatientSet();
    const visibleIds=patients.map(p=>p.id);
    const selectedVisible=visibleIds.filter(id=>selected.has(id));
    const allSelected=visibleIds.length>0&&selectedVisible.length===visibleIds.length;
    return `<div class="patient-bulk-toolbar ${selectedVisible.length?'has-selection':''}">
      <label class="bulk-select-control"><input type="checkbox" data-action="toggle-select-all-patients" ${allSelected?'checked':''}><span>${allSelected?'Desmarcar todos':'Selecionar todos desta visão'}</span></label>
      <div class="patient-bulk-summary"><strong>${selectedVisible.length}</strong><span>paciente(s) selecionado(s)</span></div>
      <div class="patient-bulk-actions">${selectedVisible.length?`<button class="btn btn-secondary btn-sm" data-action="clear-patient-selection">${icon('close',14)} Limpar seleção</button><button class="btn btn-danger btn-sm" data-action="open-bulk-delete-patients">${icon('trash',14)} Excluir selecionados</button>`:'<span class="bulk-selection-hint">Use os marcadores nos cards ou na lista.</span>'}</div>
    </div>`;
  }

  function renderPatientsPage(repository=false) {
    const repo=repository?state.patientRepository:'active';
    const patients=visiblePatients(repository);
    const title=repository?'Repositório clínico':'Pacientes';
    const subtitle=repository?'Processos encerrados, desistentes, bloqueados ou organizados por status.':'Gerencie o acompanhamento em cards ou lista. Dê duplo clique para abrir o cadastro.';
    const repositoryStatuses=state.patientStatuses.filter(s=>s.repository);
    return `<div class="page-head"><div><h1>${title}</h1><p>${subtitle}</p></div><div class="page-actions"><button class="btn btn-primary" data-action="open-patient-form">${icon('plus')} Novo paciente</button></div></div>
      <div class="toolbar">
        <div class="filter-chips">${repository?`<button class="chip ${repo==='all'?'active':''}" data-action="repo-filter" data-value="all">Todos</button>${repositoryStatuses.map(s=>`<button class="chip ${repo===s.id?'active':''}" data-action="repo-filter" data-value="${s.id}">${escapeHtml(s.label)}</button>`).join('')}`:`<span class="chip active">Em acompanhamento</span>`}</div>
        <div class="segmented" aria-label="Modo de visualização"><button class="${state.patientView==='cards'?'active':''}" data-action="patient-view" data-value="cards" title="Cards">${icon('grid')}</button><button class="${state.patientView==='list'?'active':''}" data-action="patient-view" data-value="list" title="Lista">${icon('list')}</button></div>
      </div>
      ${renderPatientBulkToolbar(patients)}
      ${state.patientView==='cards'?renderPatientCards(patients):renderPatientTable(patients)}`;
  }

  function renderPatientCards(patients) {
    if(!patients.length) return emptyState('users','Nenhum paciente encontrado','Ajuste os filtros ou cadastre um novo paciente.');
    const selected=selectedPatientSet();
    const canSelect=hasPermission('delete_patients_bulk');
    const clinical=isClinicalRole();
    return `<section class="patient-grid">${patients.map(p=>`<article class="patient-card status-neon ${selected.has(p.id)?'patient-selected':''}" ${statusInline(p.status)} data-patient-id="${p.id}" tabindex="0">
      ${canSelect?`<label class="patient-select-flag" title="Selecionar ${escapeHtml(p.name)}"><input type="checkbox" data-action="toggle-patient-selection" data-id="${p.id}" ${selected.has(p.id)?'checked':''}><span>${icon('check',14)}</span></label>`:''}
      <div class="patient-head"><div class="patient-person"><div class="patient-avatar">${initials(p.name)}</div><div><strong>${escapeHtml(p.name)}</strong><small>${ageFromBirth(p.birth)} anos · ${escapeHtml(formatBrazilPhone(p.phone))}</small></div></div><span class="status-badge" ${statusInline(p.status)}>${cardStatusLabel(p.status)}</span></div>
      <div class="patient-card-actions" role="group" aria-label="Ações do paciente"><button class="mini-icon-btn" data-action="open-email" data-id="${p.id}" title="Enviar e-mail">${icon('mail')}</button><button class="mini-icon-btn" data-action="open-whatsapp-patient" data-id="${p.id}" title="Abrir WhatsApp">${icon('phone')}</button><button class="mini-icon-btn" data-action="open-appointment" data-patient="${p.id}" title="Agendar">${icon('calendar')}</button>${clinical&&!isRepositoryStatus(p.status)?`<button class="mini-icon-btn" data-action="open-archive-patient" data-id="${p.id}" title="Guardar no repositório">${icon('archive')}</button><button class="mini-icon-btn" data-action="open-block-patient" data-id="${p.id}" title="Bloquear paciente">${icon('lock')}</button>`:''}<button class="mini-icon-btn" data-action="open-patient" data-id="${p.id}" title="Abrir cadastro">${icon('arrow')}</button></div>
      ${clinical?`<p class="patient-demand">${escapeHtml(p.demand||'Demanda ainda não registrada.')}</p><div class="patient-tags">${(p.tags||[]).map(t=>`<span class="mini-tag">${escapeHtml(t)}</span>`).join('')}</div>`:`<p class="patient-demand intake-contact-summary">${escapeHtml(p.email||'E-mail não informado')}<br>${escapeHtml(formatBrazilPhone(p.phone)||'Telefone não informado')}</p>`}
      <div class="patient-meta"><div><span>Próxima consulta</span><strong>${p.next?`${formatDate(p.next,{day:'2-digit',month:'short'})} · ${formatTime(p.next)}`:'Não agendada'}</strong>${patientAppointmentCardStatus(p.id)}</div><div><span>${clinical?'Evidências':'Acesso ao portal'}</span><strong>${clinical?`${(p.evidences||[]).length} arquivo(s)`:(p.authUserId?'Ativo':'Pendente')}</strong></div></div>
    </article>`).join('')}</section>`;
  }

  function renderPatientTable(patients) {
    if(!patients.length) return emptyState('users','Nenhum paciente encontrado','Ajuste os filtros ou cadastre um novo paciente.');
    const selected=selectedPatientSet();
    const canSelect=hasPermission('delete_patients_bulk');
    const clinical=isClinicalRole();
    const allSelected=patients.length>0&&patients.every(p=>selected.has(p.id));
    const headers=`${canSelect?`<th class="selection-column"><label class="table-select-flag" title="Selecionar todos"><input type="checkbox" data-action="toggle-select-all-patients" ${allSelected?'checked':''}><span>${icon('check',13)}</span></label></th>`:''}${renderSortablePatientHeader('name','Paciente')}${renderSortablePatientHeader('status','Status')}${renderSortablePatientHeader('demand',clinical?'Demanda':'Contato')}${renderSortablePatientHeader('next','Próxima consulta')}${renderSortablePatientHeader('evidence',clinical?'Evidências':'Portal')}<th class="actions-column">Ações</th>`;
    return `<div class="card table-wrap patient-table-shell"><table class="data-table patient-selection-table"><thead><tr>${headers}</tr></thead><tbody>${patients.map(p=>`<tr data-patient-id="${p.id}" class="status-row ${selected.has(p.id)?'patient-selected-row':''}" ${statusInline(p.status)}>${canSelect?`<td class="selection-column"><label class="table-select-flag" title="Selecionar ${escapeHtml(p.name)}"><input type="checkbox" data-action="toggle-patient-selection" data-id="${p.id}" ${selected.has(p.id)?'checked':''}><span>${icon('check',13)}</span></label></td>`:''}<td><div class="table-patient"><span class="table-avatar">${initials(p.name)}</span><div><strong>${escapeHtml(p.name)}</strong><small style="display:block;color:var(--ink-faint)">${escapeHtml(p.email)}</small></div></div></td><td><span class="status-badge" ${statusInline(p.status)}>${statusLabel(p.status)}</span></td><td>${clinical?escapeHtml(p.demand||'—'):`${escapeHtml(formatBrazilPhone(p.phone)||'—')}`}</td><td>${p.next?`${formatDate(p.next,{day:'2-digit',month:'short'})} · ${formatTime(p.next)}`:'—'}</td><td>${clinical?(p.evidences||[]).length:(p.authUserId?'Ativo':'Pendente')}</td><td><div class="table-row-actions">${clinical&&!isRepositoryStatus(p.status)?`<button class="mini-icon-btn" data-action="open-block-patient" data-id="${p.id}" title="Bloquear">${icon('lock')}</button>`:''}<button class="mini-icon-btn" data-action="open-patient" data-id="${p.id}" title="Abrir">${icon('arrow')}</button></div></td></tr>`).join('')}</tbody></table></div>`;
  }

  function renderLibraryPage() {
    const categories=['Todas',...new Set(allAssessments().map(a=>a.category))];
    const query=state.assessmentSearch.toLowerCase().trim();
    const rows=allAssessments().filter(a=>(state.assessmentCategory==='Todas'||a.category===state.assessmentCategory)&&(!query||`${a.title} ${a.category} ${a.description} ${(a.references||[]).join(' ')}`.toLowerCase().includes(query)));
    const pageSize=18;
    const pageCount=Math.max(1,Math.ceil(rows.length/pageSize));
    state.assessmentPage=Math.min(Math.max(1,state.assessmentPage||1),pageCount);
    const visible=rows.slice((state.assessmentPage-1)*pageSize,state.assessmentPage*pageSize);
    return `<div class="page-head"><div><h1>Biblioteca de avaliações</h1><p>Catálogo amplo de processos avaliativos, formulários profissionais e modelos customizados pela equipe.</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="library-info">${icon('book')} Governança</button><button class="btn btn-secondary" data-action="nav" data-nav="forms">${icon('form')} Gerenciar formulários</button></div></div>
      <div class="toolbar"><div class="filter-chips">${categories.map(c=>`<button class="chip ${state.assessmentCategory===c?'active':''}" data-action="assessment-category" data-value="${escapeHtml(c)}">${escapeHtml(c)}</button>`).join('')}</div><div class="search" style="width:min(360px,100%)">${icon('search')}<input id="assessment-search" placeholder="Buscar avaliação ou referência..." value="${escapeHtml(state.assessmentSearch)}"></div></div>
      <div class="results-bar"><span><strong>${rows.length}</strong> avaliações encontradas · <strong>${state.customForms.length}</strong> customizadas</span><span>Página ${state.assessmentPage} de ${pageCount}</span></div>
      ${visible.length?`<section class="library-grid">${visible.map(a=>renderAssessmentCard(a)).join('')}</section>${pageCount>1?`<div class="pagination"><button class="btn btn-secondary btn-sm" data-action="assessment-page" data-value="${state.assessmentPage-1}" ${state.assessmentPage===1?'disabled':''}>${icon('chevronLeft')} Anterior</button><div class="page-dots">${Array.from({length:pageCount},(_,i)=>i+1).slice(Math.max(0,state.assessmentPage-3),Math.min(pageCount,state.assessmentPage+2)).map(n=>`<button class="${n===state.assessmentPage?'active':''}" data-action="assessment-page" data-value="${n}">${n}</button>`).join('')}</div><button class="btn btn-secondary btn-sm" data-action="assessment-page" data-value="${state.assessmentPage+1}" ${state.assessmentPage===pageCount?'disabled':''}>Próxima ${icon('chevronRight')}</button></div>`:''}`:emptyState('library','Nenhuma avaliação encontrada','Tente outra categoria ou termo de busca.')}`;
  }
  function assessmentReferenceItems(a) {
    const base=Array.isArray(a?.references)?a.references:[];
    const extra=Array.isArray(state.libraryReferences?.[a?.id])?state.libraryReferences[a.id]:[];
    return [...base,...extra].filter((value,index,array)=>value&&array.indexOf(value)===index);
  }
  function safeReferenceHost(url){try{return new URL(url).hostname.replace(/^www\./,'');}catch(_){return 'Referência externa';}}
  function renderAssessmentReferenceModal(assessmentId){
    const assessment=assessmentById(assessmentId);if(!assessment)return closeModal();
    const refs=assessmentReferenceItems(assessment);
    const body=`<form id="assessment-reference-form" class="form-grid"><input type="hidden" name="assessmentId" value="${escapeHtml(assessment.id)}"><div class="field full"><label>Link de referência</label><input name="referenceUrl" type="url" required placeholder="https://..." autocomplete="url"><span class="helper">Inclua vídeo, artigo, podcast, documento ou outro conteúdo externo relacionado à avaliação.</span></div></form>${refs.length?`<div class="reference-manager-list"><h3>Referências cadastradas</h3>${refs.map((url,index)=>`<div><span>${icon('link',16)}</span><a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(safeReferenceHost(url))}</a>${(state.libraryReferences?.[assessment.id]||[]).includes(url)?`<button class="mini-icon-btn" data-action="remove-assessment-reference" data-id="${assessment.id}" data-url="${escapeHtml(url)}" title="Remover referência">${icon('trash',14)}</button>`:''}</div>`).join('')}</div>`:''}`;
    modalShell('Referências da avaliação',assessment.title,body,`<button class="btn btn-secondary" data-action="close-modal">Fechar</button><button class="btn btn-primary" data-action="save-assessment-reference" data-id="${assessment.id}">${icon('plus')} Adicionar referência</button>`,'wide');
  }
  function saveAssessmentReference(assessmentId){
    const form=document.getElementById('assessment-reference-form');if(!form?.reportValidity())return;
    const url=String(new FormData(form).get('referenceUrl')||'').trim();
    try{new URL(url);}catch(_){return toast('Informe um link completo e válido.','error');}
    state.libraryReferences=state.libraryReferences||{};const list=Array.isArray(state.libraryReferences[assessmentId])?state.libraryReferences[assessmentId]:[];
    if(!list.includes(url))list.push(url);state.libraryReferences[assessmentId]=list;saveState();state.modal={type:'assessmentReference',assessmentId};renderModal();renderPageOnly();toast('Referência adicionada à avaliação.');
  }
  function removeAssessmentReference(assessmentId,url){
    state.libraryReferences=state.libraryReferences||{};state.libraryReferences[assessmentId]=(state.libraryReferences[assessmentId]||[]).filter(item=>item!==url);saveState();state.modal={type:'assessmentReference',assessmentId};renderModal();renderPageOnly();toast('Referência removida.');
  }

  function renderAssessmentCard(a) {
    const custom=isCustomAssessment(a);
    const open=a.template==='temperaments'||custom;
    const refs=assessmentReferenceItems(a);
    const referencePreview=refs.length?`<div class="assessment-reference-links">${refs.slice(0,2).map(url=>`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer" title="${escapeHtml(url)}">${icon('link',13)}<span>${escapeHtml(safeReferenceHost(url))}</span></a>`).join('')}${refs.length>2?`<small>+${refs.length-2} referência(s)</small>`:''}</div>`:`<div class="assessment-reference-empty">${icon('link',14)} <span>Nenhuma referência adicionada</span></div>`;
    return `<article class="assessment-card"><div class="assessment-top"><span class="assessment-icon">${icon(a.template==='temperaments'?'brain':custom?'form':'file')}</span><span class="access-pill ${open?'access-open':'access-review'}">${custom?'Customizado':escapeHtml(a.access)}</span></div><h3>${escapeHtml(a.title)}</h3><p>${escapeHtml(a.description)}</p><div class="form-template-meta"><span class="mini-tag">${a.duration||12} min</span><span class="mini-tag">${escapeHtml(a.category)}</span><span class="reference-count">${icon('book',13)} ${refs.length} referência(s)</span></div><section class="assessment-reference-box"><div class="assessment-reference-head"><strong>Referências e mídia</strong><button class="btn btn-ghost btn-sm" data-action="open-assessment-reference" data-id="${a.id}">${icon('plus',13)} Adicionar link</button></div>${referencePreview}</section><div class="assessment-meta"><small>${custom?`${(a.questions||[]).length} tópicos · ${a.status==='draft'?'Rascunho':'Ativo'}`:escapeHtml(a.source||'Modelo estruturado')}</small><div style="display:flex;gap:7px;flex-wrap:wrap;justify-content:flex-end">${custom?`<button class="mini-icon-btn" data-action="edit-custom-form" data-id="${a.id}" title="Editar formulário">${icon('edit')}</button><button class="mini-icon-btn" data-action="delete-custom-form" data-id="${a.id}" title="Excluir formulário">${icon('trash')}</button>`:`<button class="mini-icon-btn" data-action="duplicate-base-form" data-id="${a.id}" title="Duplicar e personalizar">${icon('duplicate')}</button>`}<button class="btn btn-secondary btn-sm" data-action="open-assessment" data-id="${a.id}">Abrir formulário</button></div></div></article>`;
  }

  function renderFormStudioPage() {
    const query=(state.formSearch||'').trim().toLowerCase();
    const custom=(state.customForms||[]).filter(f=>!query||`${f.title} ${f.category} ${f.description} ${(f.references||[]).join(' ')}`.toLowerCase().includes(query));
    const base=assessmentCatalog.filter(a=>!query||`${a.title} ${a.category} ${a.description}`.toLowerCase().includes(query)).slice(0,8);
    return `<div class="page-head"><div><h1>Studio de formulários</h1><p>Crie, organize, edite e evolua formulários interativos com referências bibliográficas e diferentes tipos de questão.</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="nav" data-nav="library">${icon('library')} Ver biblioteca</button><button class="btn btn-primary" data-action="open-form-builder">${icon('plus')} Novo formulário</button></div></div>
      <div class="toolbar"><div class="filter-chips"><span class="chip active">${custom.length} customizado(s)</span><span class="chip">${assessmentCatalog.length} modelos base</span></div><div class="search" style="width:min(380px,100%)">${icon('search')}<input id="form-search" placeholder="Buscar formulário ou referência..." value="${escapeHtml(state.formSearch||'')}"></div></div>
      <section class="form-studio-grid">
        <div>
          <div class="card-head" style="padding:0 0 14px;border:0"><div><h2>Formulários customizados</h2><p>Itens editáveis, versionáveis e disponíveis na biblioteca.</p></div></div>
          ${custom.length?`<div class="form-template-grid">${custom.map(renderFormTemplateCard).join('')}</div>`:emptyState('form','Nenhum formulário customizado','Crie o primeiro formulário ou duplique um modelo da biblioteca.')}
        </div>
        <aside class="card"><div class="card-head"><div><h2>Começar com um modelo</h2><p>Duplique e adapte um formulário existente.</p></div></div><div class="card-body"><div class="list">${base.map(a=>`<div class="list-item"><span class="list-icon">${icon(a.template==='temperaments'?'brain':'file',17)}</span><div><strong>${escapeHtml(a.title)}</strong><p>${escapeHtml(a.category)}</p><button class="btn btn-ghost btn-sm" data-action="duplicate-base-form" data-id="${a.id}">Duplicar e editar</button></div></div>`).join('')}</div></div></aside>
      </section>`;
  }

  function renderFormTemplateCard(f) {
    const refs=(f.references||[]).length;
    return `<article class="form-template-card"><div class="form-template-head"><span class="assessment-icon">${icon('form')}</span><span class="form-status ${f.status==='draft'?'draft':''}">${f.status==='draft'?'Rascunho':'Ativo'}</span></div><h3>${escapeHtml(f.title)}</h3><p>${escapeHtml(f.description||'Formulário customizado pela equipe.')}</p><div class="form-template-meta"><span class="mini-tag">${escapeHtml(f.category||'Customizado')}</span><span class="mini-tag">${(f.questions||[]).length} tópicos</span><span class="reference-count">${icon('book',13)} ${refs} referência(s)</span></div><div class="form-template-actions"><button class="btn btn-secondary btn-sm" data-action="open-assessment" data-id="${f.id}">${icon('preview')} Visualizar</button><button class="btn btn-secondary btn-sm" data-action="edit-custom-form" data-id="${f.id}">${icon('edit')} Editar</button><button class="mini-icon-btn" data-action="duplicate-custom-form" data-id="${f.id}" title="Duplicar">${icon('duplicate')}</button><button class="mini-icon-btn" data-action="delete-custom-form" data-id="${f.id}" title="Excluir">${icon('trash')}</button></div></article>`;
  }

  const commonAssessmentQuestionSpecs = [
    ['Qual é o principal motivo para responder esta avaliação neste momento?','longText'],
    ['Quando você percebeu pela primeira vez mudanças relacionadas a {tema}?','shortText'],
    ['Com que frequência os aspectos investigados aparecem atualmente?','singleChoice',['Nunca','Raramente','Algumas vezes','Frequentemente','Quase sempre']],
    ['Qual é a intensidade média percebida nos últimos 14 dias?','scale',[],0,10,'Nenhuma','Muito intensa'],
    ['Em quais contextos os sinais ficam mais evidentes?','multipleChoice',['Casa','Trabalho','Estudos','Relacionamentos','Situações sociais','Momentos de descanso']],
    ['Quais situações tendem a piorar ou desencadear as dificuldades?','longText'],
    ['Quais recursos, estratégias ou apoios costumam ajudar?','longText'],
    ['Você já buscou apoio profissional ou utilizou alguma intervenção para essa demanda?','yesNo']
  ];
  const professionalQuestionPacks = {
    clinical:[
      ['Como você descreve seu estado emocional predominante nas últimas duas semanas?','longText'],['Quanto a demanda interfere em sua rotina diária?','scale',[],0,10,'Sem interferência','Interferência máxima'],['Houve mudanças recentes no sono, apetite ou energia?','multipleChoice',['Sono','Apetite','Energia','Concentração','Nenhuma mudança']],['Quais pensamentos aparecem com maior frequência quando a dificuldade ocorre?','longText'],['Como você costuma reagir comportamentalmente nesses momentos?','longText'],['Existe algum padrão de evitação, adiamento ou isolamento?','yesNo'],['Quais relações foram mais afetadas?','longText'],['Como está sua capacidade de cumprir responsabilidades?','singleChoice',['Preservada','Levemente afetada','Moderadamente afetada','Muito afetada']],['Quais acontecimentos recentes podem estar associados ao quadro atual?','longText'],['Há sintomas físicos associados?','multipleChoice',['Tensão','Dor','Palpitação','Fadiga','Alteração gastrointestinal','Nenhum']],['Como você avalia sua percepção de controle sobre a situação?','scale',[],0,10,'Sem controle','Controle elevado'],['Quais são suas principais preocupações neste momento?','longText'],['Que mudanças você gostaria de perceber primeiro?','longText'],['Quais pessoas compõem sua rede de apoio?','longText'],['Existe alguma informação clínica relevante que ainda não foi abordada?','longText'],['Como você avalia sua motivação para o acompanhamento?','scale',[],0,10,'Muito baixa','Muito alta'],['Que barreiras podem dificultar a continuidade do cuidado?','longText']
    ],
    treatment:[
      ['Quais objetivos terapêuticos são prioritários para você?','longText'],['Qual mudança seria mais significativa nas próximas quatro semanas?','longText'],['Como você avaliará que o tratamento está funcionando?','longText'],['Qual é sua disponibilidade para realizar atividades entre sessões?','singleChoice',['Baixa','Moderada','Boa','Muito boa']],['Quais estratégias já foram tentadas?','longText'],['O que funcionou parcialmente no passado?','longText'],['Quais obstáculos internos podem dificultar o plano?','longText'],['Quais obstáculos externos podem dificultar o plano?','longText'],['Que apoio da família ou rede seria útil?','longText'],['Qual meta pode ser traduzida em comportamento observável?','longText'],['Qual frequência de acompanhamento parece viável?','singleChoice',['Semanal','Quinzenal','Mensal','A definir']],['Como está sua confiança em alcançar as metas?','scale',[],0,10,'Sem confiança','Confiança elevada'],['Quais sinais indicariam necessidade de ajustar o plano?','longText'],['Que práticas de autocuidado podem ser incorporadas?','multipleChoice',['Sono','Atividade física','Organização da rotina','Conexão social','Relaxamento','Outra']],['Que riscos precisam ser monitorados durante o processo?','longText'],['Qual responsabilidade você assume no plano de cuidado?','longText'],['Qual compromisso concreto pode ser iniciado nesta semana?','longText']
    ],
    followup:[
      ['Qual foi a mudança mais importante desde a última avaliação?','longText'],['Quais sintomas melhoraram?','longText'],['Quais sintomas permaneceram estáveis?','longText'],['Quais sintomas pioraram?','longText'],['Como está a adesão às recomendações combinadas?','singleChoice',['Não iniciada','Parcial','Adequada','Excelente']],['Que estratégia foi mais útil?','longText'],['Que estratégia não trouxe o resultado esperado?','longText'],['Houve alguma intercorrência relevante?','yesNo'],['Como está o funcionamento no trabalho ou estudo?','scale',[],0,10,'Muito prejudicado','Muito satisfatório'],['Como estão os relacionamentos e a convivência?','scale',[],0,10,'Muito difíceis','Muito satisfatórios'],['Como está o sono atualmente?','singleChoice',['Muito ruim','Ruim','Regular','Bom','Muito bom']],['Como está a energia ao longo do dia?','singleChoice',['Muito baixa','Baixa','Moderada','Boa','Muito boa']],['Como está a capacidade de regular emoções?','scale',[],0,10,'Muito difícil','Muito adequada'],['Quais metas foram alcançadas?','longText'],['Quais metas precisam ser reformuladas?','longText'],['Que novo foco deve ser priorizado?','longText'],['Há necessidade de outro encaminhamento ou avaliação complementar?','longText']
    ],
    risk:[
      ['Você teve pensamentos de não querer estar vivo(a) recentemente?','singleChoice',['Não','Ocasionalmente','Frequentemente','Prefiro conversar com o profissional']],['Você teve pensamentos de se machucar?','singleChoice',['Não','Sem intenção','Com intenção','Prefiro conversar com o profissional']],['Existe plano, acesso a meios ou preparação relacionada a esses pensamentos?','singleChoice',['Não','Não tenho certeza','Sim','Prefiro conversar com o profissional']],['Houve tentativa ou comportamento autolesivo anterior?','yesNo'],['Quando ocorreu o episódio mais recente de maior risco?','shortText'],['Quais situações aumentam o risco?','longText'],['Quais sinais de alerta costumam aparecer antes de uma crise?','longText'],['Quais razões, vínculos ou projetos ajudam você a permanecer seguro(a)?','longText'],['Quem pode ser contatado em uma situação de crise?','longText'],['Você possui acesso imediato a apoio profissional ou serviço de urgência?','yesNo'],['Há consumo de álcool ou outras substâncias associado ao risco?','yesNo'],['Há impulsividade intensa ou perda de controle recente?','singleChoice',['Não','Leve','Moderada','Intensa']],['Você está sozinho(a) neste momento?','yesNo'],['Quão seguro(a) você se sente nas próximas 24 horas?','scale',[],0,10,'Nada seguro(a)','Totalmente seguro(a)'],['Que medidas podem tornar o ambiente mais seguro?','longText'],['Existe alguém autorizado a participar do plano de segurança?','longText'],['Que estratégias de enfrentamento podem ser usadas antes de buscar ajuda?','longText'],['Qual serviço de referência deve constar no plano de segurança?','longText'],['Há risco de violência contra outra pessoa?','singleChoice',['Não','Pensamentos sem intenção','Risco possível','Risco imediato']],['Qual é a prioridade de cuidado neste momento?','longText'],['Observações profissionais para avaliação imediata.','longText'],['Fatores de proteção identificados.','longText']
    ],
    trauma:[
      ['Qual evento ou sequência de eventos motivou esta avaliação?','longText'],['Quando ocorreu e qual era o contexto?','longText'],['Existem lembranças intrusivas, pesadelos ou flashbacks?','singleChoice',['Não','Raramente','Às vezes','Frequentemente','Quase sempre']],['Há evitação de pessoas, lugares, pensamentos ou conversas?','yesNo'],['Você percebe hipervigilância ou sensação constante de ameaça?','scale',[],0,10,'Ausente','Muito intensa'],['Há reações físicas diante de gatilhos?','longText'],['Quais gatilhos são mais frequentes?','longText'],['Houve alterações na confiança, culpa ou percepção de si?','longText'],['Como o evento afetou relacionamentos?','longText'],['Como o evento afetou trabalho, estudo ou rotina?','longText'],['Há episódios de desligamento, desrealização ou despersonalização?','yesNo'],['Quais recursos ajudam na estabilização?','multipleChoice',['Respiração','Contato com pessoas seguras','Movimento corporal','Rotina','Espiritualidade','Outro']],['Você se sente seguro(a) no ambiente atual?','scale',[],0,10,'Nada seguro(a)','Totalmente seguro(a)'],['Existe risco atual relacionado ao agressor ou situação?','yesNo'],['Quais limites são importantes durante o acompanhamento?','longText'],['Que temas ainda não se sente pronto(a) para abordar?','longText'],['Quais fatores de proteção estão disponíveis?','longText'],['Qual ritmo de trabalho terapêutico parece tolerável?','longText'],['Há necessidade de encaminhamento médico, jurídico ou social?','longText'],['Observações sobre janela de tolerância emocional.','longText']
    ],
    substance:[
      ['Qual substância ou comportamento de uso está sendo avaliado?','longText'],['Com que frequência ocorre o uso?','singleChoice',['Menos de uma vez por mês','Mensalmente','Semanalmente','Várias vezes por semana','Diariamente']],['Qual quantidade costuma ser utilizada?','shortText'],['Em quais contextos o uso ocorre?','multipleChoice',['Sozinho(a)','Eventos sociais','Após estresse','Antes de dormir','Durante trabalho/estudo','Outro']],['O uso aumentou ao longo do tempo?','yesNo'],['Há dificuldade para reduzir ou interromper?','yesNo'],['Houve sintomas de abstinência ou forte desejo?','yesNo'],['Quais consequências físicas foram percebidas?','longText'],['Quais consequências emocionais foram percebidas?','longText'],['Quais consequências familiares, sociais ou profissionais ocorreram?','longText'],['Já houve comportamento de risco associado ao uso?','longText'],['O uso ocorre para aliviar emoções ou sintomas?','longText'],['Quais tentativas de mudança já foram realizadas?','longText'],['Qual é o nível atual de motivação para mudança?','scale',[],0,10,'Nenhuma','Muito alta'],['Quais benefícios percebidos mantêm o uso?','longText'],['Quais custos percebidos favorecem a mudança?','longText'],['Existe apoio familiar ou comunitário?','longText'],['Há necessidade de avaliação médica ou psiquiátrica?','yesNo'],['Quais situações representam maior risco de recaída?','longText'],['Que plano inicial de redução de danos pode ser considerado?','longText']
    ],
    emotional:[
      ['Qual emoção tem sido mais difícil de manejar?','longText'],['Quais emoções aparecem com maior frequência?','multipleChoice',['Ansiedade','Tristeza','Raiva','Medo','Culpa','Vergonha','Irritação','Outra']],['Com que rapidez a emoção aumenta de intensidade?','singleChoice',['Lentamente','Gradualmente','Rapidamente','De forma súbita']],['Quanto tempo costuma durar?','shortText'],['Quais pensamentos acompanham essa emoção?','longText'],['Quais sensações corporais aparecem?','longText'],['Como você costuma expressar ou esconder o que sente?','longText'],['Há comportamentos impulsivos durante picos emocionais?','yesNo'],['Você consegue identificar a necessidade associada à emoção?','scale',[],0,10,'Raramente','Quase sempre'],['Quais estratégias de regulação você utiliza?','multipleChoice',['Respiração','Pausa','Conversar','Escrever','Atividade física','Distração','Evitação']],['Quais estratégias ajudam de fato?','longText'],['Quais estratégias trazem consequências negativas?','longText'],['Como as emoções afetam suas decisões?','longText'],['Como afetam seus relacionamentos?','longText'],['Como afetam sono, apetite ou energia?','longText'],['Você consegue pedir ajuda quando necessário?','yesNo'],['Como avalia sua autocompaixão?','scale',[],0,10,'Muito baixa','Muito alta'],['Que habilidade emocional gostaria de desenvolver?','longText']
    ],
    wellbeing:[
      ['Como você avalia sua satisfação geral com a vida?','scale',[],0,10,'Muito baixa','Muito alta'],['Quanto sentido e propósito percebe em sua rotina?','scale',[],0,10,'Nenhum','Muito elevado'],['Como está seu equilíbrio entre demandas e recuperação?','scale',[],0,10,'Muito desequilibrado','Muito equilibrado'],['Como está a qualidade do sono?','singleChoice',['Muito ruim','Ruim','Regular','Boa','Excelente']],['Como está sua energia física?','singleChoice',['Muito baixa','Baixa','Moderada','Boa','Muito boa']],['Como está sua conexão com pessoas importantes?','scale',[],0,10,'Muito baixa','Muito alta'],['Você possui atividades que geram prazer ou interesse?','yesNo'],['Com que frequência consegue descansar sem culpa?','singleChoice',['Nunca','Raramente','Às vezes','Frequentemente','Sempre']],['Como avalia sua autonomia nas decisões?','scale',[],0,10,'Muito baixa','Muito alta'],['Como está sua percepção de competência?','scale',[],0,10,'Muito baixa','Muito alta'],['Quais áreas da vida estão mais satisfatórias?','multipleChoice',['Saúde','Família','Relacionamentos','Trabalho','Estudos','Lazer','Espiritualidade']],['Quais áreas necessitam de maior cuidado?','multipleChoice',['Saúde','Família','Relacionamentos','Trabalho','Estudos','Lazer','Espiritualidade']],['Quais hábitos protegem seu bem-estar?','longText'],['Quais hábitos prejudicam seu bem-estar?','longText'],['Quanto espaço existe para lazer e criatividade?','longText'],['Como você reage a imprevistos?','longText'],['Que mudança simples elevaria seu bem-estar?','longText']
    ],
    health:[
      ['Quais condições de saúde são relevantes para esta avaliação?','longText'],['Quais medicamentos ou tratamentos estão em uso?','longText'],['Houve mudança recente na saúde física?','yesNo'],['Como está a qualidade do sono?','singleChoice',['Muito ruim','Ruim','Regular','Boa','Excelente']],['Como está o nível de dor ou desconforto?','scale',[],0,10,'Sem dor','Dor intensa'],['Como está a energia ao longo do dia?','scale',[],0,10,'Muito baixa','Muito alta'],['Há limitações nas atividades diárias?','longText'],['Como os sintomas físicos afetam o humor?','longText'],['Como o estado emocional afeta os sintomas físicos?','longText'],['Há acompanhamento médico regular?','yesNo'],['Os exames e orientações médicas estão atualizados?','yesNo'],['Como está a adesão ao tratamento?','singleChoice',['Baixa','Parcial','Adequada','Excelente']],['Quais barreiras dificultam o cuidado?','longText'],['Há hábitos de alimentação, movimento ou sono a considerar?','longText'],['Existe medo, preocupação ou evitação relacionada à saúde?','longText'],['Como a condição afeta relações e trabalho?','longText'],['Quais recursos ajudam no manejo?','longText'],['Que encaminhamento complementar pode ser necessário?','longText']
    ],
    cognitive:[
      ['Qual função cognitiva causa maior preocupação?','multipleChoice',['Atenção','Memória','Planejamento','Linguagem','Percepção','Velocidade de processamento','Coordenação']],['Quando a dificuldade começou?','shortText'],['O início foi súbito ou gradual?','singleChoice',['Súbito','Gradual','Não sabe informar']],['A dificuldade varia ao longo do dia?','yesNo'],['Quais tarefas exigem mais esforço atualmente?','longText'],['Há esquecimentos de compromissos ou informações recentes?','yesNo'],['Há dificuldade para manter o foco?','scale',[],0,10,'Nenhuma','Muito intensa'],['Há dificuldade para alternar entre tarefas?','scale',[],0,10,'Nenhuma','Muito intensa'],['Como está a organização de rotinas e materiais?','longText'],['Há dificuldade para iniciar ou concluir tarefas?','longText'],['Como está a compreensão de instruções?','singleChoice',['Preservada','Levemente afetada','Moderadamente afetada','Muito afetada']],['Há dificuldade para encontrar palavras ou se expressar?','yesNo'],['Há alterações visuoespaciais ou de orientação?','yesNo'],['Há lentificação ou impulsividade nas respostas?','longText'],['Quais estratégias compensatórias já utiliza?','longText'],['Como a dificuldade afeta autonomia?','longText'],['Há histórico neurológico, médico ou familiar relevante?','longText'],['Quais fatores podem interferir no desempenho, como sono, ansiedade ou medicação?','longText'],['Qual avaliação complementar pode ser necessária?','longText'],['Observações sobre validade e condições de aplicação.','longText']
    ],
    personality:[
      ['Como você descreve seus traços mais marcantes?','longText'],['Como costuma reagir a críticas?','longText'],['Como toma decisões importantes?','longText'],['Como lida com frustração e limites?','longText'],['Como costuma iniciar e manter relacionamentos?','longText'],['Quanto precisa de aprovação externa?','scale',[],0,10,'Muito pouco','Muito'],['Como lida com intimidade e confiança?','longText'],['Como reage a mudanças inesperadas?','longText'],['Como organiza responsabilidades e compromissos?','longText'],['Há tendência a impulsividade?','scale',[],0,10,'Muito baixa','Muito alta'],['Há tendência a rigidez ou perfeccionismo?','scale',[],0,10,'Muito baixa','Muito alta'],['Como expressa necessidades e limites?','longText'],['Como se percebe em situações de conflito?','longText'],['Quais valores orientam suas escolhas?','longText'],['Quais padrões se repetem em diferentes contextos?','longText'],['Quais são seus principais recursos pessoais?','longText'],['Quais vulnerabilidades deseja compreender melhor?','longText'],['Que mudança de padrão seria mais importante?','longText']
    ],
    behavior:[
      ['Qual comportamento específico está sendo analisado?','longText'],['Como o comportamento pode ser observado e descrito?','longText'],['Com que frequência ocorre?','shortText'],['Qual é a duração média?','shortText'],['Qual é a intensidade típica?','scale',[],0,10,'Baixa','Muito alta'],['Quais antecedentes costumam ocorrer imediatamente antes?','longText'],['Quais pensamentos aparecem antes do comportamento?','longText'],['Quais emoções aparecem antes do comportamento?','longText'],['Quais consequências imediatas ocorrem depois?','longText'],['Quais consequências de longo prazo ocorrem?','longText'],['Em quais ambientes ocorre mais?','multipleChoice',['Casa','Trabalho','Escola','Ambiente social','Online','Outro']],['Com quais pessoas ocorre mais?','longText'],['O que costuma interromper ou reduzir o comportamento?','longText'],['Existe reforço ou ganho associado?','longText'],['Existe função de fuga, atenção, acesso ou autorregulação?','multipleChoice',['Fuga/evitação','Atenção','Acesso a algo','Autorregulação','Não identificado']],['Quais habilidades alternativas estão disponíveis?','longText'],['Que intervenção antecedente pode ajudar?','longText'],['Que consequência planejada pode favorecer mudança?','longText'],['Como o progresso será medido?','longText']
    ],
    relationships:[
      ['Como você avalia a qualidade dos vínculos mais importantes?','scale',[],0,10,'Muito baixa','Muito alta'],['Como ocorre a comunicação em situações difíceis?','longText'],['Você consegue expressar necessidades de forma clara?','yesNo'],['Você consegue ouvir sem interromper ou se defender imediatamente?','scale',[],0,10,'Raramente','Quase sempre'],['Como são definidos limites e acordos?','longText'],['Há conflitos recorrentes?','yesNo'],['Quais temas aparecem com maior frequência nos conflitos?','longText'],['Como ocorre a reparação após um conflito?','longText'],['Existe confiança e sensação de segurança?','scale',[],0,10,'Muito baixa','Muito alta'],['Há ciúme, controle ou invasão de privacidade?','longText'],['Como responsabilidades são distribuídas?','longText'],['Há apoio emocional disponível?','scale',[],0,10,'Muito baixo','Muito alto'],['Como o vínculo lida com diferenças individuais?','longText'],['Quais padrões familiares influenciam a relação atual?','longText'],['Que comportamentos fortalecem o vínculo?','longText'],['Que comportamentos enfraquecem o vínculo?','longText'],['Qual acordo concreto poderia melhorar a convivência?','longText'],['Há necessidade de orientação familiar, casal ou rede?','longText']
    ],
    development:[
      ['Como foi o período gestacional e neonatal?','longText'],['Houve intercorrências médicas precoces?','longText'],['Como ocorreram os marcos motores?','longText'],['Como ocorreu o desenvolvimento da linguagem?','longText'],['Como está a comunicação funcional atualmente?','longText'],['Como ocorre a interação social?','longText'],['Há sensibilidades sensoriais relevantes?','multipleChoice',['Som','Luz','Textura','Cheiro','Movimento','Não percebidas']],['Como ocorre a adaptação a mudanças de rotina?','longText'],['Como está a autonomia nas atividades diárias?','longText'],['Como está o brincar, interesse ou repertório de atividades?','longText'],['Há comportamentos repetitivos ou interesses restritos?','yesNo'],['Como está a regulação emocional?','longText'],['Como está o desempenho escolar ou acadêmico?','longText'],['Há dificuldades específicas de aprendizagem?','longText'],['Quais apoios e adaptações já foram utilizados?','longText'],['Como a família compreende as necessidades atuais?','longText'],['Quais profissionais já participaram do acompanhamento?','longText'],['Quais habilidades devem ser priorizadas?','longText'],['Que avaliação complementar é indicada?','longText'],['Observações sobre contexto cultural e oportunidades de aprendizagem.','longText']
    ],
    career:[
      ['Quais atividades despertam maior interesse?','longText'],['Quais atividades geram maior desmotivação?','longText'],['Quais competências você reconhece em si?','longText'],['Quais competências deseja desenvolver?','longText'],['Quais valores são essenciais no trabalho?','multipleChoice',['Autonomia','Estabilidade','Impacto social','Criatividade','Remuneração','Aprendizagem','Liderança']],['Que ambientes de trabalho favorecem seu desempenho?','longText'],['Que ambientes prejudicam seu desempenho?','longText'],['Como você lida com decisões de carreira?','longText'],['Quais experiências profissionais foram mais significativas?','longText'],['Quais experiências foram mais desgastantes?','longText'],['Quais barreiras práticas existem hoje?','longText'],['Quais barreiras emocionais existem hoje?','longText'],['Como está sua confiança profissional?','scale',[],0,10,'Muito baixa','Muito alta'],['Como está sua clareza sobre próximos passos?','scale',[],0,10,'Muito baixa','Muito alta'],['Que alternativas estão sendo consideradas?','longText'],['Que informações ainda precisam ser pesquisadas?','longText'],['Quem pode apoiar a decisão?','longText'],['Qual experimento de carreira pode ser realizado?','longText'],['Qual plano de ação para os próximos 90 dias?','longText']
    ],
    work:[
      ['Qual é sua função e escopo atual?','longText'],['Quais demandas são mais críticas?','longText'],['Quais recursos estão disponíveis?','longText'],['Como está a carga de trabalho percebida?','scale',[],0,10,'Muito baixa','Muito alta'],['Como está a autonomia para decidir?','scale',[],0,10,'Muito baixa','Muito alta'],['Como está a clareza de papéis e prioridades?','scale',[],0,10,'Muito baixa','Muito alta'],['Como está a relação com liderança?','longText'],['Como está a relação com a equipe?','longText'],['Como conflitos são gerenciados?','longText'],['Há reconhecimento adequado?','singleChoice',['Não','Parcialmente','Na maior parte','Sim']],['Há oportunidades de desenvolvimento?','singleChoice',['Não','Poucas','Adequadas','Muitas']],['Quais riscos psicossociais estão presentes?','multipleChoice',['Sobrecarga','Assédio','Baixa autonomia','Conflito de papel','Insegurança','Isolamento','Nenhum']],['Como está o equilíbrio trabalho-vida?','scale',[],0,10,'Muito ruim','Excelente'],['Há sinais de exaustão ou distanciamento?','longText'],['Quais processos precisam ser melhorados?','longText'],['Que apoio organizacional seria necessário?','longText'],['Que ação de liderança teria maior impacto?','longText'],['Como o resultado será acompanhado?','longText']
    ],
    psychosocial:[
      ['Como está a condição de moradia?','longText'],['Como está a situação de renda e trabalho?','longText'],['Há acesso regular a alimentação, transporte e saúde?','longText'],['Quais vulnerabilidades sociais estão presentes?','multipleChoice',['Violência','Desemprego','Insegurança alimentar','Moradia instável','Discriminação','Isolamento','Outra']],['Quais direitos ou serviços precisam ser acessados?','longText'],['Como está a rede familiar e comunitária?','longText'],['Há responsabilidades de cuidado com outras pessoas?','yesNo'],['Existem barreiras de acessibilidade?','longText'],['Há histórico de violência ou violação de direitos?','yesNo'],['Quais instituições já acompanham o caso?','longText'],['Há documentação ou benefício pendente?','longText'],['Como fatores culturais influenciam a demanda?','longText'],['Quais fatores de proteção comunitária existem?','longText'],['Qual é a urgência social percebida?','scale',[],0,10,'Baixa','Muito alta'],['Que encaminhamentos intersetoriais são necessários?','longText'],['Quais objetivos devem ser pactuados com a rede?','longText'],['Que riscos precisam de monitoramento contínuo?','longText'],['Como será realizado o acompanhamento do plano?','longText']
    ],
    forensic:[
      ['Qual é a demanda formal ou quesito da avaliação?','longText'],['Quem solicitou a avaliação e com qual finalidade?','longText'],['Quais documentos foram disponibilizados?','longText'],['Quais fontes de informação foram consultadas?','longText'],['Quais procedimentos foram realizados?','longText'],['Quais limites técnicos devem ser explicitados?','longText'],['Há conflito de interesse ou impedimento?','yesNo'],['Como a pessoa compreende a finalidade da avaliação?','longText'],['Quais fatos são relatados de forma consistente entre fontes?','longText'],['Quais divergências foram identificadas?','longText'],['Quais condições podem afetar a validade das informações?','longText'],['Há necessidade de informação complementar?','longText'],['Quais achados respondem diretamente ao quesito?','longText'],['Quais achados não permitem conclusão?','longText'],['Quais hipóteses alternativas foram consideradas?','longText'],['Que linguagem técnica e limites devem constar no documento?','longText'],['Quais recomendações são compatíveis com o escopo?','longText'],['Que cuidados éticos e de sigilo são necessários?','longText'],['Observações sobre cadeia de custódia documental.','longText'],['Síntese técnica preliminar.','longText']
    ],
    sports:[
      ['Qual modalidade e nível de prática?','shortText'],['Quais são os objetivos esportivos atuais?','longText'],['Como está a motivação para treinar?','scale',[],0,10,'Muito baixa','Muito alta'],['Como está a confiança em competição?','scale',[],0,10,'Muito baixa','Muito alta'],['Como reage à pressão por resultado?','longText'],['Como lida com erros durante a performance?','longText'],['Como está a concentração nos treinos?','scale',[],0,10,'Muito baixa','Muito alta'],['Como está a concentração em competição?','scale',[],0,10,'Muito baixa','Muito alta'],['Quais pensamentos aparecem antes da prova?','longText'],['Quais sensações físicas aparecem antes da prova?','longText'],['Há rotina pré-competitiva estruturada?','yesNo'],['Como está a qualidade do sono e recuperação?','longText'],['Como está a relação com treinador e equipe?','longText'],['Como lida com lesões ou afastamentos?','longText'],['Quais fatores externos afetam o desempenho?','longText'],['Como equilibra esporte, estudo, trabalho e vida pessoal?','longText'],['Quais estratégias mentais já utiliza?','multipleChoice',['Respiração','Visualização','Metas','Autofala','Rotina','Mindfulness','Nenhuma']],['Qual habilidade mental deve ser treinada primeiro?','longText'],['Como o progresso mental será acompanhado?','longText']
    ]
  };
  const assessmentPackByTemplate={triage:'clinical',clinical:'clinical',treatment:'treatment',followup:'followup',outcome:'followup',risk:'risk',trauma:'trauma',substance:'substance',symptoms:'emotional',emotional:'emotional',wellbeing:'wellbeing',health:'health',cognitive:'cognitive',attention:'cognitive',memory:'cognitive',executive:'cognitive',language:'cognitive',visuospatial:'cognitive',perception:'cognitive',motor:'cognitive',neuro:'cognitive',personality:'personality',motivation:'personality',behavior:'behavior',social:'relationships',adaptive:'relationships',relationships:'relationships',family:'relationships',development:'development',education:'development',career:'career',occupational:'work',leadership:'work',organizational:'work',psychosocial:'psychosocial',forensic:'forensic',sports:'sports'};
  function normalizeQuestionSpec(spec,a,index) {
    const [label,type='longText',options=[],min=0,max=10,minLabel='Mínimo',maxLabel='Máximo']=spec;
    return {id:`${a.id||'assessment'}-q${String(index+1).padStart(2,'0')}`,type,label:String(label).replaceAll('{tema}',String(a.title||'esta demanda').toLowerCase()),help:'',required:index<5,options:options||[],min,max,minLabel,maxLabel};
  }
  function schemaQuestions(a) {
    const schema=templateSchemas[a.template]||[];
    return schema.map(([label,type,options],index)=>({id:`${a.id||'assessment'}-base${index+1}`,type:type==='textarea'?'longText':type==='select'?'dropdown':type==='range'?'scale':'shortText',label,help:'',required:false,options:options||[],min:0,max:10,minLabel:'Mínimo',maxLabel:'Máximo'}));
  }
  function buildProfessionalQuestions(a) {
    if(a.template==='temperaments') return temperamentQuestions.map(q=>({id:`${a.id||'temperaments'}-q${q.n}`,type:q.n<49?'singleChoice':'multipleChoice',label:`${q.n}. ${q.text}`,help:q.n<49?'Considere sua inclinação natural.':'Selecione até duas alternativas.',required:false,options:q.n<49?['Sim','Não','Dúvida']:(q.n===49?['Obstinação, raiva, orgulho','Preguiça, falta de energia','Falta de coragem, evasão do sofrimento','Verborreia, falta de coerência']:['Bom caráter, tranquilo','Empatia, amor pela solidão e reflexão','Vontade firme, energia, audácia, ambição','Alegria e facilidade para lidar com pessoas difíceis'])}));
    const packName=assessmentPackByTemplate[a.template]||(/trabalho|lideran|organiz/i.test(`${a.title} ${a.category}`)?'work':/família|relacion|social/i.test(`${a.title} ${a.category}`)?'relationships':'clinical');
    const target=['risk','trauma','substance','cognitive','development','forensic'].includes(packName)?30:25;
    const specs=[...commonAssessmentQuestionSpecs,...(professionalQuestionPacks[packName]||professionalQuestionPacks.clinical)];
    const base=schemaQuestions(a);const seen=new Set(base.map(q=>q.label.toLowerCase().trim()));
    const generated=[];
    specs.forEach(spec=>{const q=normalizeQuestionSpec(spec,a,base.length+generated.length);const key=q.label.toLowerCase().trim();if(!seen.has(key)){seen.add(key);generated.push(q);}});
    const result=[...base,...generated];
    let extra=1;
    while(result.filter(q=>!['section','info'].includes(q.type)).length<target){result.push({id:`${a.id||'assessment'}-extra${extra}`,type:'longText',label:`${extra}. Registre uma observação complementar relevante para ${String(a.title||'esta avaliação').toLowerCase()}.`,help:'Inclua contexto, exemplos e impacto funcional quando possível.',required:false,options:[]});extra++;}
    return result.slice(0,target);
  }
  function ensureMinimumQuestionDepth(form) {
    if(!form) return form;
    const current=Array.isArray(form.questions)?structuredClone(form.questions):[];
    const count=current.filter(q=>!['section','info'].includes(q.type)).length;
    if(count>=25) return {...form,questions:current};
    const generated=buildProfessionalQuestions({...form,template:form.template==='custom'?'clinical':form.template});
    const seen=new Set(current.map(q=>String(q.label||q.title||'').toLowerCase().trim()));
    for(const q of generated){const key=String(q.label||'').toLowerCase().trim();if(!seen.has(key)){current.push({...q,id:q.id||uid('q')});seen.add(key);}if(current.filter(item=>!['section','info'].includes(item.type)).length>=25)break;}
    return {...form,questions:current,qualityStandard:'25-plus'};
  }
  function templateToQuestions(a) { return buildProfessionalQuestions(a); }

  function createFormDraft(base=null) {
    if(base?.custom) {
      const copy=structuredClone(base);
      copy.id=base.id;
      return copy;
    }
    if(base) return {id:'',custom:true,title:`Cópia de ${base.title}`,category:base.category,description:base.description,duration:base.duration||12,status:'draft',template:'custom',access:'Customizado',source:'Criado no Humanevo Studio',references:[...(base.references||[]),base.source?`Fonte do modelo: ${base.source}`:''].filter(Boolean),questions:templateToQuestions(base),createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()};
    return ensureMinimumQuestionDepth({id:'',custom:true,title:'Novo formulário',category:'Customizado',description:'Descreva o objetivo e o contexto de aplicação.',duration:20,status:'draft',template:'custom',access:'Customizado',source:'Criado no Humanevo Studio',references:[],questions:[],createdAt:new Date().toISOString(),updatedAt:new Date().toISOString()});
  }


function adminGroup(id, iconName, title, description, content, badge='', open=false) {
  return `<details class="admin-management-group" ${open||state.adminOpenGroup===id?'open':''} data-admin-group="${id}"><summary><span class="admin-group-icon">${icon(iconName)}</span><span class="admin-group-copy"><strong>${title}</strong><small>${description}</small></span>${badge?`<span class="mini-tag">${badge}</span>`:''}<span class="admin-group-chevron">${icon('chevronRight')}</span></summary><div class="admin-group-content">${content}</div></details>`;
}
function renderIdentityAdmin() {
  const c=state.customization;
  return `<article class="admin-list-panel"><div class="admin-list-section"><div class="admin-section-title"><h3>Marca e aparência</h3><p>Personalize a identidade sem sobrecarregar a tela principal.</p></div><div class="logo-uploader">${renderBrandMark('logo-drop-preview')}<div><strong>Logo atual</strong><span class="helper">PNG, JPG ou SVG. A imagem é otimizada, salva no Supabase e aplicada automaticamente a todos os perfis.</span><div class="inline-actions" style="margin-top:10px"><button class="btn btn-secondary btn-sm" data-action="trigger-logo-upload">${icon('upload')} Enviar logo</button>${c.logoData?`<button class="btn btn-secondary btn-sm" data-action="remove-logo">${icon('trash')} Remover</button>`:''}</div><input id="logo-upload" type="file" accept="image/*,.svg" hidden></div></div></div><div class="admin-list-section"><div class="form-grid"><div class="field"><label>Cor primária</label><input class="customization-control" data-custom-key="brand" type="color" value="${c.brand}"></div><div class="field"><label>Cor secundária</label><input class="customization-control" data-custom-key="brand2" type="color" value="${c.brand2}"></div><div class="field"><label>Fonte dos títulos</label><select class="customization-control" data-custom-key="titleFont">${titleFontOptions.map(([label,value])=>`<option value="${value}" ${c.titleFont===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="field"><label>Fonte dos textos</label><select class="customization-control" data-custom-key="bodyFont">${bodyFontOptions.map(([label,value])=>`<option value="${value}" ${c.bodyFont===value?'selected':''}>${label}</option>`).join('')}</select></div>${[['logoSize','Tamanho da logo',34,72,1,'px'],['logoRadius','Raio da logo',8,28,1,'px'],['cardRadius','Raio dos cards',14,30,1,'px'],['controlRadius','Raio dos controles',10,24,1,'px'],['sidebarWidth','Largura do menu',236,320,1,'px'],['shadowIntensity','Sombras',.6,1.8,.1,'x'],['uiScale','Escala da interface',.9,1.12,.01,'x']].map(([key,label,min,max,step,suffix])=>`<div class="field"><label>${label}</label><input class="customization-control" data-custom-key="${key}" data-value-type="number" type="range" min="${min}" max="${max}" step="${step}" value="${c[key]}"><output data-output-for="${key}">${c[key]}${suffix}</output></div>`).join('')}<div class="field full"><label class="toggle-control"><input class="customization-control" data-custom-key="animations" type="checkbox" ${c.animations?'checked':''}><span><strong>Animações e microinterações</strong><small>Movimentos sutis de botões, cards e navegação.</small></span></label></div></div></div><div class="admin-list-actions"><button class="btn btn-secondary" data-action="reset-customization">${icon('reset')} Restaurar identidade padrão</button></div></article>`;
}
function renderCloudAdmin() {
  const connected=cloudReady();
  return `<article class="admin-list-panel"><div class="cloud-connection-card ${connected?'connected':''}"><span class="cloud-connection-icon">${icon('cloud',26)}</span><div><strong>${connected?'Banco central conectado':'Conecte o banco central'}</strong><p>${connected?`${escapeHtml(cloudContext?.profile?.full_name||cloudContext?.user?.email||'Conta profissional')} · ${escapeHtml(cloudRole())}`:'Sincronize pacientes, formulários, respostas, notificações e evidências entre os perfis.'}</p></div><span class="connection-dot"></span></div><div class="inline-actions cloud-action-grid">${connected?`<button class="btn btn-primary" data-action="sync-cloud">${icon('reset')} Sincronizar agora</button><button class="btn btn-secondary" data-action="disconnect-cloud">Desconectar</button><a class="btn btn-secondary" href="/portal-paciente" target="_blank">${icon('user')} Abrir Portal do Paciente</a>`:`<button class="btn btn-primary" data-action="open-cloud-login">${icon('cloud')} Conectar conta profissional</button>`}<a class="btn btn-secondary" href="./supabase/HUMANEVO_SCHEMA_V3_4.sql" download>${icon('download')} Baixar estrutura do banco</a></div><div class="admin-callout"><strong>Fluxo implementado</strong><p>O psicólogo envia um formulário no cadastro do paciente; o paciente recebe uma notificação, responde no portal e a resposta retorna ao cockpit clínico para revisão.</p></div><div class="admin-callout security-callout"><strong>Governança de acesso</strong><p>Solicitações, aprovação, bloqueio e permissões ficam centralizados no Cockpit de liberação de acessos, disponível exclusivamente para Administradores.</p></div></article>`;
}
function renderCustomizationPage() {
  const c=state.customization;
  return `<div class="admin-page-head"><div><span class="admin-eyebrow">CENTRAL DE GOVERNANÇA</span><h1>Administração & Customização</h1><p>Ferramentas estruturais organizadas em agrupadores para reduzir poluição visual e facilitar a gestão.</p></div><div class="admin-head-stats"><span><strong>${state.accessProfiles.length}</strong> perfis</span><span><strong>${state.auditLogs.length}</strong> logs</span><span><strong>${cloudReady()?'ON':'OFF'}</strong> banco central</span></div></div><section class="admin-management-list">${currentRole()==='administrator'?adminGroup('accessCockpit','shield','Cockpit de liberação de acessos','Solicitações, permissões por perfil e exceções individuais.',renderAccessCockpitAdmin(),'Governança'):''}${adminGroup('identity','image','Identidade visual','Logo, cores, fontes, dimensões e animações.',renderIdentityAdmin(),'Aparência')}${adminGroup('cloud','cloud','Banco central & Portal do Paciente','Sincronização, formulários enviados, respostas e notificações.',renderCloudAdmin(),cloudReady()?'Conectado':'Pendente')}${adminGroup('backup','download','Backup e restauração XLSX','Contingência completa de todas as guias e módulos.',renderAdminBackupCard(),'XLSX')}${adminGroup('roleCatalog','settings','Composição dos perfis','Permissões e responsabilidades de cada modelo de acesso.',renderAccessRolesAdmin(),`${accessRoleTemplates.length} modelos`)}${adminGroup('userAccounts','users','Cadastro de usuários','Criação, edição, senha temporária e sincronização com o Supabase Authentication.',renderUserAccountsAdmin(),`${state.accessProfiles.length} contas`)}${adminGroup('audit','activity','Log de modificações','Rastreabilidade granular e rollback administrativo.',renderAuditAdmin(),`${state.modificationLogs.length} eventos`)}${adminGroup('integrations','link','Integrações','WhatsApp, agenda externa e serviços administrativos.',renderIntegrationsAdmin(),`${state.integrations.filter(i=>i.status==='active').length} ativas`)}</section>`;
}

function getAccessRole(roleId) {
  return accessRoleTemplates.find(role=>role.id===roleId) || accessRoleTemplates[0];
}

function backupStatusLabel(status='') { return ({completed:'Concluído',processing:'Processando',failed:'Falhou',restoring:'Restaurando',restored:'Restaurado'}[status]||status||'Pendente'); }
function formatBackupBytes(value=0){const bytes=Number(value)||0;if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(1)} KB`;if(bytes<1073741824)return `${(bytes/1048576).toFixed(1)} MB`;return `${(bytes/1073741824).toFixed(2)} GB`;}
function renderBackupTimeline(){
  if(currentRole()!=='administrator')return '<div class="admin-callout danger-callout"><strong>Acesso restrito</strong><p>Somente o Administrador pode consultar pontos de restauração.</p></div>';
  if(!cloudReady())return '<div class="admin-callout warning-callout"><strong>Banco central desconectado</strong><p>Conecte a conta administrativa para carregar a linha do tempo automática.</p></div>';
  if(backupTimelineLoading)return '<div class="backup-timeline-loading"><span class="spinner"></span><span>Carregando pontos de restauração...</span></div>';
  if(backupTimelineError)return `<div class="admin-callout danger-callout"><strong>Não foi possível carregar os backups</strong><p>${escapeHtml(backupTimelineError)}</p><button class="btn btn-secondary btn-sm" data-action="refresh-backup-timeline">Tentar novamente</button></div>`;
  if(!backupTimeline.length)return '<div class="backup-timeline-empty"><strong>Nenhum backup registrado</strong><span>Crie o primeiro ponto manual ou aguarde a rotina de segunda-feira.</span></div>';
  return `<div class="backup-timeline">${backupTimeline.map(item=>`<article class="backup-timeline-item status-${escapeHtml(item.status||'pending')}"><span class="backup-timeline-dot"></span><div class="backup-timeline-card"><header><div><strong>${escapeHtml(item.backup_name||'Backup')}</strong><small>${new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(item.created_at))} · ${item.source==='scheduled'?'Automático':'Manual'}</small></div><span class="backup-status">${escapeHtml(backupStatusLabel(item.status))}</span></header><div class="backup-meta"><span>${icon('database',15)} ${Number(item.record_count)||0} registros</span><span>${icon('paperclip',15)} ${Number(item.file_count)||0} arquivos</span><span>${icon('download',15)} ${formatBackupBytes(item.size_bytes)}</span></div>${item.error_message?`<p class="backup-error">${escapeHtml(item.error_message)}</p>`:''}<footer><button class="btn btn-secondary btn-sm" data-action="download-cloud-backup" data-id="${item.id}" ${!['completed','restored'].includes(item.status)?'disabled':''}>${icon('download',14)} Baixar JSON</button><button class="btn btn-primary btn-sm" data-action="open-restore-backup" data-id="${item.id}" ${!['completed','restored'].includes(item.status)?'disabled':''}>${icon('reset',14)} Restaurar</button></footer></div></article>`).join('')}</div>`;
}
function renderAdminBackupCard() {
  const backupStats=[['Pacientes',state.patients.length],['Agendamentos',state.appointments.length],['Avaliações',state.assessmentRecords.length],['Formulários',state.customForms.length],['Perfis',state.accessProfiles.length]];
  const serverReady=currentRole()==='administrator'&&cloudReady();
  return `<article class="card customization-card backup-control-card"><div class="card-head"><div><h2>Governança, backup e restauração</h2><p>Contingência manual em XLSX e pontos completos do banco e arquivos no servidor.</p></div><span class="mini-tag">Segundas · 14h</span></div><div class="card-body"><div class="admin-stat-grid">${backupStats.map(([label,value])=>`<div class="admin-stat-pill"><strong>${value}</strong><span>${label}</span></div>`).join('')}</div><div class="backup-method-grid"><section class="backup-method-card"><span class="backup-method-icon">${icon('file',22)}</span><div><strong>Backup manual XLSX</strong><p>Gera um arquivo validado com todas as abas do sistema e conteúdo técnico para restauração local.</p></div><div class="inline-actions"><button type="button" class="btn btn-primary" data-action="export-system-xlsx">${icon('download')} Exportar XLSX</button><button type="button" class="btn btn-secondary" data-action="trigger-import-system-xlsx">${icon('upload')} Importar XLSX</button><input id="admin-import-xlsx" type="file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden></div></section><section class="backup-method-card"><span class="backup-method-icon">${icon('cloud',22)}</span><div><strong>Imagem completa do servidor</strong><p>Inclui banco de dados e arquivos. A rotina automática ocorre toda segunda-feira às 14h no horário de Cuiabá.</p>${!serverReady?'<small class="backup-connection-note">Conecte uma conta Administrador ao banco central para habilitar os pontos do servidor.</small>':''}</div><div class="inline-actions"><button type="button" class="btn btn-primary" data-action="create-cloud-backup" ${serverReady?'':'disabled'}>${icon('plus')} Criar ponto agora</button><button type="button" class="btn btn-secondary" data-action="refresh-backup-timeline" ${serverReady?'':'disabled'}>${icon('reset')} Atualizar</button></div></section></div><section class="backup-timeline-section"><div class="backup-timeline-head"><div><h3>Linha do tempo de restauração</h3><p>Visualização, download e restauração exclusivos do Administrador.</p></div></div><div id="backup-timeline-region" class="backup-timeline-region" aria-live="polite">${renderBackupTimeline()}</div></section><p class="helper backup-warning-text">A restauração substitui os dados atuais pelo ponto selecionado e exige confirmação explícita.</p></div></article>`;
}

function updateBackupTimelineRegion(){
  const region=document.getElementById('backup-timeline-region');
  if(region) region.innerHTML=renderBackupTimeline();
}
async function loadBackupTimeline(showToast=false){
  if(currentRole()!=='administrator'||!cloudReady())return;
  if(backupTimelineLoading)return;
  backupTimelineLoading=true;
  backupTimelineError='';
  updateBackupTimelineRegion();
  try{
    const result=await cloud.listBackups();
    backupTimeline=Array.isArray(result?.backups)?result.backups:[];
    if(showToast)toast('Linha do tempo atualizada.');
  }
  catch(error){
    backupTimelineError=String(error?.message||'Falha de comunicação com o serviço de backup.');
    if(showToast)toast(`Não foi possível carregar os backups: ${backupTimelineError}`,'error');
  }
  finally{
    backupTimelineLoading=false;
    updateBackupTimelineRegion();
  }
}
async function createCloudBackup(){
  if(currentRole()!=='administrator')return toast('Somente o Administrador pode criar backups.','error');
  if(!cloudReady())return toast('Conecte o banco central com uma conta administrativa.','error');
  try{toast('Gerando o ponto de restauração...');await cloud.createBackup();await loadBackupTimeline(false);toast('Backup completo criado com sucesso.');}
  catch(error){toast(`Falha ao criar backup: ${error.message}`,'error');}
}
async function downloadCloudBackup(id){
  if(currentRole()!=='administrator')return toast('Somente o Administrador pode baixar backups.','error');
  try{const result=await cloud.downloadBackup(id);downloadBlob(result.blob,result.filename||'Backup_Humanevo.json');toast('Arquivo técnico do backup baixado.');}
  catch(error){toast(`Falha ao baixar backup: ${error.message}`,'error');}
}
function renderRestoreBackupModal(backupId){
  const backup=backupTimeline.find(item=>String(item.id)===String(backupId));if(!backup)return closeModal();
  const body=`<div class="admin-callout danger-callout"><strong>Restauração integral</strong><p>Todos os dados atuais da clínica serão substituídos pelo conteúdo de <b>${escapeHtml(backup.backup_name)}</b>, criado em ${new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short'}).format(new Date(backup.created_at))}.</p></div><form id="restore-backup-form" class="form-grid"><input type="hidden" name="backupId" value="${backup.id}"><div class="field full"><label>Digite RESTAURAR para confirmar</label><input name="confirmation" autocomplete="off" required placeholder="RESTAURAR"></div></form>`;
  modalShell('Restaurar ponto do sistema','Ação exclusiva do Administrador e potencialmente irreversível.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-restore-backup">${icon('reset')} Restaurar sistema</button>`,'wide');
}
async function restoreCloudBackup(){
  const form=document.getElementById('restore-backup-form');if(!form?.reportValidity())return;const fd=new FormData(form);if(String(fd.get('confirmation')||'').trim().toUpperCase()!=='RESTAURAR')return toast('Digite RESTAURAR para confirmar.','error');
  if(currentRole()!=='administrator')return toast('Somente o Administrador pode restaurar backups.','error');
  try{const id=String(fd.get('backupId')||'');await cloud.restoreBackup(id);state.modal=null;modalRoot.innerHTML='';await syncCloudData(false);await loadBackupTimeline(false);toast('Sistema restaurado a partir do ponto selecionado.');}
  catch(error){toast(`Falha na restauração: ${error.message}`,'error');}
}

function renderAccessRolesAdmin() {
  const roleAccordion=accessRoleTemplates.map(role=>`<details class="access-role-accordion" style="--role-accent:${role.color}"><summary><span class="role-summary-icon">${icon(role.id==='administrator'?'settings':role.id==='psychologist'?'users':role.id==='intake_manager'?'calendar':'user')}</span><span class="role-summary-copy"><strong>${role.label}</strong><small>${role.summary}</small></span><span class="role-summary-badge">${role.badge}</span><span class="role-summary-chevron">${icon('chevronRight',17)}</span></summary><div class="access-role-details"><div class="role-capabilities">${(role.capabilities||[]).map(item=>`<span>${escapeHtml(item)}</span>`).join('')}</div><ul>${role.permissions.map(item=>`<li>${item}</li>`).join('')}</ul></div></details>`).join('');
  return `<article class="card customization-card"><div class="card-head"><div><h2>Composição dos perfis</h2><p>Consulte permissões, responsabilidades e limites de cada perfil operacional.</p></div><span class="mini-tag">${accessRoleTemplates.length} modelos</span></div><div class="card-body"><div class="access-role-accordion-list">${roleAccordion}</div></div></article>`;
}

function renderUserAccountsAdmin() {
  const profiles = [...state.accessProfiles].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
  const activeCount=profiles.filter(profile=>profile.status==='active').length;
  const pendingCount=profiles.filter(profile=>profile.status==='pending').length;
  const inactiveCount=profiles.filter(profile=>['inactive','blocked','rejected'].includes(profile.status)).length;
  const statusMap={active:'Ativo',pending:'Convite pendente',inactive:'Inativo',blocked:'Bloqueado',rejected:'Rejeitado'};
  return `<article class="card customization-card user-management-card"><div class="card-head access-users-head"><div><h2>Cadastro e gestão de usuários</h2><p>Crie ou edite contas, defina senha temporária e envie as credenciais pelo Outlook sem armazenar a senha em texto aberto.</p></div><div class="access-users-head-actions"><span class="mini-tag">${profiles.length} conta(s)</span>${currentRole()==='administrator'?`<button class="btn btn-secondary" data-action="open-bulk-provision-patients">${icon('users')} Migrar pacientes em lote</button>`:''}<button class="btn btn-primary" data-action="open-access-profile-form">${icon('plus')} Cadastrar usuário</button></div></div><div class="card-body"><div class="user-account-summary"><div><strong>${activeCount}</strong><span>Contas ativas</span></div><div><strong>${pendingCount}</strong><span>Convites pendentes</span></div><div><strong>${inactiveCount}</strong><span>Contas restritas</span></div><div><strong>${profiles.length}</strong><span>Total de contas</span></div></div><div class="admin-callout security-callout"><strong>Tratamento seguro da senha</strong><p>A senha digitada existe apenas durante o cadastro ou a redefinição. Ela é enviada ao Supabase Authentication, exibida na tela de credenciais e descartada ao fechar a janela.</p></div><div class="section-divider"></div><div class="access-profile-list">${profiles.length?profiles.map(profile=>{const role=getAccessRole(profile.roleId);return `<article class="access-profile-item"><div class="access-profile-main">${renderAvatar({name:profile.name||role.label,avatarData:profile.avatarData||''},'access-profile-avatar')}<div><strong>${escapeHtml(profile.name||'Sem nome')}</strong><div class="access-profile-meta"><span>${escapeHtml(profile.email||'')}</span><i></i><span>${role.label}</span><i></i><span>${statusMap[profile.status]||'Ativo'}</span>${profile.authUserId?'<i></i><span class="cloud-linked-label">Supabase Auth vinculado</span>':''}${profile.forcePasswordChange?'<i></i><span class="password-change-label">Troca obrigatória</span>':''}</div><p>${escapeHtml(profile.notes||role.summary)}</p></div></div><div class="access-profile-actions"><span class="mini-tag">Atualizado em ${formatDate(profile.updatedAt||profile.createdAt||new Date().toISOString())}</span><div class="inline-actions user-row-actions"><button class="btn btn-primary btn-sm" data-action="impersonate-access-profile" data-id="${profile.id}">${icon('switchUser')} Acessar conta</button><button class="btn btn-secondary btn-sm" data-action="edit-access-profile" data-id="${profile.id}">${icon('edit')} Editar / redefinir senha</button>${profile.locked?`<button class="btn btn-secondary btn-sm" disabled>${icon('lock')} Protegido</button>`:`<button class="btn btn-secondary btn-sm danger-soft" data-action="delete-access-profile" data-id="${profile.id}">${icon('trash')} Excluir</button>`}</div></div></article>`;}).join(''):emptyState('users','Nenhuma conta cadastrada','Use o botão Cadastrar usuário para criar a primeira conta.')}</div></div></article>`;
}

function renderBulkProvisionPatientsModal(){
  const patients=(state.patients||[]).filter(patient=>String(patient.email||'').trim());
  const missing=(state.patients||[]).length-patients.length;
  const fixed=generateStrongPassword();
  const body=`<div class="bulk-provision-summary"><span>${icon('users',28)}</span><div><strong>${patients.length} paciente(s) prontos para migração</strong><p>As contas serão criadas ou atualizadas no Supabase Authentication com o perfil <b>Paciente</b>. ${missing?`${missing} cadastro(s) sem e-mail serão ignorados.`:'Todos possuem e-mail válido para processamento.'}</p></div></div>
  <form id="bulk-provision-form" class="form-grid bulk-provision-form">
    <div class="field full"><label>Estratégia de senha</label><div class="credential-strategy-grid"><label><input type="radio" name="passwordStrategy" value="generated" checked><span><strong>Senha exclusiva gerada</strong><small>Cria uma senha forte diferente para cada paciente.</small></span></label><label><input type="radio" name="passwordStrategy" value="fixed"><span><strong>Senha padrão temporária</strong><small>Aplica a mesma senha abaixo a todas as contas.</small></span></label></div></div>
    <div class="field full"><label>Senha padrão temporária</label><div class="password-generate-row"><input name="fixedPassword" value="${escapeHtml(fixed)}" minlength="8" autocomplete="new-password"><button type="button" class="btn btn-secondary" data-action="regenerate-bulk-password">${icon('reset')} Gerar outra</button></div><span class="helper">Usada somente quando a opção “Senha padrão temporária” estiver selecionada.</span></div>
    <label class="toggle-control full"><input type="checkbox" name="resetExisting" checked><span><strong>Redefinir também as contas já existentes</strong><small>Garante que todos recebam uma senha temporária conhecida e troca obrigatória no primeiro acesso.</small></span></label>
  </form>
  <div id="bulk-provision-progress" class="bulk-provision-progress" hidden><div><strong>Processando pacientes...</strong><span id="bulk-provision-progress-label">0 de ${patients.length}</span></div><progress id="bulk-provision-progress-bar" max="${patients.length||1}" value="0"></progress><small id="bulk-provision-current">Preparando conexão segura.</small></div>`;
  modalShell('Migrar pacientes em lote','Criação segura de usuários e vinculação à base central.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" id="bulk-provision-confirm" data-action="confirm-bulk-provision-patients" ${patients.length?'':'disabled'}>${icon('cloud')} Salvar todos na base central</button>`,'wide');
}

function bulkCredentialsCsv(){
  const escapeCsv=value=>`"${String(value??'').replace(/"/g,'""')}"`;
  const rows=[['Paciente','E-mail','Senha temporária','Perfil','Situação'],...pendingBulkCredentials.map(item=>[item.name,item.email,item.password,'Paciente',item.status||'Criado'])];
  return '\ufeff'+rows.map(row=>row.map(escapeCsv).join(';')).join('\r\n');
}

function renderBulkProvisionResultModal(){
  const success=pendingBulkCredentials.filter(item=>item.success!==false);
  const failed=pendingBulkCredentials.filter(item=>item.success===false);
  const body=`<div class="bulk-result-hero ${failed.length?'has-errors':''}"><span>${icon(failed.length?'warning':'check',30)}</span><div><strong>${success.length} conta(s) processada(s)</strong><p>${failed.length?`${failed.length} cadastro(s) apresentaram erro e podem ser tentados novamente.`:'Todos os pacientes elegíveis foram vinculados ao perfil Paciente.'}</p></div></div>${success.length?`<div class="credential-table-wrap"><table class="credential-table"><thead><tr><th>Paciente</th><th>E-mail</th><th>Senha temporária</th><th>Status</th></tr></thead><tbody>${success.map(item=>`<tr><td>${escapeHtml(item.name)}</td><td>${escapeHtml(item.email)}</td><td><code>${escapeHtml(item.password||'Senha preservada')}</code></td><td><span class="cloud-linked-label">${escapeHtml(item.status||'Concluído')}</span></td></tr>`).join('')}</tbody></table></div>`:''}${failed.length?`<div class="bulk-error-list"><h3>Itens não processados</h3>${failed.map(item=>`<div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.error||'Falha desconhecida')}</span></div>`).join('')}</div>`:''}<div class="admin-callout warning-callout"><strong>Proteja as credenciais</strong><p>As senhas aparecem somente nesta janela e não ficam salvas no navegador. Baixe ou copie antes de fechar.</p></div>`;
  modalShell('Migração em lote concluída','Resumo da criação e vinculação de usuários.',body,`<button class="btn btn-secondary" data-action="copy-bulk-credentials" ${success.length?'':'disabled'}>${icon('duplicate')} Copiar credenciais</button><button class="btn btn-secondary" data-action="download-bulk-credentials" ${success.length?'':'disabled'}>${icon('download')} Baixar CSV</button><button class="btn btn-primary" data-action="close-bulk-credentials">Concluir</button>`,'wide');
}

async function provisionPatientsInBulk(){
  if(bulkProvisionRunning)return;
  if(currentRole()!=='administrator')return toast('Somente o Administrador pode executar a migração em lote.','error');
  if(!cloudReady())return toast('Conecte o banco central com uma conta administrativa.','error');
  const form=document.getElementById('bulk-provision-form');if(!form?.reportValidity())return;
  const fd=new FormData(form);
  const strategy=String(fd.get('passwordStrategy')||'generated');
  const fixedPassword=String(fd.get('fixedPassword')||'');
  const resetExisting=!!fd.get('resetExisting');
  if(strategy==='fixed'&&fixedPassword.length<8)return toast('A senha padrão deve ter pelo menos 8 caracteres.','error');
  const candidates=(state.patients||[]).filter(patient=>String(patient.email||'').trim());
  if(!candidates.length)return toast('Nenhum paciente possui e-mail para criar a conta.','error');
  bulkProvisionRunning=true;pendingBulkCredentials=[];
  const button=document.getElementById('bulk-provision-confirm');if(button){button.disabled=true;button.innerHTML='<span class="spinner"></span> Processando...';}
  const progress=document.getElementById('bulk-provision-progress');if(progress)progress.hidden=false;
  let completed=0,index=0;
  const updateProgress=(patient)=>{
    completed++;
    const bar=document.getElementById('bulk-provision-progress-bar');if(bar)bar.value=completed;
    const label=document.getElementById('bulk-provision-progress-label');if(label)label.textContent=`${completed} de ${candidates.length}`;
    const current=document.getElementById('bulk-provision-current');if(current)current.textContent=`Último processamento: ${patient.name}`;
  };
  const processPatient=async patient=>{
    const existingProfile=(state.accessProfiles||[]).find(profile=>profile.authUserId===patient.authUserId||String(profile.email||'').toLowerCase()===String(patient.email||'').toLowerCase());
    const shouldSetPassword=!patient.authUserId||resetExisting;
    const password=shouldSetPassword?(strategy==='fixed'?fixedPassword:generateStrongPassword()):'';
    try{
      const result=await cloud.createManagedUser({
        userId:patient.authUserId||existingProfile?.authUserId||null,
        email:String(patient.email).trim().toLowerCase(),
        password:password||undefined,
        fullName:patient.name||'Paciente Humanevo',
        role:'patient',
        status:'approved',
        forcePasswordChange:shouldSetPassword
      });
      const authUserId=result?.user?.id||result?.user_id||patient.authUserId||existingProfile?.authUserId||'';
      patient.authUserId=authUserId;
      const patientResult=await cloud.upsertPatient(patient);
      const cloudId=typeof patientResult==='string'?patientResult:(patientResult?.id||patientResult?.patient_id||patientResult?.[0]?.id||'');
      if(cloudId)patient.cloudId=cloudId;
      const now=new Date().toISOString();
      const profile={id:existingProfile?.id||uid('access'),name:patient.name,email:String(patient.email).trim().toLowerCase(),roleId:'patient',status:'active',avatarData:existingProfile?.avatarData||'',notes:'Conta criada pela migração em lote de pacientes.',forcePasswordChange:shouldSetPassword,locked:false,authUserId,cloudProvisionedAt:now,createdAt:existingProfile?.createdAt||now,updatedAt:now};
      if(existingProfile)Object.assign(existingProfile,profile);else state.accessProfiles.push(profile);
      pendingBulkCredentials.push({name:patient.name,email:patient.email,password:password||'',status:patient.authUserId?'Vinculado':'Criado',success:true});
    }catch(error){pendingBulkCredentials.push({name:patient.name,email:patient.email,password:'',success:false,error:String(error?.message||'Falha ao criar a conta.')});}
    finally{updateProgress(patient);}
  };
  const workers=Array.from({length:Math.min(3,candidates.length)},async()=>{while(index<candidates.length){const patient=candidates[index++];await processPatient(patient);}});
  await Promise.all(workers);
  bulkProvisionRunning=false;
  audit('Migração de pacientes em lote','Usuários',`${pendingBulkCredentials.filter(item=>item.success!==false).length} conta(s) processada(s); ${pendingBulkCredentials.filter(item=>item.success===false).length} falha(s).`);
  saveState();state.modal={type:'bulkProvisionResult'};renderModal();
}

function renderAccessProfileModal(profileId='') {
  const draft=state.accessProfiles.find(profile=>profile.id===(profileId||state.adminProfileDraftId))||null;
  const cloudEnabled=cloudReady()&&currentRole()==='administrator';
  const previewAvatar=pendingProfileAvatarData||draft?.avatarData||'';
  const passwordLabel=draft?'Nova senha (opcional)':'Senha temporária';
  const passwordHelp=draft?'Deixe os dois campos em branco para manter a senha atual.':'A senha será usada somente para criar a conta e preparar o envio das credenciais.';
  const body=`<form id="access-profile-form" class="form-grid access-profile-modal-form" autocomplete="off"><input type="hidden" name="profileId" value="${draft?.id||''}"><div class="field"><label>Nome do usuário</label><input name="name" required value="${escapeHtml(draft?.name||'')}" placeholder="Ex.: Dra. Maria Souza"></div><div class="field"><label>E-mail</label><input name="email" type="email" required value="${escapeHtml(draft?.email||'')}" placeholder="usuario@humanevo.com"></div><div class="field"><label>Perfil de acesso</label><select name="roleId">${accessRoleTemplates.map(role=>`<option value="${role.id}" ${(draft?.roleId||'psychologist')===role.id?'selected':''}>${role.label}</option>`).join('')}</select></div><div class="field"><label>Status da conta</label><select name="status">${[['active','Ativo'],['pending','Convite pendente'],['inactive','Inativo'],['blocked','Bloqueado'],['rejected','Rejeitado']].map(([value,label])=>`<option value="${value}" ${(draft?.status||'active')===value?'selected':''}>${label}</option>`).join('')}</select></div><div class="field password-field-group"><label>${passwordLabel}</label><div class="password-admin-wrap"><input name="temporaryPassword" type="password" autocomplete="new-password" minlength="8" placeholder="${draft?'Deixe em branco para manter':'Mínimo de 8 caracteres'}"><button class="btn btn-secondary btn-sm password-generate-btn" type="button" data-action="generate-strong-password">${icon('key',14)} Gerar senha forte</button></div><span class="helper">${passwordHelp}</span></div><div class="field"><label>Confirmação da senha</label><input name="temporaryPasswordConfirm" type="password" autocomplete="new-password" minlength="8" placeholder="Repita a senha"></div><div class="field full password-policy-row"><label class="toggle-control compact-toggle"><input type="checkbox" name="forcePasswordChange" ${draft?.forcePasswordChange?'checked':!draft?'checked':''}><span><strong>Exigir troca de senha no primeiro acesso</strong><small>O usuário deverá criar uma nova senha antes de entrar no ambiente.</small></span></label></div><div class="field full"><label class="toggle-control compact-toggle"><input type="checkbox" name="createInSupabase" checked><span><strong>Salvar no Supabase Authentication</strong><small>${isDemoAccess?'No modo demonstrativo, a operação será simulada sem gravar usuários reais.':cloudEnabled?'Conta administrativa conectada. Use o teste abaixo para validar o serviço protegido do Cloudflare antes do primeiro cadastro.':'Conecte uma conta Administrador ao banco central antes de salvar.'}</small></span></label>${!isDemoAccess?`<div class="inline-actions" style="margin-top:10px"><button class="btn btn-secondary btn-sm" type="button" data-action="test-user-edge-function">${icon('activity',14)} Testar serviço de cadastro</button></div>`:''}</div><div class="field full"><label>Imagem de perfil</label><div class="profile-image-field modal-profile-image">${renderAvatar({name:draft?.name||'Novo usuário',avatarData:previewAvatar},'profile-image-preview')}<div class="profile-image-controls"><input name="profileImage" type="file" accept="image/png,image/jpeg,image/webp"><span class="helper">A imagem é exibida como prévia e aplicada somente após salvar.</span>${draft?.avatarData?'<label class="remove-photo-option"><input type="checkbox" name="removeAvatar"> Remover imagem atual</label>':''}</div></div></div><div class="field full"><label>Observações</label><textarea name="notes" maxlength="300" placeholder="Anotações sobre escopo, unidade, restrições ou orientação de uso.">${escapeHtml(draft?.notes||'')}</textarea><span class="helper">Máximo de 300 caracteres.</span></div><div class="field full"><div class="admin-callout security-callout"><strong>A senha não será armazenada</strong><p>O Humanevo não grava a senha no banco de dados da aplicação, localStorage ou sessionStorage. O Supabase Authentication recebe a senha por conexão protegida e mantém apenas o mecanismo seguro de autenticação.</p></div></div></form>`;
  modalShell(draft?'Editar usuário':'Cadastrar novo usuário',draft?'Atualize dados, permissões e, somente quando necessário, redefina a senha.':'Defina o usuário, a senha temporária e o fluxo de primeiro acesso.',body,`<button class="btn btn-secondary" data-action="close-access-profile-modal">Cancelar</button><button class="btn btn-primary" data-action="save-access-profile">${icon('check')} ${draft?'Salvar alterações':'Cadastrar usuário'}</button>`,'access-profile-modal wide');
  requestAnimationFrame(()=>modalRoot.querySelector('[name="name"]')?.focus({preventScroll:true}));
}

function renderAccessCredentialsModal() {
  const data=pendingCredentialData;
  if(!data){state.modal=null;return render();}
  const body=`<div class="credentials-delivery"><div class="credentials-success-icon">${icon('check',30)}</div><div class="credentials-title"><span>${data.created?'Usuário criado':'Senha redefinida'}</span><h3>Credenciais prontas para envio</h3><p>Revise os dados e utilize o Outlook. Ao fechar esta tela, a senha será descartada definitivamente da memória do aplicativo.</p></div><div class="credential-grid"><div><span>Nome</span><strong>${escapeHtml(data.name)}</strong></div><div><span>Perfil</span><strong>${escapeHtml(data.roleLabel)}</strong></div><div class="credential-wide"><span>E-mail</span><strong>${escapeHtml(data.email)}</strong></div><div class="credential-wide credential-password"><span>Senha temporária</span><strong id="credential-password-value">${escapeHtml(data.password)}</strong></div><div class="credential-wide"><span>Primeiro acesso</span><strong>${data.forcePasswordChange?'Troca de senha obrigatória':'Senha poderá ser mantida pelo usuário'}</strong></div></div><div class="admin-callout warning-callout"><strong>Envio consciente</strong><p>Confirme o destinatário antes de enviar. Não inclua outras informações clínicas na mensagem de credenciais.</p></div></div>`;
  modalShell('Envio de credenciais','Padrão Outlook após cadastro ou redefinição de senha.',body,`<button class="btn btn-secondary" data-action="copy-access-credentials">${icon('copy')} Copiar credenciais</button><button class="btn btn-primary" data-action="open-outlook-credentials">${icon('mail')} Abrir Outlook</button><button class="btn btn-secondary" data-action="close-credentials-modal">Concluir e descartar senha</button>`,'wide credentials-modal');
}

function credentialsMessage(data=pendingCredentialData) {
  if(!data) return '';
  return `Olá, ${data.name}.

Seu acesso à plataforma Humanevo foi ${data.created?'criado':'atualizado'}.

Endereço: ${window.HUMANEVO_CONFIG?.PUBLIC_APP_URL||location.origin}
Usuário: ${data.email}
Senha temporária: ${data.password}
Perfil: ${data.roleLabel}

${data.forcePasswordChange?'Por segurança, será necessário criar uma nova senha no primeiro acesso.':'Use estas credenciais para entrar na plataforma.'}

Atenciosamente,
Administração Humanevo`;
}

function patientInviteMessage(data=pendingPatientInviteData) {
  if(!data) return '';
  const intro=`Olá, ${data.name}.`;
  if(data.password) return `${intro}\n\nSeu acesso ao Portal do Paciente Humanevo foi criado.\n\nLink: ${data.accessUrl}\nUsuário: ${data.email}\nSenha temporária: ${data.password}\n\nPor segurança, você deverá criar uma nova senha no primeiro acesso.\n\nAtenciosamente,\nEquipe Humanevo`;
  return `${intro}\n\nA clínica cadastrou seus dados e disponibilizou o link para você criar o acesso ao Portal do Paciente.\n\nLink de cadastro: ${data.signupUrl}\nE-mail cadastrado: ${data.email}\n\nCrie sua senha e aguarde a liberação quando solicitado.\n\nAtenciosamente,\nEquipe Humanevo`;
}

function renderPatientInviteModal() {
  const data=pendingPatientInviteData;
  if(!data){state.modal=null;return render();}
  const body=`<div class="credentials-delivery"><div class="credentials-success-icon">${icon('send',30)}</div><div class="credentials-title"><span>Paciente salvo</span><h3>Convite pronto para envio</h3><p>O canal escolhido foi <strong>${data.channel==='whatsapp'?'WhatsApp':data.channel==='email'?'E-mail':'não enviar agora'}</strong>. A senha temporária, quando existente, permanece somente nesta tela.</p></div><div class="credential-grid"><div><span>Paciente</span><strong>${escapeHtml(data.name)}</strong></div><div><span>Telefone</span><strong>${escapeHtml(formatBrazilPhone(data.phone)||'Não informado')}</strong></div><div class="credential-wide"><span>E-mail</span><strong>${escapeHtml(data.email||'Não informado')}</strong></div><div class="credential-wide"><span>Tipo de acesso</span><strong>${data.password?'Conta criada com senha temporária':'Link para autocadastro'}</strong></div>${data.password?`<div class="credential-wide credential-password"><span>Senha temporária</span><strong>${escapeHtml(data.password)}</strong></div>`:''}</div><div class="admin-callout warning-callout"><strong>Privacidade</strong><p>A mensagem contém somente informações de acesso. Dados clínicos e endereço não são enviados.</p></div></div>`;
  const emailClass=data.channel==='email'?'btn-primary':'btn-secondary';
  const whatsappClass=data.channel==='whatsapp'?'btn-primary':'btn-secondary';
  modalShell('Enviar acesso do paciente','Escolha o canal ou copie a mensagem.',body,`<button class="btn btn-secondary" data-action="copy-patient-invite">${icon('copy')} Copiar mensagem</button><button class="btn ${emailClass}" data-action="open-patient-invite-email">${icon('mail')} Abrir e-mail</button><button class="btn ${whatsappClass}" data-action="open-patient-invite-whatsapp">${icon('phone')} Abrir WhatsApp</button><button class="btn btn-secondary" data-action="close-patient-invite">Concluir</button>`,'wide credentials-modal');
}

function renderAccessCockpitAdmin() {
  if(currentRole()!=='administrator') return '';
  const tab=state.accessCockpitTab||'pending';
  const tabs=[['pending','Solicitações pendentes'],['roles','Permissões por perfil'],['users','Exceções por usuário']];
  let content='';
  if(tab==='roles') content=renderRolePermissionMatrix();
  else if(tab==='users') content=renderUserPermissionExceptions();
  else content=renderPendingAccessRequests();
  return `<article class="card customization-card access-cockpit-card"><div class="card-head"><div><h2>Cockpit de liberação de acessos</h2><p>Central administrativa para aprovar solicitações e definir o menor privilégio necessário.</p></div><span class="mini-tag">Administrador</span></div><div class="card-body"><div class="access-cockpit-tabs">${tabs.map(([id,label])=>`<button class="${tab===id?'active':''}" data-action="access-cockpit-tab" data-value="${id}">${label}</button>`).join('')}</div><div class="access-cockpit-content">${content}</div></div></article>`;
}

function renderPendingAccessRequests() {
  const pending=state.cloudPendingProfiles||[];
  const roleOptions=[['patient','Paciente'],['psychologist','Psicólogo'],['intake_manager','Gestor de Acolhimento'],['administrator','Administrador']];
  if(!cloudReady()) return `<div class="admin-callout"><strong>Banco central desconectado</strong><p>Conecte uma conta Administrador para consultar e decidir solicitações reais do Supabase.</p></div>`;
  return pending.length?`<div class="access-request-list">${pending.map(profile=>`<article class="access-request-row"><span class="cloud-profile-avatar">${initials(profile.name)}</span><div class="access-request-copy"><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(profile.email)} · ${profile.status==='pending'?'Aguardando decisão':escapeHtml(profile.status)}</small></div><select data-cloud-role="${profile.userId}" aria-label="Perfil de ${escapeHtml(profile.name)}">${roleOptions.map(([value,label])=>`<option value="${value}" ${profile.role===value?'selected':''}>${label}</option>`).join('')}</select><div class="inline-actions"><button class="btn btn-primary btn-sm" data-action="approve-cloud-profile" data-id="${profile.userId}">${icon('check')} Aprovar</button><button class="btn btn-secondary btn-sm" data-action="reject-cloud-profile" data-id="${profile.userId}">${icon('close')} Rejeitar</button><button class="btn btn-secondary btn-sm danger-soft" data-action="block-cloud-profile" data-id="${profile.userId}">${icon('lock')} Bloquear</button></div></article>`).join('')}</div>`:emptyState('check','Nenhuma solicitação pendente','Novos cadastros aparecerão aqui para decisão administrativa.');
}

function renderRolePermissionMatrix() {
  return `<div class="permission-matrix-wrap"><table class="permission-matrix"><thead><tr><th>Função</th>${accessRoleTemplates.map(role=>`<th>${role.label}</th>`).join('')}</tr></thead><tbody>${accessPermissionCatalog.map(permission=>`<tr><td><strong>${permission.label}</strong><small>${permission.description}</small></td>${accessRoleTemplates.map(role=>{const checked=state.rolePermissions?.[role.id]?.[permission.id]===true;const protectedAdmin=role.id==='administrator'&&permission.id==='administration';return `<td><label class="permission-switch"><input type="checkbox" data-action="role-permission-change" data-role="${role.id}" data-permission="${permission.id}" ${checked?'checked':''} ${protectedAdmin?'disabled':''}><span></span></label>${role.id==='psychologist'&&permission.id==='delete_patients'?'<small class="default-permission-note">Padrão ativo</small>':''}</td>`;}).join('')}</tr>`).join('')}</tbody></table><div class="admin-callout"><strong>Regra padrão do Psicólogo</strong><p>A exclusão individual de pacientes fica ativada por padrão para o perfil Psicólogo, mas pode ser retirada aqui pelo Administrador.</p></div></div>`;
}

function renderUserPermissionExceptions() {
  const profiles=[...state.accessProfiles].sort((a,b)=>String(a.name||'').localeCompare(String(b.name||''),'pt-BR'));
  if(!profiles.length) return emptyState('users','Nenhum usuário cadastrado','Cadastre usuários antes de criar exceções individuais.');
  return `<div class="user-exception-list">${profiles.map(profile=>{const key=permissionSubjectKey(profile);const overrides=state.userPermissionExceptions?.[key]||{};const role=getAccessRole(profile.roleId);return `<details class="user-exception-card"><summary>${renderAvatar({name:profile.name,avatarData:profile.avatarData||''},'access-profile-avatar')}<span><strong>${escapeHtml(profile.name)}</strong><small>${escapeHtml(profile.email)} · Base: ${role.label}</small></span><span class="mini-tag">${Object.keys(overrides).length} exceção(ões)</span>${icon('chevronRight',17)}</summary><div class="user-exception-grid">${accessPermissionCatalog.map(permission=>{const value=Object.prototype.hasOwnProperty.call(overrides,permission.id)?String(overrides[permission.id]):'inherit';const locked=profile.locked&&permission.id==='administration';return `<label><span><strong>${permission.label}</strong><small>${permission.description}</small></span><select data-action="user-permission-change" data-profile="${profile.id}" data-permission="${permission.id}" ${locked?'disabled':''}><option value="inherit" ${value==='inherit'?'selected':''}>Herdar do perfil</option><option value="true" ${value==='true'?'selected':''}>Liberado</option><option value="false" ${value==='false'?'selected':''}>Bloqueado</option></select></label>`;}).join('')}</div></details>`;}).join('')}</div>`;
}

function renderAccessProfilesAdmin() { return `${renderAccessRolesAdmin()}${renderUserAccountsAdmin()}`; }

function renderAuditAdmin() {
  const rows=(state.modificationLogs||[]).slice(0,8);
  return `<article class="card customization-card"><div class="card-head"><div><h2>Log de modificações</h2><p>Registros granulares com data, hora, minuto, segundo e possibilidade de rollback.</p></div><span class="mini-tag">${state.modificationLogs.length} registros</span></div><div class="card-body">${rows.length?`<div class="modification-mini-list">${rows.map(log=>`<div><span>${escapeHtml(new Date(log.createdAt).toLocaleString('pt-BR',{hour12:false}))}</span><strong>${escapeHtml(log.action)}</strong><small>${escapeHtml(log.actor)} · ${escapeHtml(log.module)}</small></div>`).join('')}</div>`:emptyState('activity','Nenhuma modificação registrada','As alterações estruturais aparecerão aqui automaticamente.')}<div class="inline-actions" style="margin-top:16px"><button class="btn btn-primary" data-action="nav" data-nav="modifications">${icon('activity')} Abrir módulo completo</button></div></div></article>`;
}
function renderModificationLogsPage() {
  const rows=(state.modificationLogs||[]).slice(0,150);
  const today=new Date().toISOString().slice(0,10);
  const todayCount=rows.filter(log=>String(log.createdAt).slice(0,10)===today).length;
  const undoable=rows.filter(log=>log.canUndo).length;
  const users=new Set(rows.map(log=>log.actor)).size;
  return `<div class="page-head"><div><h1>Log de modificações</h1><p>Rastreabilidade administrativa com horário preciso e restauração do estado anterior.</p></div><div class="page-actions"><button class="btn btn-secondary" data-action="export-system-xlsx">${icon('download')} Exportar auditoria</button></div></div><section class="stats-grid modification-stats">${statCard('activity',rows.length,'Modificações registradas','Histórico local')}${statCard('edit',todayCount,'Alterações hoje','Data atual')}${statCard('users',users,'Usuários identificados','Responsáveis')}${statCard('reset',undoable,'Ações reversíveis','Rollback disponível')}</section><article class="card modification-log-card"><div class="card-head"><div><h2>Rastreamento granular</h2><p>Cada linha identifica usuário, módulo, data e horário até o segundo.</p></div><span class="mini-tag">Últimos ${rows.length}</span></div><div class="card-body">${rows.length?`<div class="modification-table-wrap"><table class="modification-table"><thead><tr><th>Usuário</th><th>Ação</th><th>Módulo</th><th>Data</th><th>Hora</th><th>Min.</th><th>Seg.</th><th>Detalhe</th><th>Status</th><th>Desfazer</th></tr></thead><tbody>${rows.map(log=>{const d=new Date(log.createdAt);const parts=new Intl.DateTimeFormat('pt-BR',{year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false}).formatToParts(d).reduce((acc,item)=>(acc[item.type]=item.value,acc),{});return `<tr><td><strong>${escapeHtml(log.actor||'Usuário')}</strong><small>${escapeHtml(log.actorEmail||'')}</small></td><td>${escapeHtml(log.action||'Alteração')}</td><td>${escapeHtml(log.module||'Sistema')}</td><td>${parts.day}/${parts.month}/${parts.year}</td><td>${parts.hour}</td><td>${parts.minute}</td><td>${parts.second}</td><td><button class="btn btn-secondary btn-sm" data-action="view-modification-detail" data-id="${log.id}">Ver detalhes</button></td><td><span class="log-status ${log.status||'updated'}">${log.status==='restored'?'Restaurado':log.status==='deleted'?'Excluído':'Atualizado'}</span></td><td>${log.canUndo?`<button class="btn btn-primary btn-sm" data-action="open-rollback" data-id="${log.id}">${icon('reset',14)} Desfazer</button>`:'<span class="muted-dash">—</span>'}</td></tr>`;}).join('')}</tbody></table></div>`:emptyState('activity','Nenhum registro','As alterações realizadas pelos usuários aparecerão aqui.')}</div></article>`;
}
function renderRollbackModal(logId) {
  const log=(state.modificationLogs||[]).find(item=>item.id===logId);if(!log)return closeModal();
  const body=`<div class="rollback-warning"><span>${icon('reset',28)}</span><div><strong>Restaurar o estado anterior?</strong><p>Esta ação reverte os módulos afetados por <b>${escapeHtml(log.action)}</b>, realizada por ${escapeHtml(log.actor)} em ${escapeHtml(new Date(log.createdAt).toLocaleString('pt-BR',{hour12:false}))}.</p></div></div><div class="admin-callout"><strong>Módulos afetados</strong><p>${escapeHtml((log.changedKeys||[]).join(', ')||log.module)}</p></div>`;
  modalShell('Desfazer modificação','O rollback utiliza o snapshot armazenado neste dispositivo.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="confirm-rollback" data-id="${log.id}">${icon('reset')} Restaurar estado anterior</button>`);
}
function renderModificationDetailModal(logId) {
  const log=(state.modificationLogs||[]).find(item=>item.id===logId);if(!log)return closeModal();
  const body=`<div class="detail-grid"><div><span>Usuário</span><strong>${escapeHtml(log.actor||'—')}</strong></div><div><span>E-mail</span><strong>${escapeHtml(log.actorEmail||'—')}</strong></div><div><span>Data e hora</span><strong>${escapeHtml(new Date(log.createdAt).toLocaleString('pt-BR',{hour12:false}))}</strong></div><div><span>Módulo</span><strong>${escapeHtml(log.module||'—')}</strong></div></div><div class="admin-callout"><strong>Detalhamento</strong><p>${escapeHtml(log.detail||'Sem detalhe adicional.')}</p></div>`;
  modalShell('Detalhes da modificação',escapeHtml(log.action||'Alteração registrada'),body,`<button class="btn btn-secondary" data-action="close-modal">Fechar</button>${log.canUndo?`<button class="btn btn-primary" data-action="open-rollback" data-id="${log.id}">${icon('reset')} Desfazer</button>`:''}`);
}

function renderIntegrationsAdmin() {
  const statusLabelMap={not_configured:'Não configurada',testing:'Em validação',active:'Ativa',paused:'Pausada'};
  return `<article class="card customization-card"><div class="card-head"><div><h2>Hub de integrações via API</h2><p>Organize conexões com comunicação, agenda e serviços administrativos. As credenciais reais deverão ser configuradas em backend seguro.</p></div><span class="mini-tag">${state.integrations.filter(i=>i.status==='active').length} ativa(s)</span></div><div class="card-body"><div class="integration-grid">${state.integrations.map(item=>`<article class="integration-card"><div class="integration-icon">${icon(item.id==='whatsapp'?'support':item.id==='google-calendar'?'calendar':'chart')}</div><div><strong>${escapeHtml(item.name)}</strong><span>${escapeHtml(item.category)}</span></div><select data-action="integration-status" data-id="${item.id}" aria-label="Status da integração ${escapeHtml(item.name)}">${Object.entries(statusLabelMap).map(([value,label])=>`<option value="${value}" ${item.status===value?'selected':''}>${label}</option>`).join('')}</select><p>${escapeHtml(item.notes||'')}</p><div class="field"><label>Endpoint ou identificador</label><input data-integration-endpoint="${item.id}" value="${escapeHtml(item.endpoint||'')}" placeholder="Configuração protegida no backend"></div><button class="btn btn-secondary btn-sm" data-action="save-integration" data-id="${item.id}">${icon('check')} Salvar configuração</button></article>`).join('')}</div><div class="admin-callout"><strong>Importante</strong><p>Esta versão organiza a configuração e a governança das integrações. Disparos oficiais do WhatsApp, sincronização bidirecional e contabilidade exigem credenciais e funções de servidor, que não devem ficar expostas no navegador.</p></div></div></article>`;
}

function renderStylePreview(c) {
    return `<aside class="style-preview"><div class="style-preview-window"><div class="style-preview-top"><span class="style-preview-dot"></span><span class="style-preview-dot"></span><span class="style-preview-dot"></span></div><div class="style-preview-body"><div style="display:flex;align-items:center;gap:12px">${renderBrandMark('logo-drop-preview')}<div><p class="style-preview-title">Humanevo</p><span class="helper">Studio clínico premium</span></div></div><div class="style-preview-card"><span class="mini-tag">Pré-visualização</span><h3 style="font-family:var(--display);margin:12px 0 5px">Experiência clínica premium</h3><p style="margin:0;color:var(--ink-soft);font-size:.82rem">Ajuste os controles e observe a identidade visual sendo aplicada em tempo real.</p><button class="btn btn-primary" style="margin-top:14px">Botão principal</button></div></div></div></aside>`;
  }

  function renderFormBuilderModal() {
    const d=state.modal?.draft; if(!d) return closeModal();
    const typePicker=questionTypeGroups.map(group=>`<section class="question-type-group"><span class="question-type-group-title">${escapeHtml(group.label)}</span><div>${group.types.map(type=>{const meta=questionTypes[type];return `<button class="question-type-option" type="button" data-action="add-question-type" data-type="${type}">${icon(meta.icon,19)}<strong>${meta.label}</strong><span class="helper">${meta.description}</span></button>`;}).join('')}</div></section>`).join('');
    const body=`<div class="builder-layout"><div class="builder-main"><form id="form-builder-meta" class="builder-section form-grid"><input type="hidden" name="id" value="${escapeHtml(d.id||'')}"><div class="field full"><label>Título do formulário</label><input name="title" required value="${escapeHtml(d.title||'')}"></div><div class="field"><label>Categoria</label><input name="category" value="${escapeHtml(d.category||'Customizado')}"></div><div class="field"><label>Tempo estimado (min)</label><input name="duration" type="number" min="1" max="240" value="${d.duration||10}"></div><div class="field"><label>Status</label><select name="status"><option value="draft" ${d.status==='draft'?'selected':''}>Rascunho</option><option value="active" ${d.status==='active'?'selected':''}>Ativo na biblioteca</option></select></div><div class="field full"><label>Descrição e objetivo</label><textarea name="description">${escapeHtml(d.description||'')}</textarea></div><div class="field full"><label>Referências bibliográficas</label><textarea name="references" placeholder="Uma referência por linha. Ex.: SOBRENOME, Nome. Título. Editora, ano.">${escapeHtml((d.references||[]).join('\n'))}</textarea><span class="helper">Este campo fica associado ao formulário e aparece na biblioteca.</span></div></form>
      <section class="builder-section"><div class="builder-section-head"><div><h3>Estrutura do formulário</h3><span class="helper">Edite, duplique, exclua ou altere a ordem das perguntas.</span></div><span class="mini-tag">${(d.questions||[]).length} pergunta(s)</span></div><div class="question-builder-list">${(d.questions||[]).length?(d.questions||[]).map(renderQuestionBuilderItem).join(''):`<div class="question-empty">Adicione a primeira pergunta usando as opções abaixo.</div>`}</div></section>
      <section class="builder-section google-question-library"><div class="builder-section-head"><div><h3>Adicionar pergunta</h3><span class="helper">Escolha o tipo de resposta como no Google Forms.</span></div></div><div class="question-type-picker grouped">${typePicker}</div></section></div><aside class="builder-preview"><div class="builder-section-head"><div><h3>Pré-visualização</h3><span class="helper">Representação do formulário para o paciente.</span></div></div>${renderBuilderPreview(d)}</aside></div>`;
    modalShell(d.id?'Editar formulário':'Novo formulário','Construtor visual de questionários e roteiros clínicos.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-secondary" data-action="save-custom-form" data-stay="true">${icon('check')} Salvar rascunho</button><button class="btn btn-primary" data-action="save-custom-form">${icon('library')} Salvar na biblioteca</button>`,'studio-modal');
  }

  function renderQuestionBuilderItem(q,i) {
    const meta=questionTypes[q.type]||questionTypes.shortText;
    const optionTypes=['singleChoice','multipleChoice','dropdown'];
    const scaleLike=['scale','rating'].includes(q.type);
    return `<article class="question-builder-item" data-question-index="${i}"><div class="question-builder-head"><span class="question-number">${i+1}</span><span class="question-type-pill">${meta.label}</span><div class="question-actions"><button type="button" data-action="move-question" data-index="${i}" data-direction="-1" title="Mover para cima" ${i===0?'disabled':''}>${icon('up',15)}</button><button type="button" data-action="move-question" data-index="${i}" data-direction="1" title="Mover para baixo" ${i===(state.modal.draft.questions.length-1)?'disabled':''}>${icon('down',15)}</button><button type="button" data-action="duplicate-question" data-index="${i}" title="Duplicar">${icon('duplicate',15)}</button><button type="button" data-action="remove-question" data-index="${i}" title="Excluir">${icon('trash',15)}</button></div></div><div class="question-builder-body"><div class="form-grid"><div class="field full"><label>Título/pergunta</label><input data-q-field="label" value="${escapeHtml(q.label||'')}"></div><div class="field question-type-select-field"><label>Tipo de pergunta</label><div class="question-type-select-wrap">${icon(meta.icon,18)}<select data-q-field="type">${questionTypeSelectOptions(q.type)}</select></div><span class="helper">${escapeHtml(meta.description)}</span></div><div class="field"><label>Obrigatória</label><select data-q-field="required"><option value="false" ${!q.required?'selected':''}>Não</option><option value="true" ${q.required?'selected':''}>Sim</option></select></div><div class="field full"><label>Texto de apoio</label><input data-q-field="help" value="${escapeHtml(q.help||'')}"></div>${optionTypes.includes(q.type)?`<div class="field full"><label>Alternativas (uma por linha)</label><textarea data-q-field="options">${escapeHtml((q.options||[]).join('\n'))}</textarea><span class="helper">A ordem das linhas será a ordem exibida ao paciente.</span></div>`:''}${q.type==='matching'?`<div class="field full"><label>Pares para relacionar</label><textarea data-q-field="pairs" placeholder="Ansiedade => Sintomas físicos
Sono => Rotina noturna">${escapeHtml((q.pairs||[]).map(x=>`${x.left} => ${x.right}`).join('\n'))}</textarea></div>`:''}${scaleLike?`<div class="field"><label>Valor mínimo</label><input data-q-field="min" type="number" value="${q.min??(q.type==='rating'?1:0)}"></div><div class="field"><label>Valor máximo</label><input data-q-field="max" type="number" value="${q.max??(q.type==='rating'?5:10)}"></div><div class="field"><label>Rótulo mínimo</label><input data-q-field="minLabel" value="${escapeHtml(q.minLabel||'Mínimo')}"></div><div class="field"><label>Rótulo máximo</label><input data-q-field="maxLabel" value="${escapeHtml(q.maxLabel||'Máximo')}"></div>`:''}</div></div></article>`;
  }

  function renderBuilderPreview(d) {
    return `<div class="preview-paper"><span class="mini-tag">${escapeHtml(d.category||'Customizado')}</span><h3>${escapeHtml(d.title||'Novo formulário')}</h3><p>${escapeHtml(d.description||'Descrição do formulário.')}</p>${(d.questions||[]).map(renderQuestionPreview).join('')||'<div class="question-empty">Nenhum tópico adicionado.</div>'}${(d.references||[]).length?`<div class="preview-question"><label class="preview-label">Referências</label><div class="bibliography-list">${d.references.map(r=>`<div class="bibliography-item">${icon('book',14)}<span>${escapeHtml(r)}</span></div>`).join('')}</div></div>`:''}</div>`;
  }

  function renderQuestionPreview(q,i) {
    const required=q.required?' *':'';
    if(q.type==='section') return `<div class="form-section">${escapeHtml(q.label||`Seção ${i+1}`)}</div>`;
    if(q.type==='info') return `<div class="alert info">${escapeHtml(q.label||'Informação')}</div>`;
    const label=`<label class="preview-label">${i+1}. ${escapeHtml(q.label||'Pergunta')}${required}</label>${q.help?`<span class="preview-helper">${escapeHtml(q.help)}</span>`:''}`;
    if(q.type==='longText') return `<div class="preview-question">${label}<textarea placeholder="Resposta..."></textarea></div>`;
    if(q.type==='shortText') return `<div class="preview-question">${label}<input placeholder="Resposta..."></div>`;
    if(q.type==='email') return `<div class="preview-question">${label}<input type="email" placeholder="nome@exemplo.com"></div>`;
    if(q.type==='phone') return `<div class="preview-question">${label}<input type="tel" placeholder="(00) 00000-0000"></div>`;
    if(q.type==='number') return `<div class="preview-question">${label}<input type="number"></div>`;
    if(q.type==='date') return `<div class="preview-question">${label}<input type="date"></div>`;
    if(q.type==='time') return `<div class="preview-question">${label}<input type="time"></div>`;
    if(q.type==='yesNo') return `<div class="preview-question">${label}<div class="preview-options"><span class="preview-option">○ Sim</span><span class="preview-option">○ Não</span></div></div>`;
    if(q.type==='scale') return `<div class="preview-question">${label}<input type="range" min="${q.min??0}" max="${q.max??10}" value="${Math.round(((q.min??0)+(q.max??10))/2)}"><div style="display:flex;justify-content:space-between" class="helper"><span>${escapeHtml(q.minLabel||'Mínimo')}</span><span>${escapeHtml(q.maxLabel||'Máximo')}</span></div></div>`;
    if(q.type==='rating') return `<div class="preview-question">${label}<div class="preview-rating" aria-label="Classificação de ${q.min??1} a ${q.max??5}">${Array.from({length:Math.max(1,Math.min(10,Number(q.max)||5))},(_,index)=>`<span>☆<small>${index+1}</small></span>`).join('')}</div></div>`;
    if(q.type==='matching') return `<div class="preview-question">${label}<div class="preview-options">${(q.pairs||[]).map(pair=>`<div class="match-grid"><span class="preview-option">${escapeHtml(pair.left)}</span><span class="match-arrow">${icon('arrow',14)}</span><span class="preview-option">${escapeHtml(pair.right)}</span></div>`).join('')||'<span class="helper">Configure os pares no editor.</span>'}</div></div>`;
    if(q.type==='dropdown') return `<div class="preview-question">${label}<select><option>Selecione</option>${(q.options||[]).map(o=>`<option>${escapeHtml(o)}</option>`).join('')}</select></div>`;
    return `<div class="preview-question">${label}<div class="preview-options">${(q.options||[]).map(o=>`<span class="preview-option">${q.type==='multipleChoice'?'□':'○'} ${escapeHtml(o)}</span>`).join('')||'<span class="helper">Adicione alternativas.</span>'}</div></div>`;
  }

  function captureFormBuilderDraft() {
    const d=state.modal?.draft; if(!d) return null;
    const meta=document.getElementById('form-builder-meta');
    if(meta) {
      const data=Object.fromEntries(new FormData(meta));
      d.title=data.title||d.title; d.category=data.category||'Customizado'; d.duration=Number(data.duration)||10; d.status=data.status||'draft'; d.description=data.description||''; d.references=String(data.references||'').split(/\n+/).map(x=>x.trim()).filter(Boolean);
    }
    document.querySelectorAll('[data-question-index]').forEach(el=>{
      const i=Number(el.dataset.questionIndex); const q=d.questions[i]; if(!q) return;
      el.querySelectorAll('[data-q-field]').forEach(input=>{
        const key=input.dataset.qField; let value=input.value;
        if(key==='required') value=value==='true';
        else if(key==='options') value=value.split(/\n+/).map(x=>x.trim()).filter(Boolean);
        else if(key==='pairs') value=value.split(/\n+/).map(x=>x.trim()).filter(Boolean).map(line=>{const parts=line.split(/=>|→/);return {left:(parts[0]||'').trim(),right:(parts[1]||'').trim()};}).filter(x=>x.left||x.right);
        else if(key==='min'||key==='max') value=Number(value);
        q[key]=value;
      });
    });
    return d;
  }

  function renderCustomAssessmentForm(a,patientSelect) {
    return `<form id="assessment-form" class="form-grid"><input type="hidden" name="assessmentId" value="${a.id}">${patientSelect}<div class="field"><label>Data</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Profissional responsável</label><input name="professional" value="Equipe Humanevo"></div><div class="field full"><label>Objetivo/contexto</label><textarea name="objective"></textarea></div><div class="field full"><div class="form-section">${escapeHtml(a.title)}</div></div>${(a.questions||[]).map(renderCustomQuestion).join('')}<div class="field full"><div class="form-section">Síntese e conduta</div></div><div class="field full"><label>Síntese profissional</label><textarea name="summary"></textarea></div><div class="field full"><label>Recomendações e encaminhamentos</label><textarea name="recommendations"></textarea></div>${(a.references||[]).length?`<div class="field full"><label>Referências bibliográficas</label><div class="bibliography-list">${a.references.map(r=>`<div class="bibliography-item">${icon('book',14)}<span>${escapeHtml(r)}</span></div>`).join('')}</div></div>`:''}</form>`;
  }

  function renderCustomQuestion(q,i) {
    const name=`custom_${i}`; const req=q.required?'required':''; const label=escapeHtml(q.label||`Tópico ${i+1}`); const help=q.help?`<span class="helper">${escapeHtml(q.help)}</span>`:'';
    if(q.type==='section') return `<div class="field full"><div class="form-section">${label}</div></div>`;
    if(q.type==='info') return `<div class="field full"><div class="alert info">${label}</div></div>`;
    if(q.type==='longText') return `<div class="field full"><label>${label}${q.required?' *':''}</label><textarea name="${name}" ${req}></textarea>${help}</div>`;
    if(q.type==='shortText') return `<div class="field"><label>${label}${q.required?' *':''}</label><input name="${name}" ${req}>${help}</div>`;
    if(q.type==='email') return `<div class="field"><label>${label}${q.required?' *':''}</label><input name="${name}" type="email" ${req} placeholder="nome@exemplo.com">${help}</div>`;
    if(q.type==='phone') return `<div class="field"><label>${label}${q.required?' *':''}</label><input name="${name}" type="tel" inputmode="tel" data-phone-mask ${req}>${help}</div>`;
    if(q.type==='number') return `<div class="field"><label>${label}${q.required?' *':''}</label><input name="${name}" type="number" ${req}>${help}</div>`;
    if(q.type==='date') return `<div class="field"><label>${label}${q.required?' *':''}</label><input name="${name}" type="date" ${req}>${help}</div>`;
    if(q.type==='time') return `<div class="field"><label>${label}${q.required?' *':''}</label><input name="${name}" type="time" ${req}>${help}</div>`;
    if(q.type==='yesNo') return `<div class="field full"><label>${label}${q.required?' *':''}</label>${help}<div class="answer-options"><label><input type="radio" name="${name}" value="Sim" ${req}><span>Sim</span></label><label><input type="radio" name="${name}" value="Não" ${req}><span>Não</span></label></div></div>`;
    if(q.type==='scale') return `<div class="field full"><label>${label}${q.required?' *':''}</label>${help}<input name="${name}" type="range" min="${q.min??0}" max="${q.max??10}" value="${Math.round(((q.min??0)+(q.max??10))/2)}"><div style="display:flex;justify-content:space-between" class="helper"><span>${escapeHtml(q.minLabel||'Mínimo')}</span><span>${escapeHtml(q.maxLabel||'Máximo')}</span></div></div>`;
    if(q.type==='rating') return `<div class="field full"><label>${label}${q.required?' *':''}</label>${help}<div class="rating-input">${Array.from({length:Math.max(1,Math.min(10,Number(q.max)||5))},(_,index)=>`<label><input type="radio" name="${name}" value="${index+1}" ${q.required&&index===0?'required':''}><span>★</span><small>${index+1}</small></label>`).join('')}</div></div>`;
    if(q.type==='dropdown') return `<div class="field"><label>${label}${q.required?' *':''}</label>${help}<select name="${name}" ${req}><option value="">Selecione</option>${(q.options||[]).map(o=>`<option>${escapeHtml(o)}</option>`).join('')}</select></div>`;
    if(q.type==='matching') return `<div class="field full"><label>${label}${q.required?' *':''}</label>${help}<div class="questionnaire">${(q.pairs||[]).map((pair,j)=>`<div class="question-row"><div class="match-grid"><strong>${escapeHtml(pair.left)}</strong><span class="match-arrow">${icon('arrow',15)}</span><select name="${name}_${j}" ${req}><option value="">Relacionar com...</option>${(q.pairs||[]).map(x=>`<option>${escapeHtml(x.right)}</option>`).join('')}</select></div></div>`).join('')}</div></div>`;
    const type=q.type==='multipleChoice'?'checkbox':'radio';
    return `<div class="field full"><label>${label}${q.required?' *':''}</label>${help}<div class="option-grid">${(q.options||[]).map((o,optionIndex)=>`<label class="option-check"><input type="${type}" name="${name}" value="${escapeHtml(o)}" ${q.required&&(type==='radio'||optionIndex===0)?'required':''}><span>${escapeHtml(o)}</span></label>`).join('')}</div></div>`;
  }

  function normalizeChatThread(thread={}) {
    const channelType=String(thread.channel_type||thread.channelType||'private');
    return {
      ...thread,
      channelType,
      channel_type:channelType,
      systemKey:thread.system_key||thread.systemKey||'',
      isSystem:thread.is_system??thread.isSystem??['general','internal'].includes(channelType),
      canPost:thread.can_post??thread.canPost??true,
      unreadCount:Number(thread.unread_count??thread.unreadCount??0),
      participants:Array.isArray(thread.participants)?thread.participants:[]
    };
  }
  function chatThreadById(id){return (state.chatThreads||[]).map(normalizeChatThread).find(t=>String(t.id)===String(id));}
  function chatParticipantsExcludingMe(thread={}) {
    const currentId=cloudContext?.user?.id||cloud?.auth?.user?.id||'';
    return (thread.participants||[]).filter(p=>String(p.user_id||p.userId)!==String(currentId));
  }
  function chatChannelMeta(thread={}) {
    const type=normalizeChatThread(thread).channelType;
    if(type==='general')return {label:'Canal Geral',short:'Geral',icon:'bell',description:'Avisos, eventos e comunicados para todos os usuários.'};
    if(type==='internal')return {label:'Canal Interno',short:'Interno',icon:'users',description:'Comunicação exclusiva da equipe.'};
    if(type==='intake')return {label:'Acolhimento',short:'Acolhimento',icon:'heart',description:'Conversa privativa entre paciente e Gestor de Acolhimento.'};
    return {label:'Conversa privada',short:'Privada',icon:'lock',description:'Conversa protegida entre participantes selecionados.'};
  }
  function chatDisplayTitle(thread={}) {
    const normalized=normalizeChatThread(thread);
    const meta=chatChannelMeta(normalized);
    if(['general','internal'].includes(normalized.channelType))return normalized.title||meta.label;
    const others=chatParticipantsExcludingMe(normalized);
    const names=others.map(p=>p.full_name||p.fullName||p.email).filter(Boolean).join(', ');
    if(normalized.channelType==='intake')return normalized.title||`Acolhimento${names?` · ${names}`:''}`;
    return normalized.title||names||'Conversa';
  }
  function chatParticipantAvatarData(participant={}) {
    const id=participant.user_id||participant.userId||'';
    const email=String(participant.email||'').toLowerCase();
    const local=(state.accessProfiles||[]).find(item=>(id&&String(item.authUserId)===String(id))||(email&&String(item.email||'').toLowerCase()===email));
    return participant.avatar_path||participant.avatarData||participant.avatar_url||participant.avatarUrl||local?.avatarData||'';
  }
  function renderChatAvatar(participant={},label='Usuário',className='chat-avatar') {
    return renderAvatar({name:participant.full_name||participant.fullName||participant.name||label,avatarData:chatParticipantAvatarData(participant)},className);
  }
  function chatPrimaryParticipant(thread={}) {return chatParticipantsExcludingMe(thread)[0]||{};}
  function formatChatFileSize(value=0){const bytes=Number(value)||0;if(bytes<1024)return `${bytes} B`;if(bytes<1048576)return `${(bytes/1024).toFixed(bytes<10240?1:0)} KB`;return `${(bytes/1048576).toFixed(1)} MB`;}
  function renderChatAttachments(attachments=[]){
    if(!Array.isArray(attachments)||!attachments.length)return '';
    return `<div class="chat-attachment-list">${attachments.map(file=>`<button type="button" class="chat-attachment-card" data-action="download-chat-attachment" data-id="${escapeHtml(file.id||'')}" title="Baixar ${escapeHtml(file.file_name||'anexo')}"><span>${icon(String(file.mime_type||'').startsWith('image/')?'image':'paperclip',17)}</span><span><strong>${escapeHtml(file.file_name||'Anexo')}</strong><small>${escapeHtml(formatChatFileSize(file.size_bytes))}</small></span>${icon('download',15)}</button>`).join('')}</div>`;
  }
  function renderChatMessage(message={},me=''){
    const mine=String(message.sender_id||message.senderId)===String(me);
    const name=mine?'Você':message.sender_name||message.senderName||'Usuário';
    const avatar=mine?currentProfile().avatarData:(message.sender_avatar||message.senderAvatar||'');
    const body=String(message.body||'');
    return `<article class="chat-message ${mine?'mine':''}">${renderAvatar({name,avatarData:avatar},'chat-message-avatar')}<div class="chat-message-bubble"><strong>${escapeHtml(name)}</strong>${body?`<p>${escapeHtml(body)}</p>`:''}${renderChatAttachments(message.attachments||[])}<time>${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}).format(new Date(message.created_at||message.createdAt))}</time></div></article>`;
  }
  function chatMatchesChannelFilter(thread={},filter='all'){
    const type=normalizeChatThread(thread).channelType;
    if(filter==='all')return true;
    if(filter==='private')return type==='private';
    return type===filter;
  }
  function renderChatPage() {
    const allThreads=(state.chatThreads||[]).map(normalizeChatThread);
    const channelFilter=state.chatChannelFilter||'all';
    const channelThreads=allThreads.filter(thread=>chatMatchesChannelFilter(thread,channelFilter));
    const searchTerm=String(state.chatSearch||'').trim().toLowerCase();
    let active=allThreads.find(t=>String(t.id)===String(state.activeChatThreadId))||null;
    if(!active||!chatMatchesChannelFilter(active,channelFilter))active=channelThreads[0]||null;
    if(active&&String(state.activeChatThreadId)!==String(active.id))state.activeChatThreadId=active.id;
    const messages=active?(state.chatMessages||[]).filter(m=>String(m.thread_id||m.threadId)===String(active.id)):[];
    const me=cloudContext?.user?.id||cloud?.auth?.user?.id||'local';
    const notificationAction=typeof Notification!=='undefined'&&Notification.permission!=='granted'?`<button class="btn btn-secondary" data-action="enable-chat-notifications">${icon('bell')} Ativar alertas</button>`:'';
    const clearAction=currentRole()==='administrator'?`<button class="btn btn-secondary" data-action="open-clear-all-chat">${icon('trash')} Limpar conversas</button>`:'';
    const intakeAction=currentRole()==='intake_manager'?`<button class="btn btn-secondary" data-action="open-intake-chat">${icon('heart')} Acolhimento</button>`:'';
    const counts={all:allThreads.length,general:allThreads.filter(t=>t.channelType==='general').length,internal:allThreads.filter(t=>t.channelType==='internal').length,intake:allThreads.filter(t=>t.channelType==='intake').length,private:allThreads.filter(t=>t.channelType==='private').length};
    const tabs=[['all','Todos'],['general','Geral'],['internal','Interno'],['intake','Acolhimento'],['private','Privadas']];
    const threadMarkup=channelThreads.length?channelThreads.map(t=>{
      const title=chatDisplayTitle(t);const meta=chatChannelMeta(t);const searchText=`${title} ${t.last_message||''} ${meta.label}`.toLowerCase();const visible=!searchTerm||searchText.includes(searchTerm);const primary=chatPrimaryParticipant(t);
      const avatar=['general','internal'].includes(t.channelType)?`<span class="chat-channel-avatar channel-${t.channelType}">${icon(meta.icon,18)}</span>`:renderChatAvatar(primary,title,'chat-avatar');
      return `<button class="chat-thread ${active&&String(active.id)===String(t.id)?'active':''}" data-action="open-chat-thread" data-id="${t.id}" data-chat-filter="${escapeHtml(searchText)}" ${visible?'':'hidden'}>${avatar}<span class="chat-thread-copy"><span class="chat-thread-title"><strong>${escapeHtml(title)}</strong><em class="chat-channel-badge channel-${t.channelType}">${escapeHtml(meta.short)}</em></span><small>${escapeHtml(t.last_message||meta.description)}</small></span>${t.unreadCount?`<b>${t.unreadCount}</b>`:''}</button>`;
    }).join(''):`<div class="chat-empty-side"><strong>Nenhuma conversa neste canal</strong><span>Selecione outro canal ou inicie uma conversa.</span></div>`;
    const anyVisible=channelThreads.some(t=>{const meta=chatChannelMeta(t);return !searchTerm||`${chatDisplayTitle(t)} ${t.last_message||''} ${meta.label}`.toLowerCase().includes(searchTerm);});
    const activePrimary=active?chatPrimaryParticipant(active):{};
    const activeMeta=active?chatChannelMeta(active):null;
    const activeAvatar=active&&['general','internal'].includes(active.channelType)?`<span class="chat-channel-avatar chat-header-avatar channel-${active.channelType}">${icon(activeMeta.icon,20)}</span>`:(active?renderChatAvatar(activePrimary,chatDisplayTitle(active),'chat-header-avatar'):'');
    const composer=active&&active.canPost!==false?`<form id="chat-message-form" class="chat-composer"><input type="hidden" name="threadId" value="${active.id}"><div id="chat-file-preview" class="chat-file-preview"></div><div class="chat-composer-row"><label class="chat-attach-button" title="Inserir anexos">${icon('paperclip',20)}<input id="chat-attachment-input" name="files" type="file" multiple hidden accept="image/*,.pdf,.txt,.csv,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.zip"></label><button class="chat-voice-button" type="button" data-action="start-chat-voice" title="Digitação por voz" aria-label="Iniciar digitação por voz" aria-pressed="false">${icon('mic',20)}</button><textarea id="chat-message-input" name="body" rows="2" maxlength="2000" dir="ltr" placeholder="Escreva uma mensagem ou use o ditado..."></textarea><button class="btn btn-primary" type="button" data-action="send-chat-message">${icon('send')} Enviar</button></div><small class="chat-composer-help"><span>Enter envia · Shift/Alt + Enter quebra linha · Ctrl + Z desfaz</span><span>Até 5 arquivos, 15 MB cada.</span></small></form>`:`<div class="chat-readonly-notice">${icon('lock',18)}<span><strong>Canal somente para leitura</strong><small>Seu perfil pode acompanhar os comunicados, mas não publicar mensagens neste canal.</small></span></div>`;
    return `<div class="page-head"><div><h1>Chat</h1><p>Canais protegidos, comunicação por perfil e anexos privados.</p></div><div class="page-actions">${notificationAction}<button class="btn btn-secondary" data-action="refresh-chat">${icon('reset')} Atualizar</button>${intakeAction}${clearAction}<button class="btn btn-primary" data-action="open-new-chat">${icon('plus')} Nova conversa</button></div></div><div class="chat-channel-tabs" role="tablist" aria-label="Tipos de canal">${tabs.map(([id,label])=>`<button class="${channelFilter===id?'active':''}" data-action="chat-channel-filter" data-value="${id}" role="tab" aria-selected="${channelFilter===id}"><span>${label}</span><b>${counts[id]||0}</b></button>`).join('')}</div><section class="chat-shell"><aside class="chat-thread-panel"><div class="chat-search">${icon('search',16)}<input data-chat-search dir="ltr" autocomplete="off" autocapitalize="none" spellcheck="false" placeholder="Buscar conversa..." value="${escapeHtml(state.chatSearch||'')}"></div><div class="chat-thread-list">${threadMarkup}<div class="chat-no-results" ${anyVisible?'hidden':''}><strong>Nenhum resultado</strong><span>Revise o texto pesquisado.</span></div></div></aside><div class="chat-conversation">${active?`<header class="chat-conversation-head"><div class="chat-conversation-person">${activeAvatar}<div><strong>${escapeHtml(chatDisplayTitle(active))}</strong><small>${escapeHtml(activeMeta.description)}</small></div></div><span class="chat-channel-badge channel-${active.channelType}">${escapeHtml(activeMeta.short)}</span></header><div class="chat-message-list" id="chat-message-list">${messages.length?messages.map(m=>renderChatMessage(m,me)).join(''):`<div class="empty chat-empty-main"><div class="empty-icon">${icon('chat',24)}</div><h3>Conversa iniciada</h3><p>${escapeHtml(activeMeta.description)}</p></div>`}</div>${composer}`:`<div class="empty chat-empty-main"><div class="empty-icon">${icon('chat',24)}</div><h3>Selecione uma conversa</h3><p>As mensagens aparecerão aqui.</p></div>`}</div></section>`;
  }
  function renderNewChatModal(preselectedUserId='') {
    const me=cloudContext?.user?.id||cloud?.auth?.user?.id||'';
    const users=((state.chatUsers||[]).length?state.chatUsers:(state.accessProfiles||[])).map(u=>({userId:u.user_id||u.userId||u.authUserId||'',name:u.full_name||u.fullName||u.name||'Usuário',email:u.email||'',role:u.role||u.roleId||'user',avatarData:u.avatar_path||u.avatarData||''})).filter(u=>u.userId&&String(u.userId)!==String(me));
    const body=`<form id="new-chat-form" class="form-grid"><div class="field full"><label>Título da conversa</label><input name="title" dir="ltr" maxlength="100" placeholder="Ex.: Alinhamento sobre acolhimento"></div><div class="field full"><label>Participantes</label><div class="chat-user-picker">${users.length?users.map(u=>`<label><input type="checkbox" name="userIds" value="${u.userId}" ${String(u.userId)===String(preselectedUserId)?'checked':''}>${renderAvatar({name:u.name,avatarData:u.avatarData},'chat-avatar')}<span><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(roleLabels[u.role]||u.role)} · ${escapeHtml(u.email)}</small></span></label>`).join(''):'<p>Nenhum usuário aprovado foi localizado. Execute as migrações do chat e sincronize o banco.</p>'}</div></div></form>`;
    modalShell('Nova conversa','Selecione um ou mais participantes aprovados.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="create-chat">${icon('chat')} Criar conversa</button>`,'wide');
  }
  function renderIntakeChatModal(){
    const users=((state.chatUsers||[]).length?state.chatUsers:(state.accessProfiles||[])).map(u=>({userId:u.user_id||u.userId||u.authUserId||'',name:u.full_name||u.fullName||u.name||'Paciente',email:u.email||'',role:u.role||u.roleId||'user',avatarData:u.avatar_path||u.avatarData||''})).filter(u=>u.userId&&u.role==='patient');
    const body=`<form id="intake-chat-form" class="form-grid"><div class="field full"><label>Paciente</label><div class="chat-user-picker single-select">${users.length?users.map((u,index)=>`<label><input type="radio" name="patientUserId" value="${u.userId}" ${index===0?'required':''}>${renderAvatar({name:u.name,avatarData:u.avatarData},'chat-avatar')}<span><strong>${escapeHtml(u.name)}</strong><small>${escapeHtml(u.email)}</small></span></label>`).join(''):'<p>Nenhum paciente aprovado com acesso ao portal foi localizado.</p>'}</div></div><div class="admin-callout"><strong>Canal exclusivo</strong><p>Somente o paciente selecionado e o Gestor de Acolhimento vinculado poderão visualizar e responder às mensagens.</p></div></form>`;
    modalShell('Abrir canal de Acolhimento','Selecione o paciente para localizar ou criar a conversa privativa.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="create-intake-chat" ${users.length?'':'disabled'}>${icon('heart')} Abrir acolhimento</button>`,'wide');
  }
  function renderClearAllChatModal(){
    const body=`<div class="admin-callout danger-callout"><strong>Ação irreversível</strong><p>Todas as conversas, mensagens, anexos e notificações de chat desta clínica serão removidos para todos os usuários.</p></div><form id="clear-all-chat-form" class="form-grid"><div class="field full"><label>Digite LIMPAR para confirmar</label><input name="confirmation" autocomplete="off" required placeholder="LIMPAR"></div></form>`;
    modalShell('Limpar todas as conversas','Função exclusiva do Administrador.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-clear-all-chat">${icon('trash')} Limpar definitivamente</button>`);
  }
  function extractChatThreadId(value){
    if(typeof value==='string')return value.replace(/^"|"$/g,'').trim();
    if(Array.isArray(value))return extractChatThreadId(value[0]);
    if(value&&typeof value==='object'){
      const direct=value.id||value.thread_id||value.humanevo_create_chat_thread;
      if(direct)return String(direct);
      const candidate=Object.values(value).find(item=>typeof item==='string'&&/^[0-9a-f-]{30,}$/i.test(item));
      if(candidate)return candidate;
    }
    return '';
  }
  function chatParticipantSnapshot(userIds=[]){
    const selected=new Set(userIds.map(String));
    const source=(state.chatUsers||[]).length?state.chatUsers:(state.accessProfiles||[]);
    return source.map(u=>({
      user_id:u.user_id||u.userId||u.authUserId||'',
      full_name:u.full_name||u.fullName||u.name||'Usuário',
      email:u.email||'',
      avatar_path:u.avatar_path||u.avatarData||'',
      role:u.role||u.roleId||'user',
      role_label:u.role_label||roleLabels[u.role||u.roleId]||u.role||u.roleId||'Usuário'
    })).filter(u=>u.user_id&&selected.has(String(u.user_id)));
  }
  function filterChatThreadsInPlace(value=''){
    const term=String(value||'').trim().toLowerCase();let visible=0;
    document.querySelectorAll('.chat-thread[data-chat-filter]').forEach(item=>{const show=!term||String(item.dataset.chatFilter||'').includes(term);item.hidden=!show;if(show)visible++;});
    const empty=document.querySelector('.chat-no-results');if(empty)empty.hidden=visible>0||!(state.chatThreads||[]).length;
  }
  function previewChatAttachments(input,previewId='chat-file-preview'){
    const preview=document.getElementById(previewId);if(!preview)return;
    const files=[...(input?.files||[])];
    preview.innerHTML=files.map(file=>`<span>${icon(file.type.startsWith('image/')?'image':'paperclip',14)}<span>${escapeHtml(file.name)}</span><small>${formatChatFileSize(file.size)}</small></span>`).join('');
  }
  function showChatNotification(notification={}){
    if(!notification?.id||notification.id===lastChatNotificationId)return;lastChatNotificationId=notification.id;
    const threadId=notification.payload?.thread_id||notification.threadId||'';
    const banner=document.createElement('button');banner.type='button';banner.className='chat-notification-banner';banner.innerHTML=`<span>${icon('chat',19)}</span><span><strong>${escapeHtml(notification.title||'Nova mensagem no chat')}</strong><small>${escapeHtml(notification.message||'Você recebeu uma nova mensagem.')}</small></span>`;
    banner.addEventListener('click',()=>{banner.remove();if(threadId){state.nav='chat';state.activeChatThreadId=threadId;saveState();render();loadChatMessages(threadId,true);}});
    document.body.appendChild(banner);setTimeout(()=>banner.remove(),8000);
    if(typeof Notification!=='undefined'&&Notification.permission==='granted'){
      try{const n=new Notification(notification.title||'Humanevo · nova mensagem',{body:notification.message||'Você recebeu uma nova mensagem.',icon:state.customization?.logoData||'/assets/logo-humanevo.svg',tag:`humanevo-chat-${threadId||notification.id}`});n.onclick=()=>{window.focus();n.close();if(threadId){state.nav='chat';state.activeChatThreadId=threadId;saveState();render();loadChatMessages(threadId,true);}};}catch(_){}
    }
  }
  function processChatNotifications(rows=[]){
    const normalized=(rows||[]).map(n=>({...n,readAt:n.read_at,createdAt:n.created_at}));
    const newChat=normalized.find(n=>n.notification_type==='chat_message'&&!n.read_at&&!(state.notifications||[]).some(old=>String(old.id)===String(n.id)));
    state.notifications=normalized;
    if(newChat)queueMicrotask(()=>showChatNotification(newChat));
    chatNotificationBaselineReady=true;
  }
  async function enableChatNotifications(){
    if(typeof Notification==='undefined')return toast('Este navegador não oferece notificações do sistema. Os alertas internos continuarão ativos.','error');
    try{const permission=await Notification.requestPermission();render();toast(permission==='granted'?'Notificações do chat ativadas.':'Permissão de notificações não concedida.',permission==='granted'?'success':'error');}catch(error){toast(`Não foi possível ativar notificações: ${error.message}`,'error');}
  }
  function scrollChatToLatest(mode='auto'){
    requestAnimationFrame(()=>{const box=document.getElementById('chat-message-list');if(box)box.scrollTo({top:box.scrollHeight,behavior:mode});});
  }
  function insertChatDictation(text=''){
    const field=chatSpeechTarget||document.getElementById('chat-message-input');
    if(!field||!text)return;
    field.focus({preventScroll:true});
    const prefix=field.value&&field.selectionStart>0&&!/\s$/.test(field.value.slice(0,field.selectionStart))?' ':'';
    const value=`${prefix}${text}`;
    try{
      if(document.queryCommandSupported?.('insertText'))document.execCommand('insertText',false,value);
      else field.setRangeText(value,field.selectionStart??field.value.length,field.selectionEnd??field.value.length,'end');
    }catch(_){field.setRangeText(value,field.selectionStart??field.value.length,field.selectionEnd??field.value.length,'end');}
    field.dispatchEvent(new Event('input',{bubbles:true}));
  }
  function setChatVoiceState(active=false){
    const button=document.querySelector('[data-action="start-chat-voice"]');
    if(!button)return;
    button.classList.toggle('listening',active);button.setAttribute('aria-pressed',String(active));button.title=active?'Parar digitação por voz':'Digitação por voz';
  }
  function startChatVoiceInput(){
    const Recognition=window.SpeechRecognition||window.webkitSpeechRecognition;
    if(!Recognition)return toast('A digitação por voz não é compatível com este navegador. Use Chrome ou Edge atualizado.','error');
    if(chatSpeechRecognition){try{chatSpeechRecognition.stop();}catch(_){}chatSpeechRecognition=null;setChatVoiceState(false);return;}
    const field=document.getElementById('chat-message-input');if(!field)return;
    chatSpeechTarget=field;
    const recognition=new Recognition();chatSpeechRecognition=recognition;recognition.lang='pt-BR';recognition.continuous=true;recognition.interimResults=false;
    recognition.onstart=()=>setChatVoiceState(true);
    recognition.onresult=event=>{for(let i=event.resultIndex;i<event.results.length;i++){if(event.results[i].isFinal)insertChatDictation(String(event.results[i][0]?.transcript||'').trim());}};
    recognition.onerror=event=>{if(!['aborted','no-speech'].includes(event.error))toast(`Não foi possível reconhecer a voz: ${event.error}.`,'error');};
    recognition.onend=()=>{chatSpeechRecognition=null;chatSpeechTarget=null;setChatVoiceState(false);};
    try{recognition.start();}catch(error){chatSpeechRecognition=null;chatSpeechTarget=null;setChatVoiceState(false);toast(`Não foi possível iniciar o ditado: ${error.message}`,'error');}
  }
  async function loadChatMessages(threadId,rerender=true){
    if(!threadId)return;
    const requestId=++chatRequestSequence;
    state.activeChatThreadId=threadId;
    if(rerender&&state.nav==='chat')renderPageOnly();
    try{
      if(cloudReady()&&!isDemoAccess){
        const rows=await cloud.listChatMessages(threadId);
        if(requestId!==chatRequestSequence||String(state.activeChatThreadId)!==String(threadId))return;
        state.chatMessages=[...(state.chatMessages||[]).filter(m=>String(m.thread_id||m.threadId)!==String(threadId)),...(Array.isArray(rows)?rows:[])];
        await cloud.markChatRead(threadId).catch(()=>{});
        if(requestId!==chatRequestSequence||String(state.activeChatThreadId)!==String(threadId))return;
        const thread=chatThreadById(threadId);if(thread){thread.unread_count=0;thread.unreadCount=0;}
        const remoteNotifications=await cloud.listNotifications().catch(()=>state.notifications||[]);
        if(requestId!==chatRequestSequence||String(state.activeChatThreadId)!==String(threadId))return;
        processChatNotifications(remoteNotifications);
      }
      saveState();
      if(rerender&&state.nav==='chat'&&!isTextEntryActive()&&!state.modal)renderPageOnly();
      scrollChatToLatest('auto');
    }catch(error){
      if(requestId!==chatRequestSequence)return;
      toast(`Não foi possível carregar o chat: ${error.message}`,'error');
    }
  }
  async function createChat(){
    const form=document.getElementById('new-chat-form');if(!form?.reportValidity())return;
    const fd=new FormData(form);const userIds=fd.getAll('userIds').map(String).filter(Boolean);if(!userIds.length)return toast('Selecione pelo menos um participante.','error');
    const title=String(fd.get('title')||'').trim();const participants=chatParticipantSnapshot(userIds);
    try{
      let id='';
      if(cloudReady()&&!isDemoAccess){
        id=extractChatThreadId(await cloud.createChatThread(userIds,title,'private'));
        if(!id)throw new Error('O banco criou a conversa, mas não devolveu o identificador. Atualize a tela e tente novamente.');
        const remoteThreads=await cloud.listChatThreads().catch(()=>[]);state.chatThreads=Array.isArray(remoteThreads)?remoteThreads:[];
        if(!state.chatThreads.some(t=>String(t.id)===String(id)))state.chatThreads.unshift({id,title,participants,channel_type:'private',can_post:true,unread_count:0,last_message:'',updated_at:new Date().toISOString()});
      }else{id=uid('chat');state.chatThreads.unshift({id,title,participants,channel_type:'private',can_post:true,unread_count:0,last_message:'',updated_at:new Date().toISOString()});}
      state.chatSearch='';state.chatChannelFilter='private';state.modal=null;state.nav='chat';state.activeChatThreadId=id;saveState();render();
      await loadChatMessages(id,true);toast('Conversa privada criada.');
    }catch(error){toast(`Não foi possível criar a conversa: ${error.message}`,'error');}
  }
  async function createIntakeChat(){
    const form=document.getElementById('intake-chat-form');if(!form?.reportValidity())return;
    const patientUserId=String(new FormData(form).get('patientUserId')||'');if(!patientUserId)return toast('Selecione um paciente.','error');
    try{
      if(!cloudReady()||isDemoAccess)throw new Error('O canal de acolhimento exige conexão com o banco central.');
      const id=extractChatThreadId(await cloud.openIntakeChat(patientUserId));if(!id)throw new Error('Não foi possível identificar o canal criado.');
      const rows=await cloud.listChatThreads();state.chatThreads=Array.isArray(rows)?rows:[];state.chatChannelFilter='intake';state.chatSearch='';state.activeChatThreadId=id;state.modal=null;state.nav='chat';saveState();render();await loadChatMessages(id,true);toast('Canal de Acolhimento aberto.');
    }catch(error){toast(`Não foi possível abrir o acolhimento: ${error.message}`,'error');}
  }
  async function sendChatMessage(){
    const form=document.getElementById('chat-message-form');if(!form)return;
    const fd=new FormData(form);const threadId=String(fd.get('threadId')||'');const body=String(fd.get('body')||'').trim();const files=[...(form.querySelector('[name="files"]')?.files||[])];
    const active=chatThreadById(threadId);if(active?.canPost===false)return toast('Seu perfil possui acesso somente para leitura neste canal.','error');
    if(!body&&!files.length)return toast('Digite uma mensagem ou selecione um anexo.','error');
    if(files.length>5)return toast('Envie no máximo 5 anexos por mensagem.','error');
    if(files.some(file=>file.size>15*1024*1024))return toast('Cada anexo deve ter no máximo 15 MB.','error');
    const button=form.querySelector('[data-action="send-chat-message"]');if(button){button.disabled=true;button.innerHTML=`${icon('upload')} Enviando...`;}
    try{
      if(cloudReady()&&!isDemoAccess){
        if(files.length)await cloud.uploadChatAttachments(threadId,body,files);else await cloud.sendChatMessage(threadId,body);
        const [messages,threads,notifications]=await Promise.all([cloud.listChatMessages(threadId),cloud.listChatThreads(),cloud.listNotifications().catch(()=>state.notifications||[])]);
        if(String(state.activeChatThreadId)!==String(threadId))return;
        state.chatMessages=[...(state.chatMessages||[]).filter(m=>String(m.thread_id||m.threadId)!==String(threadId)),...(Array.isArray(messages)?messages:[])];state.chatThreads=Array.isArray(threads)?threads:state.chatThreads;processChatNotifications(notifications);
      }else{
        const localAttachments=files.map(file=>({id:uid('attachment'),file_name:file.name,mime_type:file.type,size_bytes:file.size}));state.chatMessages.push({id:uid('msg'),thread_id:threadId,sender_id:'local',sender_name:currentProfile().fullName,sender_avatar:currentProfile().avatarData,body,attachments:localAttachments,created_at:new Date().toISOString()});
        const thread=chatThreadById(threadId);if(thread){thread.last_message=body||'Anexo enviado';thread.updated_at=new Date().toISOString();thread.unread_count=0;thread.unreadCount=0;}
      }
      form.reset();const preview=document.getElementById('chat-file-preview');if(preview)preview.innerHTML='';saveState();renderPageOnly();scrollChatToLatest('smooth');toast(files.length?'Mensagem e anexos enviados.':'Mensagem enviada.');
    }catch(error){toast(`Não foi possível enviar: ${error.message}`,'error');if(button){button.disabled=false;button.innerHTML=`${icon('send')} Enviar`;}}
  }
  async function downloadChatAttachment(attachmentId){if(!attachmentId)return;try{const result=await cloud.downloadChatAttachment(attachmentId);downloadBlob(result.blob,result.filename||'anexo');toast('Download do anexo iniciado.');}catch(error){toast(`Não foi possível baixar o anexo: ${error.message}`,'error');}}
  async function clearAllChatConversations(){
    const form=document.getElementById('clear-all-chat-form');const confirmation=String(new FormData(form||document.createElement('form')).get('confirmation')||'').trim().toUpperCase();if(confirmation!=='LIMPAR')return toast('Digite LIMPAR para confirmar a exclusão.','error');
    try{const result=await cloud.clearAllChatConversations();state.chatThreads=[];state.chatMessages=[];state.activeChatThreadId='';state.chatSearch='';state.notifications=(state.notifications||[]).filter(n=>n.notification_type!=='chat_message');state.modal=null;saveState();render();toast(`${Number(result.deleted_threads||0)} conversa(s) removida(s).`);}catch(error){toast(`Não foi possível limpar as conversas: ${error.message}`,'error');}
  }
  async function refreshChatData(showToast=true){
    const requestId=++chatRequestSequence;
    try{
      if(cloudReady()&&!isDemoAccess){
        await cloud.ensureChatChannels().catch(error=>console.warn('Não foi possível sincronizar os canais padrão:',error));
        const [rows,notifications]=await Promise.all([cloud.listChatThreads(),cloud.listNotifications().catch(()=>state.notifications||[])]);
        if(requestId!==chatRequestSequence)return;
        state.chatThreads=Array.isArray(rows)?rows:[];processChatNotifications(notifications);
        if(state.activeChatThreadId&&!state.chatThreads.some(t=>String(t.id)===String(state.activeChatThreadId)))state.activeChatThreadId='';
        const matching=state.chatThreads.map(normalizeChatThread).find(t=>chatMatchesChannelFilter(t,state.chatChannelFilter||'all'));
        const nextId=state.activeChatThreadId||matching?.id||state.chatThreads[0]?.id||'';
        if(state.nav==='chat'&&nextId)await loadChatMessages(nextId,false);
      }
      saveState();if(state.nav==='chat'&&!isTextEntryActive()&&!state.modal)renderPageOnly();if(showToast)toast('Chat atualizado.');
    }catch(error){if(requestId!==chatRequestSequence)return;if(showToast)toast(`Não foi possível atualizar o chat: ${error.message}`,'error');}
  }

  function renderSupportPage() {
    const tickets=[...(state.supportTickets||[])].sort((a,b)=>new Date(b.createdAt)-new Date(a.createdAt));
    const initialType='ELOGIO';const initialMeta=supportTypeMeta[initialType];
    const typeOptions=Object.keys(supportTypeMeta).map(value=>`<option value="${value}">${value}</option>`).join('');
    const legend=Object.entries(supportTypeMeta).map(([type,meta])=>`<span class="support-legend-item ${supportTypeClass(type)}"><i></i><strong>${escapeHtml(type)}</strong><small>${escapeHtml(meta.label)}</small></span>`).join('');
    return `<div class="page-head"><div><h1>Contato com o desenvolvedor</h1><p>Envie elogios, críticas, reclamações, sugestões ou relatos de erro com evidências.</p></div></div><section class="support-layout"><article class="card support-form-card ${supportTypeClass(initialType)}"><div class="support-color-line"></div><div class="card-head"><div><h2>Novo chamado</h2><p>A identidade visual muda automaticamente conforme o tipo selecionado.</p></div><span id="support-type-indicator" class="support-type-indicator ${supportTypeClass(initialType)}"><i></i><span><strong>${initialType}</strong><small>${initialMeta.label}</small></span></span></div><div class="card-body"><div class="support-type-legend">${legend}</div><form id="support-form" class="form-grid"><div class="field"><label>Nome</label><input name="name" required></div><div class="field"><label>E-mail</label><input name="email" type="email" required></div><div class="field support-type-field"><label>Tipo de contato</label><select name="type" id="support-type">${typeOptions}</select></div><div class="field"><label>Título</label><div class="support-title-wrap"><span id="support-prefix">[ELOGIO] -</span><input name="title" id="support-title" placeholder="DESCREVA O ASSUNTO" required></div></div><div class="field full"><label>Mensagem</label><textarea name="message" required placeholder="Descreva sua experiência ou o problema encontrado."></textarea></div><div class="field full"><label>Evidências</label><input id="support-files" type="file" multiple accept="image/*,.pdf,.txt,.doc,.docx"><span class="helper">Prints, documentos e arquivos de apoio.</span><div id="support-file-preview" class="support-file-preview"></div></div></form></div><footer class="card-action-footer"><button class="btn btn-secondary" data-action="contact-whatsapp">${icon('phone')} WhatsApp</button><button class="btn btn-primary" data-action="save-support-ticket">${icon('mail')} Preparar e-mail</button></footer></article><aside class="support-side"><article class="card contact-card"><div class="card-body"><span class="contact-icon">${icon('developer',25)}</span><h2>JLM</h2><p>Suporte e evolução da plataforma Humanevo.</p><a href="mailto:Joab.mata@gmail.com">Joab.mata@gmail.com</a><a href="https://wa.me/5584988887979" target="_blank" rel="noopener">+55 84 9 88887979</a></div></article><article class="card"><div class="card-head"><h2>Chamados registrados</h2></div><div class="card-body">${tickets.length?`<div class="ticket-list">${tickets.slice(0,8).map(t=>`<div class="${supportTypeClass(t.type)}"><span class="ticket-type"><i></i>${escapeHtml(t.type)}</span><strong>${escapeHtml(t.subject)}</strong><small>${formatDate(t.createdAt)} · ${t.files.length} anexo(s)</small></div>`).join('')}</div>`:emptyState('support','Nenhum chamado registrado','Os chamados preparados aparecerão aqui.')}</div></article></aside></section>`;
  }

  function renderCalendarPage() {
    const views=[['three','Próximos 3 dias'],['workweek','Semana de trabalho'],['month','Mês'],['quarter','Trimestre'],['year','Ano']];
    const controls=`<div class="agenda-view-switch">${views.map(([id,label])=>`<button class="${state.agendaView===id?'active':''}" data-action="agenda-view" data-value="${id}">${label}</button>`).join('')}</div>`;
    let content='';
    if(state.agendaView==='three') content=renderAgendaPeriod(3,false,true);
    else if(state.agendaView==='workweek') content=renderAgendaPeriod(5,true);
    else if(state.agendaView==='quarter') content=renderQuarterView();
    else if(state.agendaView==='year') content=renderYearView();
    else content=renderMonthCalendar();
    const detail=renderCalendarDetailPanel();
    return `<div class="page-head"><div><h1>Agendamentos</h1><p>Passe o cursor para visualizar detalhes ou clique no compromisso para abrir o painel lateral.</p></div><div class="page-actions"><button class="btn btn-primary" data-action="open-appointment">${icon('plus')} Novo agendamento</button></div></div>${controls}<div class="calendar-workspace ${state.calendarDetailAppointmentId?'detail-open':''}"><div class="calendar-workspace-main">${content}</div>${detail}</div>`;
  }

  function renderMonthCalendar() {
    const cursor=new Date(`${state.calendarCursor}T12:00:00`);
    const year=cursor.getFullYear(),month=cursor.getMonth();
    const first=new Date(year,month,1); const start=new Date(year,month,1-first.getDay());
    const days=[]; for(let i=0;i<42;i++){const d=new Date(start);d.setDate(start.getDate()+i);days.push(d);}
    const monthLabel=new Intl.DateTimeFormat('pt-BR',{month:'long',year:'numeric'}).format(first);
    return `<section class="card calendar-card"><div class="calendar-head"><h2>${monthLabel.charAt(0).toUpperCase()+monthLabel.slice(1)}</h2><div class="calendar-nav"><button class="icon-btn" data-action="calendar-prev">${icon('chevronLeft')}</button><button class="btn btn-secondary btn-sm" data-action="calendar-today">Hoje</button><button class="icon-btn" data-action="calendar-next">${icon('chevronRight')}</button></div></div><div class="calendar-week">${['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'].map(x=>`<span>${x}</span>`).join('')}</div><div class="calendar-grid">${days.map(d=>renderCalendarDay(d,month)).join('')}</div></section>`;
  }

  function renderAgendaPeriod(daysCount,workWeek=false,anchorToday=false) {
    const anchorDate=anchorToday?localIsoDate():(state.selectedDate||localIsoDate());
    let start=new Date(`${anchorDate}T12:00:00`);
    if(workWeek){const day=start.getDay();const diff=day===0?-6:1-day;start.setDate(start.getDate()+diff);}
    const dates=[];let cursor=new Date(start);
    while(dates.length<daysCount){if(!workWeek||![0,6].includes(cursor.getDay()))dates.push(new Date(cursor));cursor.setDate(cursor.getDate()+1);}
    const hours=Array.from({length:11},(_,i)=>8+i);
    return `<section class="agenda-period" style="--day-count:${dates.length};--agenda-min-width:${70+(dates.length*170)}px"><div class="agenda-days-head"><div class="agenda-time-corner" aria-hidden="true"></div>${dates.map(d=>`<div><strong>${new Intl.DateTimeFormat('pt-BR',{weekday:'short'}).format(d)}</strong><span>${new Intl.DateTimeFormat('pt-BR',{day:'2-digit',month:'short'}).format(d)}</span></div>`).join('')}</div><div class="agenda-time-grid">${hours.map(hour=>`<div class="agenda-hour-label">${String(hour).padStart(2,'0')}:00</div>${dates.map(d=>{const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;const at=state.appointments.filter(a=>a.start.startsWith(`${iso}T${String(hour).padStart(2,'0')}`));return `<button class="agenda-slot" data-calendar-slot="${iso}T${String(hour).padStart(2,'0')}:00" title="Duplo clique para agendar">${at.map(a=>`<span class="slot-event appointment-${a.status}" data-action="open-appointment-panel" data-appointment-id="${a.id}" tabindex="0"><b>${formatTime(a.start)}</b>${escapeHtml(patientById(a.patientId)?.name||a.type)}</span>`).join('')}</button>`;}).join('')}`).join('')}</div></section>`;
  }

  function renderQuarterView() {
    const base=new Date(`${state.calendarCursor}T12:00:00`); const qStart=Math.floor(base.getMonth()/3)*3;
    return `<section class="period-summary-grid">${[0,1,2].map(offset=>{const d=new Date(base.getFullYear(),qStart+offset,1);const month=d.getMonth();const rows=state.appointments.filter(a=>{const ad=new Date(a.start);return ad.getFullYear()===d.getFullYear()&&ad.getMonth()===month;});return `<article class="period-card" data-calendar-slot="${d.toISOString().slice(0,10)}T09:00"><span>${new Intl.DateTimeFormat('pt-BR',{month:'long'}).format(d)}</span><strong>${rows.length}</strong><small>agendamentos</small><div class="mini-calendar-bars">${['confirmed','pending','completed','cancelled'].map(s=>`<i class="appointment-${s}" style="width:${Math.max(8,rows.filter(r=>r.status===s).length/(rows.length||1)*100)}%"></i>`).join('')}</div></article>`;}).join('')}</section>`;
  }

  function renderYearView() {
    const year=new Date(`${state.calendarCursor}T12:00:00`).getFullYear();
    return `<section class="period-summary-grid year-grid">${Array.from({length:12},(_,month)=>{const d=new Date(year,month,1);const rows=state.appointments.filter(a=>{const ad=new Date(a.start);return ad.getFullYear()===year&&ad.getMonth()===month;});return `<article class="period-card" data-calendar-slot="${year}-${String(month+1).padStart(2,'0')}-01T09:00"><span>${new Intl.DateTimeFormat('pt-BR',{month:'short'}).format(d)}</span><strong>${rows.length}</strong><small>eventos</small></article>`;}).join('')}</section>`;
  }

  function renderCalendarDay(d,currentMonth) {
    const iso=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
    const events=state.appointments.filter(a=>a.start.slice(0,10)===iso);
    const today=new Date(); const todayIso=`${today.getFullYear()}-${String(today.getMonth()+1).padStart(2,'0')}-${String(today.getDate()).padStart(2,'0')}`;
    return `<button class="calendar-day ${d.getMonth()!==currentMonth?'muted':''} ${iso===todayIso?'today':''} ${iso===state.selectedDate?'selected':''}" data-action="select-date" data-date="${iso}" data-calendar-slot="${iso}T09:00"><div class="calendar-date"><span>${d.getDate()}</span>${events.length?'<i class="event-dot"></i>':''}</div>${events.slice(0,3).map(e=>`<div class="event-chip appointment-${e.status||'confirmed'}" data-action="open-appointment-panel" data-appointment-id="${e.id}" tabindex="0">${formatTime(e.start)} ${escapeHtml(patientById(e.patientId)?.name||'Compromisso')}</div>`).join('')}</button>`;
  }

  function renderAgendaList(rows) {
    if(!rows.length) return emptyState('calendar','Agenda livre','Nenhum compromisso neste período.');
    return `<div class="agenda-list">${rows.map(a=>{const p=patientById(a.patientId);const statusMeta=appointmentVisualMeta('status',a.status);return `<div class="agenda-item appointment-row-${a.status}" data-action="open-appointment-panel" data-appointment-id="${a.id}" tabindex="0"><div class="agenda-time">${formatTime(a.start)}<small>${a.end?formatTime(a.end):''}</small></div><div class="agenda-item-main"><strong>${escapeHtml(p?.name||'Compromisso')}</strong><div class="agenda-conditional-badges"><span class="appointment-kind-badge ${appointmentToneClass('type',a.type)}">${escapeHtml(a.type)}</span><span class="appointment-kind-badge ${appointmentToneClass('mode',a.mode)}">${escapeHtml(a.mode)}</span><span class="appointment-neon-status ${appointmentToneClass('status',a.status)}"><i></i>${escapeHtml(statusMeta.label)}</span></div></div><button class="mini-icon-btn" data-action="edit-appointment" data-id="${a.id}">${icon('edit')}</button></div>`;}).join('')}</div>`;
  }

  function renderCalendarDetailPanel(){
    const appointment=(state.appointments||[]).find(item=>String(item.id)===String(state.calendarDetailAppointmentId||''));
    if(!appointment)return '';
    const patient=patientById(appointment.patientId);
    const status=appointmentVisualMeta('status',appointment.status);
    const startDate=new Date(appointment.start);
    const endDate=new Date(appointment.end||appointment.start);
    const body=`<div class="calendar-detail-person"><span class="table-avatar">${initials(patient?.name||appointment.type||'C')}</span><div><strong>${escapeHtml(patient?.name||'Compromisso')}</strong><small>${escapeHtml(appointment.type||'Consulta')}</small></div></div><div class="calendar-detail-badges"><span class="appointment-kind-badge ${appointmentToneClass('mode',appointment.mode)}">${escapeHtml(appointment.mode||'Não definida')}</span><span class="appointment-neon-status ${appointmentToneClass('status',appointment.status)}"><i></i>${escapeHtml(status.label)}</span></div><dl class="calendar-detail-list"><div><dt>Data</dt><dd>${formatDate(appointment.start,{weekday:'long',day:'2-digit',month:'long',year:'numeric'})}</dd></div><div><dt>Horário</dt><dd>${formatTime(startDate.toISOString())} às ${formatTime(endDate.toISOString())}</dd></div><div><dt>Profissional</dt><dd>${escapeHtml(appointment.professional||'Equipe Humanevo')}</dd></div><div><dt>Local ou link</dt><dd>${escapeHtml(appointment.location||'Não informado')}</dd></div><div><dt>Lembrete</dt><dd>${escapeHtml(appointment.reminder||'Não configurado')}</dd></div>${appointment.notes?`<div class="full"><dt>Observações</dt><dd>${escapeHtml(appointment.notes)}</dd></div>`:''}</dl>`;
    return `<aside class="calendar-detail-panel" aria-label="Detalhes do compromisso"><header><div><span class="admin-eyebrow">DETALHES DO EVENTO</span><h2>Compromisso</h2></div><button class="icon-btn" data-action="close-appointment-panel" aria-label="Fechar painel">${icon('close')}</button></header><div class="calendar-detail-body">${body}</div><footer><button class="btn btn-secondary" data-action="close-appointment-panel">Fechar</button><button class="btn btn-primary" data-action="edit-appointment" data-id="${appointment.id}">${icon('edit')} Editar</button></footer></aside>`;
  }

  function updateCalendarDetailPanel(){
    const workspace=document.querySelector('.calendar-workspace');
    if(!workspace)return renderPageOnly();
    const current=workspace.querySelector('.calendar-detail-panel');
    if(!state.calendarDetailAppointmentId){
      workspace.classList.remove('detail-open');
      if(current){current.classList.add('is-closing');setTimeout(()=>current.remove(),220);}
      return;
    }
    const markup=renderCalendarDetailPanel();
    workspace.classList.add('detail-open');
    if(current)current.outerHTML=markup;else workspace.insertAdjacentHTML('beforeend',markup);
  }

  function calendarTooltipHtml(appointment){
    const patient=patientById(appointment.patientId);const status=appointmentVisualMeta('status',appointment.status);
    return `<strong>${escapeHtml(patient?.name||'Compromisso')}</strong><span>${formatDate(appointment.start,{day:'2-digit',month:'long'})} · ${formatTime(appointment.start)}${appointment.end?`–${formatTime(appointment.end)}`:''}</span><div><i class="${appointmentToneClass('status',appointment.status)}"></i>${escapeHtml(status.label)} · ${escapeHtml(appointment.mode||appointment.type||'Consulta')}</div>${appointment.professional?`<small>${escapeHtml(appointment.professional)}</small>`:''}`;
  }

  function ensureCalendarTooltip(){
    if(calendarTooltipElement?.isConnected)return calendarTooltipElement;
    calendarTooltipElement=document.createElement('div');calendarTooltipElement.className='calendar-event-tooltip';calendarTooltipElement.hidden=true;document.body.appendChild(calendarTooltipElement);return calendarTooltipElement;
  }
  function showCalendarTooltip(target,event){
    const appointment=(state.appointments||[]).find(item=>String(item.id)===String(target?.dataset?.appointmentId||''));if(!appointment)return;
    const tooltip=ensureCalendarTooltip();tooltip.innerHTML=calendarTooltipHtml(appointment);tooltip.hidden=false;positionCalendarTooltip(event);
  }
  function positionCalendarTooltip(event){
    const tooltip=calendarTooltipElement;if(!tooltip||tooltip.hidden)return;
    const gap=14;const rect=tooltip.getBoundingClientRect();let left=event.clientX+gap,top=event.clientY+gap;
    if(left+rect.width>window.innerWidth-12)left=event.clientX-rect.width-gap;
    if(top+rect.height>window.innerHeight-12)top=event.clientY-rect.height-gap;
    tooltip.style.left=`${Math.max(10,left)}px`;tooltip.style.top=`${Math.max(10,top)}px`;
  }
  function hideCalendarTooltip(){if(calendarTooltipElement)calendarTooltipElement.hidden=true;}

  function emptyState(ic,title,text) { return `<div class="empty"><div class="empty-icon">${icon(ic,24)}</div><h3>${title}</h3><p>${text}</p></div>`; }

  function renderModal() {
    if(!state.modal) { modalRoot.innerHTML=''; return; }
    const m=state.modal;
    if(m.type==='patient') return renderPatientDetailModal(m.patientId);
    if(m.type==='patientForm') return renderPatientForm(m.patientId);
    if(m.type==='email') return renderEmailModal(m.patientId);
    if(m.type==='appointment') return renderAppointmentModal(m.appointmentId,m.patientId,m.date);
    if(m.type==='assessment') return renderAssessmentModal(m.assessmentId,m.patientId);
    if(m.type==='libraryInfo') return renderInfoModal();
    if(m.type==='assessmentReference') return renderAssessmentReferenceModal(m.assessmentId);
    if(m.type==='historyForm') return renderHistoryForm(m.patientId);
    if(m.type==='formBuilder') return renderFormBuilderModal();
    if(m.type==='archivePatient') return renderArchivePatientModal(m.patientId);
    if(m.type==='blockPatient') return renderBlockPatientModal(m.patientId);
    if(m.type==='customAccess') return renderCustomizationAccessModal();
    if(m.type==='assignForm') return renderAssignFormModal(m.patientId);
    if(m.type==='assignmentResponse') return renderAssignmentResponseModal(m.assignmentId);
    if(m.type==='notifications') return renderNotificationsModal();
    if(m.type==='cloudLogin') return renderCloudLoginModal();
    if(m.type==='switchUser') return renderSwitchUserModal(m.email||'');
    if(m.type==='rollback') return renderRollbackModal(m.logId);
    if(m.type==='modificationDetail') return renderModificationDetailModal(m.logId);
    if(m.type==='bulkDeletePatients') return renderBulkDeletePatientsModal(m.patientIds||[]);
    if(m.type==='accessProfileForm') return renderAccessProfileModal(m.profileId||'');
    if(m.type==='accessCredentials') return renderAccessCredentialsModal();
    if(m.type==='patientInvite') return renderPatientInviteModal();
    if(m.type==='newChat') return renderNewChatModal(m.preselectedUserId||'');
    if(m.type==='intakeChat') return renderIntakeChatModal();
    if(m.type==='restoreBackup') return renderRestoreBackupModal(m.backupId);
    if(m.type==='bulkProvisionPatients') return renderBulkProvisionPatientsModal();
    if(m.type==='bulkProvisionResult') return renderBulkProvisionResultModal();
    if(m.type==='clearAllChat') return renderClearAllChatModal();
    if(m.type==='deletePatient') return renderDeletePatientModal(m.patientId);
  }

  function modalShell(title,subtitle,body,footer='',wide='') {
    modalRoot.innerHTML=`<div class="modal-backdrop" data-modal-backdrop="true"><section class="modal ${wide}"><header class="modal-head"><div class="modal-title"><h2>${title}</h2><p>${subtitle||''}</p></div><button class="icon-btn modal-close" data-action="close-modal">${icon('close')}</button></header><div class="modal-body">${body}</div>${footer?`<footer class="modal-footer">${footer}</footer>`:''}</section></div>`;
    requestAnimationFrame(() => {
      const passwordField = modalRoot.querySelector('input[type="password"]');
      const firstField = modalRoot.querySelector('input:not([type="hidden"]), select, textarea');
      (passwordField || firstField)?.focus();
    });
  }

  function renderDeletePatientModal(patientId) {
    const patient=patientById(patientId); if(!patient) return closeModal();
    const body=`<div class="bulk-delete-warning"><span>${icon('trash',30)}</span><div><strong>Excluir ${escapeHtml(patient.name)}</strong><p>O cadastro, agendamentos, avaliações, respostas, notificações e evidências vinculadas serão removidos.</p></div></div>${patient.cloudId?`<div class="admin-callout warning-callout"><strong>Registro sincronizado</strong><p>O paciente também será excluído do banco central. A conta de autenticação não será apagada automaticamente.</p></div>`:''}<label class="confirm-danger-check"><input id="delete-patient-ack" type="checkbox"><span><strong>Confirmo a exclusão deste paciente</strong><small>Esta operação não pode ser desfeita pelo aplicativo.</small></span></label>`;
    modalShell('Excluir paciente','Confirmação administrativa de uma operação permanente.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-delete-patient" data-id="${patient.id}">${icon('trash')} Excluir paciente</button>`,'wide');
  }

  async function deleteSinglePatient(patientId) {
    if(!hasPermission('delete_patients')) return toast('Seu perfil não possui permissão para excluir pacientes.','error');
    const ack=document.getElementById('delete-patient-ack');
    if(!ack?.checked) return toast('Confirme a exclusão antes de continuar.','error');
    const patient=patientById(patientId); if(!patient) return toast('Paciente não localizado.','error');
    try {
      if(patient.cloudId){
        if(!cloudReady()) throw new Error('Conecte-se ao banco central para excluir este paciente sincronizado.');
        await cloud.deleteSinglePatient(patient.cloudId);
      }
      const id=patient.id;
      state.patients=state.patients.filter(p=>p.id!==id);
      state.appointments=state.appointments.filter(a=>a.patientId!==id);
      state.assessmentRecords=state.assessmentRecords.filter(r=>r.patientId!==id);
      state.formAssignments=(state.formAssignments||[]).filter(a=>a.patientId!==id);
      state.notifications=(state.notifications||[]).filter(n=>n.patientId!==id);
      state.selectedPatientIds=(state.selectedPatientIds||[]).filter(value=>value!==id);
      if(state.selectedPatientId===id) state.selectedPatientId=null;
      state.modal=null;
      audit('Paciente excluído','Pacientes',`${patient.name} · exclusão individual`);
      saveState();render();toast('Paciente excluído com sucesso.');
    } catch(error){toast(error.message||'Não foi possível excluir o paciente.','error');}
  }

  function renderBulkDeletePatientsModal(patientIds=[]) {
    const patients=patientIds.map(patientById).filter(Boolean);
    if(!patients.length) return closeModal();
    const cloudCount=patients.filter(p=>p.cloudId).length;
    const preview=patients.slice(0,8).map(p=>`<li><strong>${escapeHtml(p.name)}</strong><small>${escapeHtml(p.email||'Sem e-mail')}</small></li>`).join('');
    const remaining=Math.max(0,patients.length-8);
    const body=`<div class="bulk-delete-warning"><span>${icon('trash',30)}</span><div><strong>Exclusão permanente de ${patients.length} paciente(s)</strong><p>Serão removidos os cadastros clínicos selecionados, agendamentos, respostas, notificações e vínculos relacionados.</p></div></div><ul class="bulk-delete-preview">${preview}${remaining?`<li class="bulk-delete-more">+ ${remaining} paciente(s) adicional(is)</li>`:''}</ul>${cloudCount?`<div class="admin-callout warning-callout"><strong>Sincronização com o banco central</strong><p>${cloudCount} registro(s) também serão excluídos do Supabase. As contas de autenticação dos pacientes não serão apagadas automaticamente.</p></div>`:''}<label class="confirm-danger-check"><input id="bulk-delete-ack" type="checkbox"><span><strong>Confirmo que revisei a seleção</strong><small>Esta ação afeta dados clínicos e deve ser usada somente quando necessário.</small></span></label>`;
    modalShell('Excluir pacientes selecionados','Revise os registros antes de confirmar a exclusão em massa.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-bulk-delete-patients">${icon('trash')} Excluir ${patients.length} paciente(s)</button>`,'wide');
  }

  async function deletePatientsInBulk(patientIds=[]) {
    if(!hasPermission('delete_patients_bulk')) return toast('Seu perfil não possui permissão para exclusão em massa.','error');
    const ack=document.getElementById('bulk-delete-ack');
    if(!ack?.checked) return toast('Confirme que revisou a seleção antes de excluir.','error');
    const ids=[...new Set(patientIds)].filter(id=>state.patients.some(p=>p.id===id));
    const patients=ids.map(patientById).filter(Boolean);
    if(!patients.length) return toast('Nenhum paciente válido foi selecionado.','error');
    const cloudIds=patients.map(p=>p.cloudId).filter(Boolean);
    try {
      if(cloudIds.length) {
        if(!cloudReady()) throw new Error('Conecte a conta administrativa ao banco central antes de excluir pacientes sincronizados.');
        await cloud.deletePatients(cloudIds);
      }
      const idSet=new Set(ids);
      state.patients=state.patients.filter(p=>!idSet.has(p.id));
      state.appointments=state.appointments.filter(a=>!idSet.has(a.patientId));
      state.assessmentRecords=state.assessmentRecords.filter(r=>!idSet.has(r.patientId));
      state.formAssignments=(state.formAssignments||[]).filter(a=>!idSet.has(a.patientId));
      state.notifications=(state.notifications||[]).filter(n=>!idSet.has(n.patientId));
      if(idSet.has(state.selectedPatientId)) state.selectedPatientId=null;
      state.selectedPatientIds=[];
      state.modal=null;
      audit('Pacientes excluídos em massa','Pacientes',`${patients.length} registro(s): ${patients.map(p=>p.name).join(', ')}`);
      saveState();
      render();
      toast(`${patients.length} paciente(s) excluído(s) com sucesso.`);
    } catch(error) {
      toast(error.message||'Não foi possível concluir a exclusão em massa.','error');
    }
  }

  function renderSwitchUserModal(email='') {
    const body=`<form id="switch-user-form" class="form-grid"><div class="field full"><label>E-mail da conta</label><input name="email" type="email" autocomplete="username" required value="${escapeHtml(email)}" placeholder="usuario@exemplo.com"></div><div class="field full"><label>Senha</label><input name="password" type="password" autocomplete="current-password" required placeholder="Digite a senha da conta"></div><div class="field full"><div class="admin-callout"><strong>Troca autenticada</strong><p>A Humanevo encerrará a sessão atual e abrirá o ambiente correspondente ao perfil da nova conta. Nenhuma senha é recuperada ou preenchida pelo aplicativo.</p></div></div></form>`;
    modalShell('Trocar usuário','Entre com as credenciais da conta que deseja acessar.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="confirm-switch-user">${icon('switchUser')} Autenticar e trocar</button>`);
  }

  async function switchAuthenticatedUser() {
    const form=document.getElementById('switch-user-form');
    if(!form?.reportValidity()) return;
    if(!cloud?.configured) return toast('O serviço de autenticação não está configurado.','error');
    const data=Object.fromEntries(new FormData(form));
    try {
      await cloud.signOut().catch(()=>{});
      await cloud.signIn(String(data.email||'').trim().toLowerCase(),String(data.password||''));
      const nextContext=await cloud.currentContext();
      if(!nextContext?.membership) throw new Error('A conta foi autenticada, mas ainda não possui perfil vinculado.');
      if(nextContext.membership.status!=='approved') throw new Error(`O perfil está ${nextContext.membership.status==='blocked'?'bloqueado':'aguardando aprovação'}.`);
      cloudContext=nextContext;
      state.profileMenuOpen=false;
      state.modal=null;
      state.nav='dashboard';
      state.selectedPatientId=null;
      audit('Troca de usuário autenticada','Segurança',`${nextContext.profile?.full_name||nextContext.user?.email} · ${roleLabels[nextContext.membership.role]||nextContext.membership.role}`);
      saveState();
      if(nextContext.membership.role==='patient') {
        window.location.assign('/portal-paciente');
        return;
      }
      await syncCloudData(false);
      render();
      toast(`Sessão alterada para ${nextContext.profile?.full_name||nextContext.user?.email}.`);
    } catch(error) {
      cloudContext=null;
      toast(error.message||'Não foi possível trocar o usuário.','error');
      document.querySelector('#switch-user-form [name="password"]')?.select();
    }
  }

  async function logoutSession() {
    try { await cloud?.signOut?.(); } catch(_) {}
    cloudContext=null;
    sessionStorage.removeItem('humanevo_custom_unlocked');
    sessionStorage.removeItem('humanevo_demo_professional');
    sessionStorage.removeItem('humanevo_access_granted');
    sessionStorage.removeItem('humanevo_cloud_auth_v1');
    localStorage.removeItem('humanevo_cloud_auth_v1');
    window.location.replace('/');
  }

  function renderPatientDetailModal(patientId) {
    const p=patientById(patientId); if(!p) return closeModal();
    const clinical=isClinicalRole();
    const tab=state.patientDetailTab;
    const tabs=clinical?[['summary','Resumo'],['history','Histórico'],['assessments','Avaliações'],['evidences','Evidências'],['communications','Comunicação']]:[['summary','Contato'],['communications','Comunicação']];
    const safeTab=tabs.some(([id])=>id===tab)?tab:'summary';
    let content='';
    if(safeTab==='history') content=renderPatientHistory(p);
    else if(safeTab==='assessments') content=renderPatientAssessments(p);
    else if(safeTab==='evidences') content=renderPatientEvidences(p);
    else if(safeTab==='communications') content=renderPatientCommunication(p);
    else content=renderPatientSummary(p);
    const chatButton=p.authUserId&&hasPermission('chat')?`<button class="btn btn-secondary" data-action="open-patient-chat" data-id="${p.id}">${icon('chat')} Chat</button>`:'';
    modalShell('Cadastro do paciente',clinical?'Visão clínica estruturada e histórico longitudinal.':'Dados essenciais para acolhimento, contato e organização da agenda.',`<div class="patient-detail-header"><div class="patient-detail-profile"><div class="patient-detail-avatar">${initials(p.name)}</div><div><h2>${escapeHtml(p.name)}</h2><p>${ageFromBirth(p.birth)} anos · ${escapeHtml(p.email)} · ${escapeHtml(formatBrazilPhone(p.phone))}</p></div></div><span class="status-badge" ${statusInline(p.status)}>${statusLabel(p.status)}</span></div><div class="detail-tabs">${tabs.map(([id,label])=>`<button class="detail-tab ${safeTab===id?'active':''}" data-action="patient-detail-tab" data-value="${id}" data-id="${p.id}">${label}</button>`).join('')}</div>${content}`,`<button class="btn btn-secondary" data-action="open-email" data-id="${p.id}">${icon('mail')} E-mail</button><button class="btn btn-secondary" data-action="open-whatsapp-patient" data-id="${p.id}">${icon('phone')} WhatsApp</button>${chatButton}<button class="btn btn-secondary" data-action="open-appointment" data-patient="${p.id}">${icon('calendar')} Agendar</button>${clinical&&!isRepositoryStatus(p.status)?`<button class="btn btn-secondary" data-action="open-block-patient" data-id="${p.id}">${icon('lock')} Bloquear</button>`:''}${clinical&&hasPermission('delete_patients')?`<button class="btn btn-danger" data-action="open-delete-patient" data-id="${p.id}">${icon('trash')} Excluir</button>`:''}<button class="btn btn-primary" data-action="edit-patient" data-id="${p.id}">${icon('edit')} Editar cadastro</button>`,'full');
  }

  function renderPatientSummary(p) {
    if(!isClinicalRole()) return `<div class="detail-grid"><section class="info-panel"><h3>Contato e agenda</h3><dl class="kv"><dt>E-mail</dt><dd>${escapeHtml(p.email||'Não informado')}</dd><dt>Telefone</dt><dd>${escapeHtml(formatBrazilPhone(p.phone)||'Não informado')}</dd><dt>Próxima consulta</dt><dd>${p.next?`${formatDate(p.next)} às ${formatTime(p.next)}`:'Não agendada'}</dd><dt>Acesso ao portal</dt><dd>${p.authUserId?'Ativo':'Ainda não vinculado'}</dd></dl></section><section class="info-panel privacy-panel"><h3>Proteção de informações</h3><p>Endereço, conteúdo clínico, avaliações, evidências e prontuário ficam disponíveis somente para Administrador e Psicólogo.</p></section></div>`;
    return `<div class="detail-grid"><section class="info-panel"><h3>Dados pessoais e endereço</h3><dl class="kv"><dt>Data de nascimento</dt><dd>${p.birth?formatDate(p.birth):'Não informada'}</dd><dt>E-mail</dt><dd>${escapeHtml(p.email||'Não informado')}</dd><dt>Telefone</dt><dd>${escapeHtml(formatBrazilPhone(p.phone)||'Não informado')}</dd><dt>Endereço</dt><dd>${escapeHtml(formatPatientAddress(p))}</dd></dl></section><section class="info-panel"><h3>Resumo do acompanhamento</h3><dl class="kv"><dt>Demanda principal</dt><dd>${escapeHtml(p.demand)}</dd><dt>Sessões</dt><dd>${p.sessions}</dd><dt>Último contato</dt><dd>${formatDate(p.last)}</dd><dt>Próxima consulta</dt><dd>${p.next?`${formatDate(p.next)} às ${formatTime(p.next)}`:'Não agendada'}</dd><dt>Risco</dt><dd>${riskLabel(p.risk)}</dd></dl></section><section class="info-panel"><h3>Hipótese/diagnóstico</h3><p>${escapeHtml(p.diagnosis)}</p></section><section class="info-panel"><h3>Prognóstico</h3><p>${escapeHtml(p.prognosis)}</p></section><section class="info-panel"><h3>Recomendações</h3><p>${escapeHtml(p.recommendation)}</p></section><section class="info-panel"><h3>Encaminhamentos</h3><p>${escapeHtml(p.referral)}</p></section>${p.status==='blocked'?`<section class="info-panel blocked-panel"><h3>Motivo do bloqueio</h3><p>${escapeHtml(p.blockReason||'Não informado.')}</p></section>`:''}<section class="info-panel compact-status"><h3>Status atual</h3><select data-action="quick-status" data-id="${p.id}">${statusOptions(p.status)}</select></section></div>`;
  }

  function renderPatientHistory(p) {
    if(!isClinicalRole()) return emptyState('lock','Conteúdo protegido','O prontuário é exclusivo do Administrador e do Psicólogo.');
    const rows=[...(p.history||[])].sort((a,b)=>new Date(b.date)-new Date(a.date));
    return `<div class="toolbar"><div></div><button class="btn btn-primary btn-sm" data-action="open-history-form" data-id="${p.id}">${icon('plus')} Novo registro</button></div>${rows.length?`<div class="timeline">${rows.map(h=>`<div class="timeline-item"><span class="timeline-dot">${icon(h.type==='referral'?'arrow':h.type==='assessment'?'file':'activity',12)}</span><div class="timeline-card"><strong>${humanType(h.type)} · ${escapeHtml(h.title)}</strong><p>${escapeHtml(h.content)}</p><time>${formatDate(h.date)}</time></div></div>`).join('')}</div>`:emptyState('activity','Histórico vazio','Adicione o primeiro registro clínico.')}`;
  }

  function renderPatientAssessments(p) {
    if(!isClinicalRole()) return emptyState('lock','Conteúdo protegido','Avaliações são exclusivas do Administrador e do Psicólogo.');
    const records=state.assessmentRecords.filter(r=>r.patientId===p.id).sort((a,b)=>new Date(b.date)-new Date(a.date));
    const assigned=(state.formAssignments||[]).filter(a=>a.patientId===p.id||a.cloudPatientId===p.cloudId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt)));
    const statusLabels={assigned:'Enviado ao paciente',opened:'Aberto',in_progress:'Em preenchimento',submitted:'Respondido',reviewed:'Revisado',cancelled:'Cancelado'};
    return `<div class="toolbar"><div><strong>${assigned.length}</strong> formulário(s) encaminhado(s)</div><div class="inline-actions"><button class="btn btn-secondary btn-sm" data-action="copy-patient-portal" data-id="${p.id}">${icon('link')} Link do portal</button><button class="btn btn-primary btn-sm" data-action="open-assign-form" data-id="${p.id}">${icon('send')} Enviar formulário</button></div></div>
      ${assigned.length?`<div class="assignment-cockpit">${assigned.map(a=>`<article class="assignment-cockpit-row"><div class="assignment-status-dot status-${a.status}"></div><div><strong>${escapeHtml(a.formSnapshot?.title||assessmentById(a.formId)?.title||'Formulário')}</strong><span>${statusLabels[a.status]||a.status}${a.dueAt?` · prazo ${formatDate(a.dueAt)}`:''}</span></div><div class="assignment-cockpit-actions">${['submitted','reviewed'].includes(a.status)?`<button class="btn btn-secondary btn-sm" data-action="view-assignment-response" data-id="${a.id}">${icon('preview')} Ver respostas</button>`:''}<button class="mini-icon-btn" data-action="copy-assignment-link" data-id="${a.id}" title="Copiar link do portal">${icon('link')}</button></div></article>`).join('')}</div>`:emptyState('send','Nenhum formulário enviado','Encaminhe um formulário para que ele apareça como notificação no Portal do Paciente.')}
      <div class="section-divider"></div><div class="toolbar"><div><strong>Registros aplicados pelo profissional</strong></div><button class="btn btn-secondary btn-sm" data-action="nav-library-for-patient" data-id="${p.id}">${icon('plus')} Aplicar no consultório</button></div>${records.length?`<div class="grid-3">${records.map(r=>{const a=assessmentById(r.assessmentId);return `<div class="info-panel"><h3>${escapeHtml(a?.title||'Avaliação')}</h3><p style="color:var(--ink-soft);font-size:.78rem">${formatDate(r.date)} · ${escapeHtml(r.summary||'Registro concluído')}</p><button class="btn btn-secondary btn-sm" data-action="open-assessment-record" data-id="${r.id}">Ver resultado</button></div>`;}).join('')}</div>`:emptyState('file','Nenhuma avaliação registrada','Selecione uma avaliação na biblioteca e vincule ao paciente.')}`;
  }

  function renderPatientEvidences(p) {
    if(!isClinicalRole()) return emptyState('lock','Conteúdo protegido','Evidências são exclusivas do Administrador e do Psicólogo.');
    const files=p.evidences||[];
    return `<div class="evidence-toolbar"><div><h3>Evidências do processo</h3><p>Fotos, PDFs e documentos organizados no cadastro do paciente.</p></div><label class="btn btn-primary">${icon('upload')} Importar evidências<input type="file" data-evidence-patient="${p.id}" accept="image/*,.pdf,.txt,.doc,.docx" multiple hidden></label></div>${files.length?`<div class="evidence-grid">${files.map(f=>`<article class="evidence-card">${f.type?.startsWith('image/')?`<img src="${f.data}" alt="${escapeHtml(f.name)}">`:`<div class="evidence-file-icon">${icon('file',28)}<span>${escapeHtml((f.name.split('.').pop()||'DOC').toUpperCase())}</span></div>`}<div class="evidence-info"><strong>${escapeHtml(f.name)}</strong><small>${formatDate(f.createdAt)} · ${Math.round((f.size||0)/1024)} KB</small></div><div class="evidence-actions"><button class="mini-icon-btn" data-action="download-evidence" data-patient="${p.id}" data-id="${f.id}" title="Baixar">${icon('download')}</button><button class="mini-icon-btn danger-soft" data-action="delete-evidence" data-patient="${p.id}" data-id="${f.id}" title="Excluir">${icon('trash')}</button></div></article>`).join('')}</div>`:emptyState('upload','Nenhuma evidência anexada','Importe fotos ou documentos para organizar o acompanhamento.')}`;
  }

  function renderPatientCommunication(p) {
    return `<div class="detail-grid"><section class="info-panel"><h3>Contato</h3><dl class="kv"><dt>E-mail</dt><dd>${escapeHtml(p.email)}</dd><dt>Telefone</dt><dd>${escapeHtml(formatBrazilPhone(p.phone))}</dd><dt>Último contato</dt><dd>${formatDate(p.last)}</dd></dl></section><section class="info-panel message-panel"><h3>Comunicação</h3><p style="color:var(--ink-soft);font-size:.8rem">Envie o acesso, lembretes e orientações por e-mail ou WhatsApp.</p><div class="inline-actions"><button class="btn btn-primary" data-action="open-email" data-id="${p.id}">${icon('mail')} Preparar e-mail</button><button class="btn btn-secondary" data-action="open-whatsapp-patient" data-id="${p.id}">${icon('phone')} Abrir WhatsApp</button></div></section></div>`;
  }

  function renderPatientForm(patientId) {
    const p=patientId?patientById(patientId):null;
    const clinical=isClinicalRole();
    const personal=`<div class="form-section full">Dados pessoais</div><input type="hidden" name="id" value="${p?.id||''}"><div class="field"><label>Nome completo</label><input name="name" required value="${escapeHtml(p?.name||'')}"></div><div class="field"><label>Data de nascimento</label><input name="birth" type="date" value="${p?.birth||''}"></div><div class="field"><label>E-mail</label><input name="email" type="email" required value="${escapeHtml(p?.email||'')}"></div><div class="field"><label>Telefone</label><input name="phone" data-phone-mask inputmode="tel" maxlength="15" value="${escapeHtml(formatBrazilPhone(p?.phone||''))}" placeholder="(00) 00000-0000"></div>`;
    const address=`<div class="form-section full">Endereço completo</div><div class="field"><label>CEP</label><input name="addressZip" data-cep-mask inputmode="numeric" maxlength="9" value="${escapeHtml(formatCep(p?.addressZip||''))}" placeholder="00000-000"></div><div class="field"><label>Logradouro</label><input name="addressStreet" value="${escapeHtml(p?.addressStreet||'')}" placeholder="Rua, avenida, travessa..."></div><div class="field"><label>Número</label><input name="addressNumber" value="${escapeHtml(p?.addressNumber||'')}"></div><div class="field"><label>Complemento</label><input name="addressComplement" value="${escapeHtml(p?.addressComplement||'')}"></div><div class="field"><label>Bairro</label><input name="addressNeighborhood" value="${escapeHtml(p?.addressNeighborhood||'')}"></div><div class="field"><label>Cidade</label><input name="addressCity" value="${escapeHtml(p?.addressCity||'')}"></div><div class="field"><label>UF</label><input name="addressState" maxlength="2" value="${escapeHtml(p?.addressState||'')}" placeholder="MT"></div>`;
    const clinicalFields=clinical?`<div class="form-section full">Informações de acompanhamento</div><div class="field"><label>Status</label><select name="status">${statusOptions(p?.status||'active')}</select></div><div class="field"><label>Nível de atenção</label><select name="risk">${['none','low','moderate','high','critical'].map(r=>`<option value="${r}" ${p?.risk===r?'selected':''}>${riskLabel(r)}</option>`).join('')}</select></div><div class="field full"><label>Demanda principal</label><textarea name="demand">${escapeHtml(p?.demand||'')}</textarea></div><div class="field full"><label>Tags (separadas por vírgula)</label><input name="tags" value="${escapeHtml((p?.tags||[]).join(', '))}"></div><div class="field full"><label>Hipótese/diagnóstico</label><textarea name="diagnosis">${escapeHtml(p?.diagnosis||'')}</textarea></div><div class="field full"><label>Prognóstico</label><textarea name="prognosis">${escapeHtml(p?.prognosis||'')}</textarea></div><div class="field full"><label>Recomendações</label><textarea name="recommendation">${escapeHtml(p?.recommendation||'')}</textarea></div><div class="field full"><label>Encaminhamentos</label><textarea name="referral">${escapeHtml(p?.referral||'')}</textarea></div>`:`<div class="field full"><div class="admin-callout privacy-callout"><strong>Cadastro de acolhimento</strong><p>Este perfil registra somente dados pessoais e de contato. Conteúdo clínico, nível de atenção, diagnóstico, avaliações e prontuário permanecem restritos ao Administrador e ao Psicólogo.</p></div></div>`;
    const access= !p?.authUserId?`<div class="form-section full">Convite ao Portal do Paciente</div><div class="field full"><label>Após salvar, como deseja enviar o acesso?</label><div class="delivery-choice"><label><input type="radio" name="inviteChannel" value="none" checked><span>Não enviar agora</span></label><label><input type="radio" name="inviteChannel" value="email"><span>${icon('mail',15)} E-mail</span></label><label><input type="radio" name="inviteChannel" value="whatsapp"><span>${icon('phone',15)} WhatsApp</span></label></div><span class="helper">O sistema abrirá o canal escolhido com a mensagem e o link já preenchidos.</span></div>${clinical?`<div class="field full patient-access-box"><label class="toggle-control"><input type="checkbox" name="createPortalAccess"><span><strong>Criar acesso com senha temporária</strong><small>Quando desmarcado, será enviado um link para o próprio paciente criar a senha.</small></span></label><div class="patient-password-grid"><div class="field"><label>Senha provisória</label><input name="portalPassword" type="password" autocomplete="new-password" placeholder="Mínimo de 8 caracteres"></div><div class="field"><label>Confirmar senha</label><input name="portalPasswordConfirm" type="password" autocomplete="new-password" placeholder="Repita a senha"></div><button class="btn btn-secondary" type="button" data-action="generate-patient-password">${icon('key')} Gerar senha forte</button><label class="toggle-control compact-toggle"><input type="checkbox" name="forcePasswordChange" checked><span><strong>Exigir troca no primeiro acesso</strong><small>A senha temporária será substituída pelo paciente.</small></span></label></div></div>`:''}`:'';
    const body=`<form id="patient-form" class="form-grid">${personal}${address}${clinicalFields}${access}</form>`;
    modalShell(p?'Editar paciente':'Novo paciente',p?(clinical?'Atualize dados pessoais, acesso e plano clínico.':'Atualize somente os dados pessoais e de contato.'):(clinical?'Cadastre dados, defina o acesso e registre informações de acompanhamento.':'Colete os dados pessoais e escolha o canal para enviar o link de cadastro.'),body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-patient">${icon('check')} Salvar paciente</button>`,'wide');
  }

  function renderHistoryForm(patientId) {
    const body=`<form id="history-form" class="form-grid"><input type="hidden" name="patientId" value="${patientId}"><div class="field"><label>Tipo</label><select name="type">${['evolution','recommendation','diagnosis','prognosis','referral','assessment','note'].map(t=>`<option value="${t}">${humanType(t)}</option>`).join('')}</select></div><div class="field"><label>Data</label><input name="date" type="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field full"><label>Título</label><input name="title" required></div><div class="field full"><label>Registro</label><textarea name="content" required></textarea></div></form>`;
    modalShell('Novo registro clínico','Inclua evolução, recomendação, prognóstico ou encaminhamento.',body,`<button class="btn btn-secondary" data-action="back-patient" data-id="${patientId}">Cancelar</button><button class="btn btn-primary" data-action="save-history">${icon('check')} Salvar registro</button>`);
  }

  function renderEmailModal(patientId) {
    const p=patientById(patientId); const template=emailTemplates[0];
    const body=`<form id="email-form" class="form-grid"><input type="hidden" name="patientId" value="${p.id}"><div class="field full"><label>Destinatário</label><input name="to" type="email" value="${escapeHtml(p.email)}"></div><div class="field full"><label>Modelo de mensagem</label><select name="templateId" id="email-template">${emailTemplates.map(t=>`<option value="${t.id}">${t.title}</option>`).join('')}</select></div><div class="field full"><label>Assunto</label><input name="subject" id="email-subject" value="${escapeHtml(template.subject)}"></div><div class="field full"><label>Mensagem</label><textarea name="body" id="email-body" style="min-height:260px">${escapeHtml(template.body(p))}</textarea></div><div class="field full"><span class="helper">Nesta fase, o botão abre o aplicativo de e-mail do dispositivo. A integração de envio automático será conectada posteriormente.</span></div></form>`;
    modalShell('Comunicação com paciente',`Mensagem para ${escapeHtml(p.name)}`,body,`<button class="btn btn-secondary" data-action="copy-email">${icon('copy')} Copiar</button><button class="btn btn-primary" data-action="send-email">${icon('send')} Abrir no e-mail</button>`,'wide');
  }

  function renderAppointmentModal(appointmentId,patientId,date) {
    const a=appointmentId?state.appointments.find(x=>x.id===appointmentId):null;
    const slot=date||state.selectedDate||new Date().toISOString().slice(0,10);
    const startValue=a?.start||(slot.includes('T')?slot:`${slot}T09:00`);const endValue=a?.end||addMinutes(startValue,a?.duration||50);
    const selectedType=a?.type||'Consulta';const selectedMode=a?.mode||'Presencial';const selectedStatus=a?.status||'confirmed';
    const typeOptions=['Consulta','Retorno','Avaliação','Devolutiva','Orientação profissional','Entrevista inicial'];
    const modeOptions=['Presencial','Online','Híbrida'];
    const body=`<form id="appointment-form" class="form-grid"><input type="hidden" name="id" value="${a?.id||''}"><div class="field full"><label>Paciente</label><input id="appointment-patient-search" list="patient-options" placeholder="Digite para localizar o paciente" value="${escapeHtml(patientById(a?.patientId||patientId)?.name||'')}" required><input type="hidden" name="patientId" id="appointment-patient-id" value="${a?.patientId||patientId||''}"><datalist id="patient-options">${state.patients.filter(p=>!isRepositoryStatus(p.status)).map(p=>`<option data-id="${p.id}" value="${escapeHtml(p.name)}">${escapeHtml(p.email)}</option>`).join('')}</datalist></div><div class="field"><label>Início</label><input name="start" type="datetime-local" value="${startValue}" required></div><div class="field"><label>Término</label><input name="end" type="datetime-local" value="${endValue}" required></div>${renderAppointmentConditionalSelect('type','Tipo de sessão','type',typeOptions,selectedType)}${renderAppointmentConditionalSelect('mode','Modalidade','mode',modeOptions,selectedMode)}${renderAppointmentConditionalSelect('status','Status','status',appointmentStatuses,selectedStatus)}<div class="field"><label>Lembrete</label><select name="reminder">${[['none','Sem lembrete'],['2h','2 horas antes'],['24h','24 horas antes'],['48h','48 horas antes']].map(([v,l])=>`<option value="${v}" ${(a?.reminder||'24h')===v?'selected':''}>${l}</option>`).join('')}</select></div><div class="field"><label>Profissional responsável</label><input name="professional" value="${escapeHtml(a?.professional||currentProfile().fullName||'Equipe Humanevo')}"></div><div class="field"><label>Local ou link</label><input name="location" value="${escapeHtml(a?.location||'')}" placeholder="Sala, endereço ou link da videochamada"></div><div class="field full"><label>Observações/Notas</label><textarea name="notes" placeholder="Objetivo, orientações prévias ou informações relevantes.">${escapeHtml(a?.notes||'')}</textarea></div><div class="field full"><div class="appointment-portal-note">${icon('user',17)} <span>Ao salvar com o banco central conectado, este agendamento será exibido automaticamente no Portal do Paciente.</span></div></div></form>`;
    modalShell(a?'Editar agendamento':'Novo agendamento','Defina horários, modalidade, status e informações da sessão.',body,`${a?`<button class="btn btn-danger" data-action="delete-appointment" data-id="${a.id}">${icon('trash')} Excluir</button>`:''}<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-appointment">${icon('check')} Salvar</button>`);
  }

  function renderBlockPatientModal(patientId) {
    const p=patientById(patientId); if(!p) return closeModal();
    const body=`<form id="block-patient-form" class="form-grid"><input type="hidden" name="patientId" value="${p.id}"><div class="field full"><label>Motivo do bloqueio</label><textarea name="reason" required placeholder="Informe por que este paciente será temporariamente bloqueado."></textarea></div><div class="field full"><span class="helper">O paciente será movido para o repositório com status cinza e o motivo ficará registrado no histórico.</span></div></form>`;
    modalShell('Bloquear paciente',`Restrinja temporariamente o processo de ${escapeHtml(p.name)}.`,body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-danger" data-action="confirm-block-patient">${icon('lock')} Bloquear paciente</button>`);
  }

  function renderAssignFormModal(patientId) {
    const p=patientById(patientId); if(!p) return closeModal();
    const forms=allAssessments().filter(a=>a.status!=='draft');
    const body=`<form id="assign-form-form" class="form-grid"><input type="hidden" name="patientId" value="${p.id}"><div class="field full"><label>Paciente</label><input value="${escapeHtml(p.name)}" readonly></div><div class="field full"><label>Formulário</label><select name="formId" required><option value="">Selecione um formulário</option>${forms.map(f=>`<option value="${escapeHtml(f.id)}">${escapeHtml(f.title)} · ${escapeHtml(f.category||'Avaliação')}</option>`).join('')}</select></div><div class="field"><label>Prazo para resposta</label><input name="dueAt" type="datetime-local" value="${new Date(Date.now()+7*86400000).toISOString().slice(0,16)}"></div><div class="field"><label>Canal</label><select name="channel"><option value="portal">Portal do Paciente + notificação</option><option value="portal_link">Portal + copiar link</option></select></div><div class="field full"><label>Orientação ao paciente</label><textarea name="message" placeholder="Ex.: Responda com tranquilidade antes da próxima consulta."></textarea></div><div class="field full"><div class="alert info">O paciente verá uma notificação no acesso inicial e o formulário ficará disponível na lista da área dele.</div></div></form>`;
    modalShell('Enviar formulário ao paciente',`Encaminhamento digital para ${escapeHtml(p.name)}.`,body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-form-assignment">${icon('send')} Enviar formulário</button>`);
  }
  function renderAssignmentResponseModal(assignmentId) {
    const a=(state.formAssignments||[]).find(x=>x.id===assignmentId); if(!a) return closeModal();
    const p=patientById(a.patientId)||localPatientByCloudId(a.cloudPatientId); const f=a.formSnapshot||assessmentById(a.formId)||{}; const answers=a.answers||{};
    const rows=Object.entries(answers).map(([key,value])=>`<div class="response-answer"><span>${escapeHtml(key.replace(/^q_/,'Questão '))}</span><strong>${escapeHtml(Array.isArray(value)?value.join(', '):value)}</strong></div>`).join('');
    modalShell('Respostas do paciente',`${escapeHtml(p?.name||'Paciente')} · ${escapeHtml(f.title||'Formulário')}`,`<div class="response-summary"><span class="status-badge">${a.status==='reviewed'?'Revisado':'Aguardando revisão'}</span><p>Enviado em ${formatDate(a.submittedAt||a.createdAt)}.</p></div><div class="response-answer-list">${rows||'<div class="empty">Nenhuma resposta disponível.</div>'}</div><form id="review-assignment-form" class="form-grid" style="margin-top:20px"><input type="hidden" name="assignmentId" value="${a.id}"><div class="field full"><label>Síntese profissional</label><textarea name="summary">${escapeHtml(a.professionalSummary||'')}</textarea></div><div class="field full"><label>Recomendações e encaminhamentos</label><textarea name="recommendations">${escapeHtml(a.professionalRecommendations||'')}</textarea></div><div class="field full"><label class="toggle-control"><input name="release" type="checkbox"><span><strong>Liberar devolutiva ao paciente</strong><small>Gera uma nova notificação no portal.</small></span></label></div></form>`,`<button class="btn btn-secondary" data-action="close-modal">Fechar</button><button class="btn btn-primary" data-action="save-assignment-review">${icon('check')} Salvar revisão</button>`,'wide');
  }
  function renderNotificationsModal() {
    const rows=(state.notifications||[]).sort((a,b)=>String(b.createdAt||b.created_at).localeCompare(String(a.createdAt||a.created_at)));
    modalShell('Central de notificações','Mensagens do chat, formulários respondidos e atualizações do banco central.',rows.length?`<div class="notification-list">${rows.map(n=>`<button class="notification-row ${n.readAt||n.read_at?'read':''}" data-action="open-notification" data-id="${n.id}"><span class="notification-icon">${icon(n.notification_type==='chat_message'?'chat':n.notification_type==='form_submitted'?'inbox':'bell')}</span><span><strong>${escapeHtml(n.title||'Notificação')}</strong><small>${escapeHtml(n.message||'')} · ${formatDate(n.createdAt||n.created_at)}</small></span></button>`).join('')}</div>`:emptyState('bell','Nenhuma notificação','As atualizações do portal aparecerão aqui.'),`<button class="btn btn-secondary" data-action="close-modal">Fechar</button>`);
  }
  function renderCloudLoginModal() {
    const body=`<form id="cloud-login-form" class="form-grid"><div class="field full"><label>E-mail profissional</label><input name="email" type="email" autocomplete="email" value="joab.mata@gmail.com" required></div><div class="field full"><label>Senha da conta</label><input name="password" type="password" autocomplete="current-password" required></div></form>`;
    modalShell('Conectar ao banco central','Valide uma conta profissional aprovada para sincronizar pacientes, formulários e respostas.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="connect-cloud">${icon('cloud')} Conectar</button>`);
  }

  function renderCustomizationAccessModal() {
    const body=`<form id="customization-access-form" class="form-grid"><div class="field full"><label>Senha de acesso</label><input name="password" type="password" autocomplete="current-password" placeholder="Digite a senha administrativa" required></div><div class="field full"><span class="helper">A customização visual é reservada à administração da plataforma.</span></div></form>`;
    modalShell('Acesso à customização','Área protegida para alterações de identidade e configurações.',body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="unlock-customization">${icon('unlock')} Acessar</button>`);
  }

  function renderArchivePatientModal(patientId) {
    const p=patientById(patientId); if(!p) return closeModal();
    const body=`<form id="archive-patient-form" class="form-grid"><input type="hidden" name="patientId" value="${p.id}"><div class="field full"><label>Destino do processo</label><div class="option-grid"><label class="option-check"><input type="radio" name="status" value="high" checked><span><strong>Alta</strong><br><small>Objetivos alcançados ou encerramento planejado.</small></span></label><label class="option-check"><input type="radio" name="status" value="dropout"><span><strong>Desistente</strong><br><small>Interrupção do processo sem conclusão.</small></span></label></div></div><div class="field full"><label>Nota para o histórico</label><textarea name="note" placeholder="Registre o motivo e as orientações de continuidade."></textarea></div></form>`;
    modalShell('Guardar no repositório',`Arquivar o processo de ${escapeHtml(p.name)} com histórico e animação de confirmação.`,body,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="archive-patient-confirm">${icon('archive')} Guardar processo</button>`);
  }

  function renderAssessmentModal(assessmentId,patientId) {
    const a=assessmentById(assessmentId); if(!a) return closeModal();
    const patientSelect=`<div class="field full"><label>Vincular ao paciente</label><select name="patientId"><option value="">Registro sem vínculo</option>${state.patients.filter(p=>p.status==='active').map(p=>`<option value="${p.id}" ${patientId===p.id?'selected':''}>${escapeHtml(p.name)}</option>`).join('')}</select></div>`;
    let formBody='';
    if(isCustomAssessment(a)) formBody=renderCustomAssessmentForm(a,patientSelect);
    else if(a.template==='temperaments') formBody=renderTemperamentForm(a,patientSelect);
    else formBody=renderStructuredAssessmentForm(a,patientSelect);
    modalShell(a.title,`${a.category} · ${a.description}`,formBody,`<button class="btn btn-secondary" data-action="close-modal">Cancelar</button><button class="btn btn-primary" data-action="save-assessment" data-id="${a.id}">${icon('check')} Salvar avaliação</button>`,'full');
  }

  function renderStructuredAssessmentForm(a,patientSelect) {
    const schema=templateSchemas[a.template]||templateSchemas.clinical;
    return `<form id="assessment-form" class="form-grid"><input type="hidden" name="assessmentId" value="${a.id}">${patientSelect}<div class="field"><label>Data</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Profissional responsável</label><input name="professional" value="Equipe Humanevo"></div><div class="field full"><label>Objetivo específico</label><textarea name="objective" placeholder="Descreva o objetivo e a pergunta clínica que orientam esta avaliação."></textarea></div><div class="field full"><div class="form-section">Formulário específico</div></div>${schema.map(([label,type,options],i)=>renderSchemaField(label,type,options,i)).join('')}<div class="field full"><div class="form-section">Síntese e conduta</div></div><div class="field full"><label>Síntese profissional</label><textarea name="summary" placeholder="Integre os achados com entrevista, observação e demais fontes."></textarea></div><div class="field full"><label>Recomendações e encaminhamentos</label><textarea name="recommendations"></textarea></div><div class="field full"><span class="helper">Este formulário organiza informações profissionais e não produz diagnóstico automático.</span></div></form>`;
  }

  function renderSchemaField(label,type,options,i) {
    const name=`field_${i}`;
    if(type==='textarea') return `<div class="field full"><label>${escapeHtml(label)}</label><textarea name="${name}"></textarea></div>`;
    if(type==='select') return `<div class="field"><label>${escapeHtml(label)}</label><select name="${name}"><option value="">Selecione</option>${options.map(o=>`<option>${escapeHtml(o)}</option>`).join('')}</select></div>`;
    if(type==='range') return `<div class="field"><label>${escapeHtml(label)} (0 a 10)</label><input name="${name}" type="range" min="0" max="10" value="5"><span class="helper">0 = mínimo · 10 = máximo</span></div>`;
    return `<div class="field"><label>${escapeHtml(label)}</label><input name="${name}"></div>`;
  }

  function renderTemperamentForm(a,patientSelect) {
    return `<form id="assessment-form"><input type="hidden" name="assessmentId" value="${a.id}"><div class="form-grid">${patientSelect}<div class="field"><label>Data</label><input type="date" name="date" value="${new Date().toISOString().slice(0,10)}"></div><div class="field"><label>Profissional responsável</label><input name="professional" value="Equipe Humanevo"></div><div class="field full"><label>Observação inicial</label><textarea name="objective" placeholder="Contexto de aplicação e objetivo profissional."></textarea></div></div><div class="form-section">Questionário dos 4 Temperamentos</div><p style="color:var(--ink-soft);font-size:.82rem">Responda considerando a inclinação natural. Para as questões 1 a 48: Sim, Não ou Dúvida. Nas questões 49 e 50, selecione uma ou duas opções.</p><div class="questionnaire">${temperamentQuestions.map(q=>renderTemperamentQuestion(q)).join('')}</div><div id="temperament-score-preview"></div><div class="form-grid" style="margin-top:20px"><div class="field full"><label>Síntese profissional</label><textarea name="summary" placeholder="Interpretação contextual e não diagnóstica."></textarea></div><div class="field full"><label>Recomendações</label><textarea name="recommendations"></textarea></div></div></form>`;
  }

  function renderTemperamentQuestion(q) {
    if(q.n<49) return `<div class="question-row"><p><strong>${q.n}.</strong> ${escapeHtml(q.text)}</p><div class="answer-options"><label><input type="radio" name="q${q.n}" value="yes"><span>Sim</span></label><label><input type="radio" name="q${q.n}" value="no"><span>Não</span></label><label><input type="radio" name="q${q.n}" value="doubt"><span>Dúvida</span></label></div></div>`;
    const options=q.n===49?[['a','Obstinação, raiva, orgulho'],['b','Preguiça, falta de energia'],['c','Falta de coragem, evasão do sofrimento'],['d','Verborreia, falta de coerência']]:[['a','Bom caráter, tranquilo'],['b','Empatia, amor pela solidão e reflexão'],['c','Vontade firme, energia, audácia, ambição'],['d','Alegria e facilidade para lidar com pessoas difíceis']];
    return `<div class="question-row"><p><strong>${q.n}.</strong> ${escapeHtml(q.text.split('a)')[0])}</p><div class="option-grid">${options.map(([v,label])=>`<label class="option-check"><input type="checkbox" name="q${q.n}" value="${v}"><span><strong>${v.toUpperCase()}.</strong> ${escapeHtml(label)}</span></label>`).join('')}</div><span class="helper">Selecione no máximo duas opções.</span></div>`;
  }

  function renderInfoModal() {
    modalShell('Governança da biblioteca','Uso responsável de avaliações e instrumentos',`<div class="detail-grid"><section class="info-panel"><h3>Formulários profissionais</h3><p>Os modelos organizam entrevista, observação, histórico e síntese clínica.</p></section><section class="info-panel"><h3>Instrumentos específicos</h3><p>Antes de incorporar itens protegidos, valide licença, público e modalidade de aplicação.</p></section><section class="info-panel"><h3>Resultados integrados</h3><p>Resultados devem ser interpretados com entrevista, contexto e julgamento profissional.</p></section></div>`,`<button class="btn btn-primary" data-action="close-modal">Entendi</button>`);
  }

  function applyDeferredExternalState(){
    if(!deferredExternalState||state.modal||isTextEntryActive())return false;
    state=deferredExternalState;deferredExternalState=null;stateHydrated=true;lastAuditableSnapshot=captureAuditableState();render();return true;
  }
  function closeModal() {
    if(bulkProvisionRunning&&state.modal?.type==='bulkProvisionPatients')return toast('Aguarde a conclusão da migração em lote.','error');
    if(state.modal?.type==='accessProfileForm'){pendingProfileAvatarData='';state.adminProfileDraftId=null;}
    if(state.modal?.type==='accessCredentials') pendingCredentialData=null;
    if(state.modal?.type==='patientInvite') pendingPatientInviteData=null;
    if(['bulkProvisionPatients','bulkProvisionResult'].includes(state.modal?.type)){pendingBulkCredentials=[];bulkProvisionRunning=false;}
    if(chatSpeechRecognition){try{chatSpeechRecognition.stop();}catch(_){}chatSpeechRecognition=null;chatSpeechTarget=null;}
    const backdrop=modalRoot.querySelector('.modal-backdrop');state.modal=null;saveState();
    const reduced=window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches;
    if(backdrop&&state.customization?.animations!==false&&!reduced){backdrop.classList.add('is-closing');setTimeout(()=>{if(!state.modal)modalRoot.innerHTML='';applyDeferredExternalState();},190);}
    else{modalRoot.innerHTML='';applyDeferredExternalState();}
  }

  async function savePatient() {
    const form=document.getElementById('patient-form'); if(!form?.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form));
    const existing=data.id?patientById(data.id):null;
    const clinical=isClinicalRole();
    const createPortalAccess=clinical&&!!form.querySelector('[name="createPortalAccess"]')?.checked;
    const portalPassword=String(data.portalPassword||'').trim();
    const portalPasswordConfirm=String(data.portalPasswordConfirm||'').trim();
    const inviteChannel=String(data.inviteChannel||'none');
    const forcePasswordChange=!!form.querySelector('[name="forcePasswordChange"]')?.checked;
    if(!String(data.email||'').includes('@')) return toast('Informe um e-mail válido para o paciente.','error');
    if(inviteChannel==='whatsapp'&&normalizePhoneDigits(data.phone).length<10) return toast('Informe um telefone com DDD para enviar o convite pelo WhatsApp.','error');
    if(createPortalAccess&&portalPassword!==portalPasswordConfirm) return toast('A confirmação da senha provisória não confere.','error');
    if(createPortalAccess&&portalPassword.length<8) return toast('Informe ou gere uma senha provisória com pelo menos 8 caracteres.','error');
    const preserve=(key,fallback='')=>data[key]!==undefined?data[key]:(existing?.[key]??fallback);
    const patient={
      id:existing?.id||uid('p'),cloudId:existing?.cloudId||'',authUserId:existing?.authUserId||'',
      name:String(data.name||'').trim(),email:String(data.email||'').trim().toLowerCase(),phone:formatBrazilPhone(data.phone),birth:data.birth||'',
      addressZip:formatCep(data.addressZip),addressStreet:String(data.addressStreet||'').trim(),addressNumber:String(data.addressNumber||'').trim(),addressComplement:String(data.addressComplement||'').trim(),addressNeighborhood:String(data.addressNeighborhood||'').trim(),addressCity:String(data.addressCity||'').trim(),addressState:String(data.addressState||'').trim().toUpperCase().slice(0,2),
      status:preserve('status','active'),risk:preserve('risk','none'),demand:preserve('demand',''),tags:data.tags!==undefined?String(data.tags||'').split(',').map(x=>x.trim()).filter(Boolean):(existing?.tags||[]),
      next:existing?.next||null,last:existing?.last||new Date().toISOString().slice(0,10),sessions:existing?.sessions||0,
      diagnosis:preserve('diagnosis',''),prognosis:preserve('prognosis',''),recommendation:preserve('recommendation',''),referral:preserve('referral',''),history:existing?.history||[],evidences:existing?.evidences||[],blockReason:existing?.blockReason||'',treatmentProgress:existing?.treatmentProgress||35
    };
    let accountCreated=false; let accountWarning='';
    if(createPortalAccess){
      if(!cloudReady()) accountWarning='Paciente salvo, mas o acesso não foi criado: conecte uma conta profissional ao banco central.';
      else {
        try {
          const created=await cloud.createManagedUser({email:patient.email,password:portalPassword,fullName:patient.name,role:'patient',status:'approved',forcePasswordChange});
          patient.authUserId=created?.user?.id||created?.user_id||patient.authUserId;
          accountCreated=true;
        } catch(error) { accountWarning=`Paciente salvo, mas o acesso ao portal não foi criado: ${error.message}`; }
      }
    }
    if(existing) state.patients=state.patients.map(p=>p.id===patient.id?patient:p); else state.patients.unshift(patient);
    let synchronized=false;
    try {
      if(cloudReady()) { const result=await cloud.upsertPatient(patient); const row=Array.isArray(result)?result[0]:result; if(row?.id){patient.cloudId=row.id;patient.authUserId=row.user_id||patient.authUserId;synchronized=true;} }
    } catch(error) { console.warn(error); accountWarning=accountWarning||`Paciente salvo localmente. Sincronização pendente: ${error.message}`; }
    audit(existing?'Cadastro de paciente alterado':'Paciente cadastrado','Pacientes',`${patient.name}${accountCreated?' · acesso criado':''}${currentRole()==='intake_manager'?' · dados pessoais pelo acolhimento':''}`); saveState();
    if(accountWarning) toast(accountWarning,'warning'); else toast(accountCreated?'Paciente, acesso e vínculo criados no Supabase.':synchronized?'Paciente salvo e sincronizado.':'Paciente salvo com sucesso.');
    state.selectedPatientId=patient.id;
    if(!existing&&(inviteChannel!=='none'||accountCreated)){
      pendingPatientInviteData={name:patient.name,email:patient.email,phone:patient.phone,channel:inviteChannel,password:accountCreated?portalPassword:'',forcePasswordChange,accessUrl:patientAccessUrl(),signupUrl:patientSignupUrl(patient)};
      state.modal={type:'patientInvite'};
      renderModal();
    } else { state.modal={type:'patient',patientId:patient.id}; render(); }
  }

  function saveHistory() {
    const form=document.getElementById('history-form'); if(!form.reportValidity()) return;
    const data=Object.fromEntries(new FormData(form)); const p=patientById(data.patientId); if(!p) return;
    p.history=p.history||[]; p.history.unshift({id:uid('h'),type:data.type,title:data.title,date:data.date,content:data.content}); p.last=data.date;
    if(data.type==='recommendation') p.recommendation=data.content;
    if(data.type==='diagnosis') p.diagnosis=data.content;
    if(data.type==='prognosis') p.prognosis=data.content;
    if(data.type==='referral') p.referral=data.content;
    audit('Registro clínico incluído','Prontuário',`${p.name} · ${humanType(data.type)}`); saveState(); toast('Registro clínico salvo.'); state.modal={type:'patient',patientId:p.id}; state.patientDetailTab='history'; render();
  }

  async function saveAppointment() {
    const form=document.getElementById('appointment-form'); if(!form?.reportValidity()) return;
    const d=Object.fromEntries(new FormData(form));
    const typedName=document.getElementById('appointment-patient-search')?.value.trim()||'';
    const found=state.patients.find(p=>String(p.name||'').toLowerCase()===typedName.toLowerCase());
    const patientId=found?.id||d.patientId;
    if(!patientId) return toast('Selecione um paciente válido.','error');
    if(new Date(d.end)<=new Date(d.start)) return toast('O término deve ser posterior ao início.','error');
    const existing=d.id?state.appointments.find(a=>a.id===d.id):null;
    const duration=Math.max(1,Math.round((new Date(d.end)-new Date(d.start))/60000));
    const item={id:existing?.id||uid('a'),cloudId:existing?.cloudId||'',patientId,start:d.start,end:d.end,duration,type:d.type,mode:d.mode,status:d.status,professional:d.professional,location:d.location,reminder:d.reminder,notes:d.notes};
    let synchronized=false;let warning='';
    const patient=patientById(patientId);
    if(cloudReady()){
      if(!patient?.cloudId) warning='Agendamento salvo localmente. O paciente ainda não possui vínculo sincronizado com o Supabase.';
      else {
        try{
          const rows=await cloud.upsertAppointment({cloudId:item.cloudId,clinicId:cloudContext.membership.clinic_id,patientId:patient.cloudId,professionalId:cloudContext.user.id,start:item.start,end:item.end,type:item.type,mode:item.mode,status:item.status,location:item.location,notes:item.notes,reminder:item.reminder});
          const row=Array.isArray(rows)?rows[0]:rows;if(row?.id)item.cloudId=row.id;synchronized=!!row?.id;
        }catch(error){warning=`Agendamento salvo localmente, mas não apareceu no Portal do Paciente: ${error.message}`;}
      }
    } else warning='Agendamento salvo localmente. Conecte o banco central para exibi-lo no Portal do Paciente.';
    if(existing) state.appointments=state.appointments.map(a=>a.id===item.id?item:a); else state.appointments.push(item);
    state.appointments.sort((a,b)=>a.start.localeCompare(b.start));
    if(patient){const future=state.appointments.filter(a=>a.patientId===patient.id&&new Date(a.start)>=new Date()&&a.status!=='cancelled').sort((a,b)=>a.start.localeCompare(b.start));patient.next=future[0]?.start||null;}
    audit(existing?'Agendamento alterado':'Agendamento criado','Agenda',`${patient?.name||patientId} · ${item.start} · ${item.type} · ${item.mode}`); saveState();
    closeModal();render();
    if(warning)toast(warning,'warning');else toast(synchronized?'Agendamento salvo e disponibilizado no Portal do Paciente.':'Agendamento salvo.');
  }

  async function deleteAppointment(appointmentId) {
    const appointment=state.appointments.find(item=>item.id===appointmentId);if(!appointment)return;
    try{if(appointment.cloudId&&cloudReady())await cloud.deleteAppointment(appointment.cloudId);}catch(error){return toast(`Não foi possível excluir o agendamento do banco central: ${error.message}`,'error');}
    state.appointments=state.appointments.filter(item=>item.id!==appointmentId);audit('Agendamento excluído','Agenda',`${patientById(appointment.patientId)?.name||appointment.patientId} · ${appointment.start}`);saveState();toast('Agendamento excluído.');closeModal();render();
  }

  function scoreTemperaments(formData) {
    const yes=new Set(); const doubts=[];
    for(let i=1;i<=48;i++){const v=formData.get(`q${i}`);if(v==='yes')yes.add(String(i));if(v==='doubt')doubts.push(i);}
    [49,50].forEach(n=>formData.getAll(`q${n}`).slice(0,2).forEach(v=>yes.add(`${n}${v}`)));
    const scores={}; Object.entries(temperamentScores).forEach(([key,items])=>scores[key]=items.filter(i=>yes.has(i)).length);
    return {scores,doubts,answered:[...yes]};
  }

  function formDataToObject(fd) {
    const out={};
    for(const [key,value] of fd.entries()) {
      if(Object.prototype.hasOwnProperty.call(out,key)) out[key]=Array.isArray(out[key])?[...out[key],value]:[out[key],value];
      else out[key]=value;
    }
    return out;
  }

  function saveAssessment(assessmentId) {
    const form=document.getElementById('assessment-form'); if(!form||!form.reportValidity()) return; const fd=new FormData(form); const a=assessmentById(assessmentId); if(!a) return;
    let summary=fd.get('summary')||''; let result=null;
    if(a.template==='temperaments') { result=scoreTemperaments(fd); const labels={colerico:'Colérico',sanguineo:'Sanguíneo',melancolico:'Melancólico',fleumatico:'Fleumático'}; const ordered=Object.entries(result.scores).sort((x,y)=>y[1]-x[1]); summary=summary||`Predominância indicativa: ${labels[ordered[0][0]]} (${ordered[0][1]} pontos). Resultado complementar e não diagnóstico.`; }
    if(isCustomAssessment(a)&&!summary) summary=`Formulário ${a.title} concluído com ${Object.keys(formDataToObject(fd)).filter(k=>k.startsWith('custom_')).length} resposta(s) registradas.`;
    const record={id:uid('ar'),assessmentId,patientId:fd.get('patientId')||'',date:fd.get('date')||new Date().toISOString().slice(0,10),summary,recommendations:fd.get('recommendations')||'',result,fields:formDataToObject(fd)};
    state.assessmentRecords.push(record);
    if(record.patientId){const patient=patientById(record.patientId);patient.history=patient.history||[];patient.history.unshift({id:uid('h'),type:'assessment',title:a.title,date:record.date,content:summary||'Avaliação registrada.'});patient.last=record.date;}
    audit('Avaliação registrada','Avaliações',`${a.title} · ${patientById(record.patientId)?.name||'Sem paciente'}`); saveState(); toast('Avaliação registrada com sucesso.'); closeModal(); render();
  }

  function updateTemperamentPreview() {
    const form=document.getElementById('assessment-form'); const target=document.getElementById('temperament-score-preview'); if(!form||!target) return;
    const result=scoreTemperaments(new FormData(form)); const labels={colerico:'Colérico',sanguineo:'Sanguíneo',melancolico:'Melancólico',fleumatico:'Fleumático'}; const max=Math.max(1,...Object.values(result.scores));
    target.innerHTML=`<div class="form-section">Prévia dos resultados</div><div class="score-grid">${Object.entries(result.scores).map(([k,v])=>`<div class="score-card"><strong>${labels[k]}</strong><span>${v}</span><div class="score-bar"><i style="width:${Math.round(v/max*100)}%"></i></div></div>`).join('')}</div>${result.doubts.length?`<p class="helper" style="margin-top:10px">Questões marcadas para revisão: ${result.doubts.join(', ')}.</p>`:''}`;
  }

  function copyEmail() {
    const subject=document.getElementById('email-subject').value; const body=document.getElementById('email-body').value;
    navigator.clipboard?.writeText(`Assunto: ${subject}\n\n${body}`).then(()=>toast('Mensagem copiada.')).catch(()=>toast('Não foi possível copiar.','error'));
  }
  function sendEmail() {
    const form=document.getElementById('email-form'); const d=Object.fromEntries(new FormData(form)); window.location.href=`mailto:${encodeURIComponent(d.to)}?subject=${encodeURIComponent(d.subject)}&body=${encodeURIComponent(d.body)}`;
  }


  async function saveFormAssignment() {
    const form=document.getElementById('assign-form-form'); if(!form?.reportValidity()) return;
    const d=Object.fromEntries(new FormData(form)); const patient=patientById(d.patientId); const assessment=assessmentById(d.formId); if(!patient||!assessment)return;
    const local={id:uid('fa'),patientId:patient.id,cloudPatientId:patient.cloudId||'',formId:assessment.id,status:'assigned',dueAt:d.dueAt||'',message:d.message||'',createdAt:new Date().toISOString(),answers:{},formSnapshot:formSnapshot(assessment)};
    try {
      if(cloudReady()&&patient.cloudId){const cloudFormId=await ensureCloudForm(assessment);const rows=await cloud.assignForm(patient.cloudId,cloudFormId,d.dueAt?new Date(d.dueAt).toISOString():null,d.message||'');local.id=rows?.id||rows?.[0]?.id||local.id;local.cloud=true;local.cloudFormId=cloudFormId;}
      state.formAssignments=state.formAssignments||[];state.formAssignments.unshift(local);state.notifications=state.notifications||[];state.notifications.unshift({id:uid('note'),patientId:patient.id,recipientRole:'patient',type:'form_assigned',title:'Novo formulário disponível',message:d.message||assessment.title,createdAt:new Date().toISOString(),readAt:null,assignmentId:local.id});audit('Formulário enviado ao paciente','Formulários',`${patient.name} · ${assessment.title}`);saveState();closeModal();state.modal={type:'patient',patientId:patient.id};state.patientDetailTab='assessments';render();toast('Formulário enviado ao Portal do Paciente.');
    } catch(error){toast(error.message,'error');}
  }
  async function saveAssignmentReview() {
    const form=document.getElementById('review-assignment-form');if(!form?.reportValidity())return;const d=Object.fromEntries(new FormData(form));const a=(state.formAssignments||[]).find(x=>x.id===d.assignmentId);if(!a)return;
    a.professionalSummary=d.summary||'';a.professionalRecommendations=d.recommendations||'';a.status='reviewed';a.reviewedAt=new Date().toISOString();
    try {if(a.cloud&&cloudReady())await cloud.rpc('humanevo_review_form_response',{assignment_uuid:a.id,summary_text:a.professionalSummary,recommendations_text:a.professionalRecommendations,release_to_patient:!!d.release});if(d.release){state.notifications.unshift({id:uid('note'),patientId:a.patientId,recipientRole:'patient',type:'result_released',title:'Resultado revisado disponível',message:a.formSnapshot?.title||'Formulário',createdAt:new Date().toISOString(),readAt:null,assignmentId:a.id});}audit('Resposta revisada','Formulários',a.formSnapshot?.title||a.formId);saveState();closeModal();toast('Revisão salva.');render();}catch(error){toast(error.message,'error');}
  }
  function patientPortalUrl(patientId) { const base=new URL(window.HUMANEVO_CONFIG?.PATIENT_PORTAL_PATH||'/portal-paciente',location.href); const p=patientById(patientId); if(!cloudReady()||!p?.cloudId)base.searchParams.set('demo',patientId); return base.href; }
  async function copyText(value,message='Link copiado.') { try{await navigator.clipboard.writeText(value);toast(message);}catch(_){const area=document.createElement('textarea');area.value=value;document.body.appendChild(area);area.select();document.execCommand('copy');area.remove();toast(message);} }
  async function setCloudProfileStatus(userId,status) { const role=document.querySelector(`[data-cloud-role="${userId}"]`)?.value||null; try{await cloud.setMembershipStatus(userId,status,role);await syncCloudData(false);render();const labels={approved:'Acesso aprovado com sucesso.',rejected:'Solicitação rejeitada.',blocked:'Usuário bloqueado.'};toast(labels[status]||'Status atualizado.');}catch(error){toast(error.message,'error');} }
  async function updateRolePermission(roleId,permissionKey,allowed) {
    if(currentRole()!=='administrator') return toast('Somente o Administrador pode alterar permissões por perfil.','error');
    if(roleId==='administrator'&&permissionKey==='administration'&&!allowed) return toast('A administração do perfil Administrador não pode ser removida.','error');
    state.rolePermissions[roleId]=state.rolePermissions[roleId]||{};
    state.rolePermissions[roleId][permissionKey]=!!allowed;
    saveState();render();
    try{if(cloudReady()){await cloud.upsertRolePermission(roleId,permissionKey,!!allowed);const rows=await cloud.getMyPermissions().catch(()=>null);if(Array.isArray(rows))cloudEffectivePermissions=Object.fromEntries(rows.map(row=>[row.permission_key,row.allowed===true]));}toast('Permissão do perfil atualizada.');}catch(error){toast(`Permissão salva localmente, mas o banco central respondeu: ${error.message}`,'warning');}
  }
  async function updateUserPermission(profileId,permissionKey,value) {
    if(currentRole()!=='administrator') return toast('Somente o Administrador pode alterar exceções individuais.','error');
    const profile=state.accessProfiles.find(item=>item.id===profileId);if(!profile)return;
    if(profile.locked&&permissionKey==='administration'&&value==='false') return toast('A conta administrativa principal é protegida contra bloqueio.','error');
    const key=permissionSubjectKey(profile);state.userPermissionExceptions[key]=state.userPermissionExceptions[key]||{};
    if(value==='inherit') delete state.userPermissionExceptions[key][permissionKey]; else state.userPermissionExceptions[key][permissionKey]=value==='true';
    if(!Object.keys(state.userPermissionExceptions[key]).length) delete state.userPermissionExceptions[key];
    saveState();render();
    try{if(cloudReady()&&profile.authUserId){await cloud.setUserPermission(profile.authUserId,permissionKey,value==='inherit'?null:value==='true');if(profile.authUserId===cloudContext?.user?.id){const rows=await cloud.getMyPermissions().catch(()=>null);if(Array.isArray(rows))cloudEffectivePermissions=Object.fromEntries(rows.map(row=>[row.permission_key,row.allowed===true]));}}toast('Exceção do usuário atualizada.');}catch(error){toast(`Exceção salva localmente, mas o banco central respondeu: ${error.message}`,'warning');}
  }

  async function connectCloud() { const form=document.getElementById('cloud-login-form');if(!form?.reportValidity())return;const d=Object.fromEntries(new FormData(form));try{await cloud.signIn(d.email,d.password);cloudContext=await cloud.currentContext();if(!cloudContext?.membership||cloudContext.membership.status!=='approved')throw new Error('A conta ainda não foi aprovada no banco central.');closeModal();await syncCloudData();state.nav='customization';render();}catch(error){toast(error.message,'error');} }

  function saveCustomForm(stay=false) {
    const draft=captureFormBuilderDraft(); if(!draft) return;
    const meta=document.getElementById('form-builder-meta'); if(meta&&!meta.reportValidity()) return;
    if(!draft.title?.trim()) return toast('Informe o título do formulário.','error');
    if(!draft.id) draft.id=uid('custom-form');
    Object.assign(draft,ensureMinimumQuestionDepth(draft));
    if(!stay) draft.status='active';
    draft.custom=true; draft.template='custom'; draft.access='Customizado'; draft.source='Criado no Humanevo Studio'; draft.updatedAt=new Date().toISOString();
    const existing=state.customForms.find(f=>f.id===draft.id);
    if(existing) state.customForms=state.customForms.map(f=>f.id===draft.id?structuredClone(draft):f);
    else state.customForms.unshift(structuredClone(draft));
    audit(existing?'Formulário alterado':'Formulário criado','Studio de formulários',draft.title); saveState(); toast(stay?'Rascunho salvo.':'Formulário salvo na biblioteca.');
    if(stay){state.modal={type:'formBuilder',draft:structuredClone(draft)};renderModal();}
    else {state.modal=null;state.nav='forms';render();}
  }

  function deleteCustomForm(id) {
    const form=state.customForms.find(f=>f.id===id); if(!form) return;
    state.customForms=state.customForms.filter(f=>f.id!==id);
    audit('Formulário excluído','Studio de formulários',form.title); saveState(); toast(`Formulário “${form.title}” excluído.`); render();
  }

  function archivePatient(patientId,status,note='') {
    const patient=patientById(patientId); if(!patient) return;
    const card=document.querySelector(`[data-patient-id="${patientId}"]`);
    if(card) card.classList.add('is-archiving');
    state.modal=null; renderModal();
    setTimeout(()=>{
      patient.status=status;
      patient.next=null;
      patient.history=patient.history||[];
      patient.history.unshift({id:uid('h'),type:status==='high'?'discharge':'dropout',title:status==='high'?'Alta registrada':'Desistência registrada',date:new Date().toISOString().slice(0,10),content:note||`Processo guardado no repositório como ${statusLabel(status).toLowerCase()}.`});
      state.nav='repository'; state.patientRepository=status; audit('Paciente movido para o repositório','Pacientes',`${patient.name} · ${statusLabel(status)}`); saveState(); render(); toast('Processo guardado no repositório.');
    }, state.customization?.animations===false?0:520);
  }

  function refreshBuilderPreview() {
    const draft=captureFormBuilderDraft();
    const container=document.querySelector('.builder-preview');
    if(container&&draft) container.innerHTML=`<div class="builder-section-head"><div><h3>Pré-visualização</h3><span class="helper">Representação do formulário para o paciente.</span></div></div>${renderBuilderPreview(draft)}`;
  }

  function addQuestion(type) {
    const draft=captureFormBuilderDraft(); if(!draft) return;
    const base={id:uid('q'),type,label:questionTypes[type]?.label||'Nova pergunta',help:'',required:false,options:[],pairs:[],min:type==='rating'?1:0,max:type==='rating'?5:10,minLabel:'Mínimo',maxLabel:'Máximo'};
    if(['singleChoice','multipleChoice','dropdown'].includes(type)) base.options=['Opção 1','Opção 2'];
    if(type==='yesNo') base.label='Selecione uma resposta';
    if(type==='matching') base.pairs=[{left:'Item A',right:'Correspondência A'},{left:'Item B',right:'Correspondência B'}];
    if(type==='section') base.label='Nova seção';
    if(type==='info') base.label='Texto de orientação para o respondente.';
    draft.questions.push(base); state.modal={type:'formBuilder',draft}; renderModal();
  }

  function duplicateForm(base) {
    const draft=createFormDraft(base); draft.id=''; draft.title=base.custom?`${base.title} — cópia`:`Cópia de ${base.title}`; draft.status='draft'; draft.createdAt=new Date().toISOString(); state.modal={type:'formBuilder',draft}; renderModal();
  }

  async function previewAccessProfileImage(file) {
    if(!file) return;
    if(file.size>6_000_000) return toast('A imagem de perfil deve ter no máximo 6 MB.','error');
    try {
      pendingProfileAvatarData=await compressProfileImage(file);
      const preview=document.querySelector('.profile-image-preview');
      if(preview){preview.classList.add('has-photo');preview.innerHTML=`<img src="${pendingProfileAvatarData}" alt="Pré-visualização da imagem de perfil">`;}
    } catch(_) { toast('Não foi possível gerar a pré-visualização da imagem.','error'); }
  }

  async function handleLogoFile(file) {
    if(!file) return;
    if(file.size>8_000_000) return toast('A logo deve ter no máximo 8 MB.','error');
    try {
      const optimized=await compressLogo(file);
      await persistGlobalLogo(optimized,{name:file.name,mime:file.type||'image/webp'});
      audit('Logo institucional atualizada','Customização',`${file.name} · compartilhada pelo Supabase`);
      saveState();render();toast('Logo salva no banco de dados e aplicada a todos os perfis.');
    } catch(error){toast(error.message||'Não foi possível processar e salvar a logo global.','error');}
  }

  async function addPatientEvidences(patientId, files) {
    const p=patientById(patientId); if(!p) return;
    const selected=[...files].slice(0,8);
    for(const file of selected){
      if(file.size>900_000){toast(`${file.name}: limite de 900 KB nesta versão local.`,'error');continue;}
      const data=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(String(r.result));r.onerror=reject;r.readAsDataURL(file);});
      p.evidences=p.evidences||[];p.evidences.unshift({id:uid('ev'),name:file.name,type:file.type||'application/octet-stream',size:file.size,data,createdAt:new Date().toISOString()});
    }
    audit('Evidências adicionadas','Prontuário',`${p.name} · ${selected.length} arquivo(s)`); saveState(); state.patientDetailTab='evidences'; state.modal={type:'patient',patientId}; render(); toast('Evidências adicionadas.');
  }

  function blockPatient() {
    const form=document.getElementById('block-patient-form'); if(!form?.reportValidity()) return;
    const d=Object.fromEntries(new FormData(form)); const p=patientById(d.patientId); if(!p) return;
    p.status='blocked'; p.blockReason=d.reason; p.history=p.history||[];p.history.unshift({id:uid('h'),type:'note',title:'Paciente bloqueado',date:new Date().toISOString().slice(0,10),content:d.reason});
    audit('Paciente bloqueado','Pacientes',`${p.name} · ${d.reason}`); saveState(); closeModal(); state.nav='repository'; state.patientRepository='blocked'; render(); toast('Paciente bloqueado e movido para o repositório.');
  }

  function addPatientStatus() {
    const form=document.getElementById('status-builder-form'); if(!form?.reportValidity()) return;
    const d=Object.fromEntries(new FormData(form)); const id=`custom-${d.label.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')}-${Date.now().toString(36).slice(-4)}`;
    state.patientStatuses.push({id,label:d.label.trim(),color:d.color||'#4d7a8a',repository:!!d.repository,system:false}); audit('Status personalizado criado','Configuração de processos',d.label.trim()); saveState(); render(); toast('Novo status criado.');
  }

  async function saveSupportTicket(sendWhatsApp=false) {
    const form=document.getElementById('support-form'); if(!form?.reportValidity()) return;
    const fd=new FormData(form); const type=String(fd.get('type')||'SUGESTÃO').toUpperCase(); const title=String(fd.get('title')||'').toUpperCase().replace(/^\[[^\]]+\]\s*-?\s*/,''); const subject=`[${type}] - ${title}`;
    const selected=[...(document.getElementById('support-files')?.files||[])].slice(0,4); const files=[];
    for(const file of selected){
      if(file.size>700_000){toast(`${file.name}: limite de 700 KB para armazenamento local.`,'error');files.push({name:file.name,size:file.size,type:file.type,data:''});continue;}
      const data=await new Promise(resolve=>{const r=new FileReader();r.onload=()=>resolve(String(r.result||''));r.onerror=()=>resolve('');r.readAsDataURL(file);});
      files.push({name:file.name,size:file.size,type:file.type,data});
    }
    const ticket={id:uid('ticket'),type,subject,name:fd.get('name'),email:fd.get('email'),message:fd.get('message'),files,createdAt:new Date().toISOString()}; state.supportTickets.push(ticket); saveState();
    const body=`Nome: ${ticket.name}\nE-mail: ${ticket.email}\nTipo: ${type}\n\n${ticket.message}\n\nAnexos selecionados: ${files.map(f=>f.name).join(', ')||'Nenhum'}`;
    if(sendWhatsApp) window.open(`https://wa.me/5584988887979?text=${encodeURIComponent(subject+'\n\n'+body)}`,'_blank','noopener'); else window.location.href=`mailto:Joab.mata@gmail.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    render(); toast('Chamado registrado. Os anexos ficaram preservados no histórico local.');
  }

  document.addEventListener('click', async e=>{
    const target=e.target.closest('[data-action]'); if(!target) return; const action=target.dataset.action;
    if(action==='toggle-profile-menu'){state.profileMenuOpen=!state.profileMenuOpen;render();}
    else if(action==='open-switch-user'){state.profileMenuOpen=false;state.modal={type:'switchUser'};render();}
    else if(action==='logout-session')await logoutSession();
    else if(action==='confirm-switch-user')await switchAuthenticatedUser();
    else if(action==='impersonate-access-profile'){const profile=state.accessProfiles.find(item=>item.id===target.dataset.id);if(profile){state.profileMenuOpen=false;state.modal={type:'switchUser',email:profile.email};render();}}
    else if(action==='view-modification-detail'){state.modal={type:'modificationDetail',logId:target.dataset.id};renderModal();}
    else if(action==='open-rollback'){state.modal={type:'rollback',logId:target.dataset.id};renderModal();}
    else if(action==='confirm-rollback')await rollbackModification(target.dataset.id);
    else if(action==='nav'){const nav=target.dataset.nav;state.selectedPatientIds=[];if(!navAllowed(nav))return toast('Seu perfil não possui acesso a este módulo.','error');if(nav==='customization'&&currentRole()==='administrator'&&sessionStorage.getItem('humanevo_custom_unlocked')!=='1'){state.modal={type:'customAccess'};renderModal();return;}if(nav==='customization')state.adminOpenGroup=null;state.nav=nav;state.sidebarOpen=false;saveState();render();}
    else if(action==='open-assign-form'){state.modal={type:'assignForm',patientId:target.dataset.id};renderModal();}
    else if(action==='save-form-assignment')await saveFormAssignment();
    else if(action==='view-assignment-response'){state.modal={type:'assignmentResponse',assignmentId:target.dataset.id};renderModal();}
    else if(action==='save-assignment-review')await saveAssignmentReview();
    else if(action==='copy-patient-portal')await copyText(patientPortalUrl(target.dataset.id),'Link do Portal do Paciente copiado.');
    else if(action==='copy-assignment-link'){const a=(state.formAssignments||[]).find(x=>x.id===target.dataset.id);if(a)await copyText(patientPortalUrl(a.patientId),'Link do Portal do Paciente copiado.');}
    else if(action==='open-notifications'){state.modal={type:'notifications'};renderModal();}
    else if(action==='open-notification'){const n=(state.notifications||[]).find(x=>x.id===target.dataset.id);if(n){n.readAt=new Date().toISOString();n.read_at=n.read_at||new Date().toISOString();saveState();const threadId=n.payload?.thread_id||n.threadId||'';if(threadId){state.modal=null;state.nav='chat';state.activeChatThreadId=threadId;render();await loadChatMessages(threadId,true);}else if(n.assignment_id||n.assignmentId){state.modal={type:'assignmentResponse',assignmentId:n.assignment_id||n.assignmentId};renderModal();}else render();}}
    else if(action==='open-cloud-login'){state.modal={type:'cloudLogin'};renderModal();}
    else if(action==='connect-cloud')await connectCloud();
    else if(action==='approve-cloud-profile')await setCloudProfileStatus(target.dataset.id,'approved');
    else if(action==='block-cloud-profile')await setCloudProfileStatus(target.dataset.id,'blocked');
    else if(action==='reject-cloud-profile')await setCloudProfileStatus(target.dataset.id,'rejected');
    else if(action==='sync-cloud')await syncCloudData();
    else if(action==='disconnect-cloud'){await cloud.signOut();cloudContext=null;render();toast('Banco central desconectado.');}
    else if(action==='home'){state.nav='dashboard';state.sidebarOpen=false;state.modal=null;saveState();render();window.scrollTo({top:0,behavior:'smooth'});}
    else if(action==='toggle-sidebar'){state.sidebarOpen=!state.sidebarOpen;render();}
    else if(action==='toggle-sidebar-collapse'){state.sidebarCollapsed=!state.sidebarCollapsed;saveState();render();}
    else if(action==='dashboard-tab'){const nextTab=target.dataset.value;state.dashboardTab=['overview','performance','insights'].includes(nextTab)?nextTab:'overview';saveState();renderPageOnly();window.scrollTo({top:0,behavior:'smooth'});}
    else if(action==='agenda-view'){state.agendaView=target.dataset.value;if(state.agendaView==='three'){state.selectedDate=localIsoDate();state.calendarCursor=`${state.selectedDate.slice(0,7)}-01`;}state.calendarDetailAppointmentId='';hideCalendarTooltip();saveState();render();}
    else if(action==='patient-view'){state.patientView=target.dataset.value;saveState();render();}
    else if(action==='patient-sort'){const key=target.dataset.sortKey||'name';const current=state.patientSort||{};state.patientSort={key,direction:current.key===key&&current.direction==='asc'?'desc':'asc'};saveState();renderPageOnly();}
    else if(action==='repo-filter'){state.patientRepository=target.dataset.value;state.selectedPatientIds=[];saveState();render();}
    else if(action==='toggle-patient-selection'){const id=target.dataset.id;const selected=selectedPatientSet();target.checked?selected.add(id):selected.delete(id);state.selectedPatientIds=[...selected];render();}
    else if(action==='toggle-select-all-patients'){const repository=state.nav==='repository';const visible=visiblePatients(repository);const selected=selectedPatientSet();const shouldSelect=!!target.checked;visible.forEach(p=>shouldSelect?selected.add(p.id):selected.delete(p.id));state.selectedPatientIds=[...selected];render();}
    else if(action==='clear-patient-selection'){state.selectedPatientIds=[];render();}
    else if(action==='open-delete-patient'){if(!hasPermission('delete_patients'))return toast('Seu perfil não possui permissão para excluir pacientes.','error');state.modal={type:'deletePatient',patientId:target.dataset.id};renderModal();}
    else if(action==='confirm-delete-patient')await deleteSinglePatient(target.dataset.id);
    else if(action==='open-bulk-delete-patients'){const ids=[...(state.selectedPatientIds||[])].filter(id=>state.patients.some(p=>p.id===id));if(!ids.length)return toast('Selecione pelo menos um paciente.','error');state.modal={type:'bulkDeletePatients',patientIds:ids};renderModal();}
    else if(action==='confirm-bulk-delete-patients')await deletePatientsInBulk(state.modal?.patientIds||[]);
    else if(action==='open-patient'){const p=patientById(target.dataset.id);audit('Prontuário visualizado','Pacientes',p?.name||target.dataset.id);saveState();state.patientDetailTab='summary';state.modal={type:'patient',patientId:target.dataset.id};renderModal();}
    else if(action==='open-patient-form'){state.modal={type:'patientForm',patientId:target.dataset.id||null};renderModal();}
    else if(action==='edit-patient'){state.modal={type:'patientForm',patientId:target.dataset.id};renderModal();}
    else if(action==='open-email'){state.modal={type:'email',patientId:target.dataset.id};renderModal();}
    else if(action==='open-appointment'){state.modal={type:'appointment',patientId:target.dataset.patient||null,date:target.dataset.date||null};renderModal();}
    else if(action==='open-appointment-panel'){e.preventDefault();e.stopPropagation();hideCalendarTooltip();state.calendarDetailAppointmentId=target.dataset.appointmentId||'';const appointment=state.appointments.find(item=>String(item.id)===String(state.calendarDetailAppointmentId));if(appointment)state.selectedDate=appointment.start.slice(0,10);saveState();updateCalendarDetailPanel();}
    else if(action==='close-appointment-panel'){hideCalendarTooltip();state.calendarDetailAppointmentId='';saveState();updateCalendarDetailPanel();}
    else if(action==='edit-appointment'){state.modal={type:'appointment',appointmentId:target.dataset.id};renderModal();}
    else if(action==='delete-appointment')await deleteAppointment(target.dataset.id);
    else if(action==='open-block-patient'){state.modal={type:'blockPatient',patientId:target.dataset.id};renderModal();}
    else if(action==='confirm-block-patient')blockPatient();
    else if(action==='open-archive-patient'){state.modal={type:'archivePatient',patientId:target.dataset.id};renderModal();}
    else if(action==='archive-patient-confirm'){const form=document.getElementById('archive-patient-form');if(form?.reportValidity()){const d=Object.fromEntries(new FormData(form));archivePatient(d.patientId,d.status,d.note);}}
    else if(action==='open-assessment'){state.modal={type:'assessment',assessmentId:target.dataset.id,patientId:state.selectedPatientId||null};renderModal();}
    else if(action==='nav-library-for-patient'){state.modal=null;state.nav='library';state.assessmentSearch='';state.assessmentCategory='Todas';state.selectedPatientId=target.dataset.id;saveState();render();toast('Escolha uma avaliação e vincule ao paciente no formulário.');}
    else if(action==='assessment-category'){state.assessmentCategory=target.dataset.value;state.assessmentPage=1;saveState();render();}
    else if(action==='assessment-page'){state.assessmentPage=Number(target.dataset.value)||1;saveState();render();window.scrollTo({top:0,behavior:'smooth'});}
    else if(action==='library-info'){state.modal={type:'libraryInfo'};renderModal();}
    else if(action==='open-assessment-reference'){state.modal={type:'assessmentReference',assessmentId:target.dataset.id};renderModal();}
    else if(action==='save-assessment-reference')saveAssessmentReference(target.dataset.id);
    else if(action==='remove-assessment-reference')removeAssessmentReference(target.dataset.id,target.dataset.url);
    else if(action==='patient-detail-tab'){state.patientDetailTab=target.dataset.value;state.modal={type:'patient',patientId:target.dataset.id};renderModal();}
    else if(action==='open-history-form'){state.modal={type:'historyForm',patientId:target.dataset.id};renderModal();}
    else if(action==='back-patient'){state.modal={type:'patient',patientId:target.dataset.id};renderModal();}
    else if(action==='save-patient')await savePatient();
    else if(action==='save-history')saveHistory();
    else if(action==='save-appointment')saveAppointment();
    else if(action==='save-assessment')saveAssessment(target.dataset.id);
    else if(action==='copy-email')copyEmail();
    else if(action==='send-email')sendEmail();
    else if(action==='open-form-builder'){state.modal={type:'formBuilder',draft:createFormDraft()};renderModal();}
    else if(action==='edit-custom-form'){const f=state.customForms.find(x=>x.id===target.dataset.id);if(f){state.modal={type:'formBuilder',draft:structuredClone(f)};renderModal();}}
    else if(action==='duplicate-base-form'){const f=assessmentCatalog.find(x=>x.id===target.dataset.id);if(f)duplicateForm(f);}
    else if(action==='duplicate-custom-form'){const f=state.customForms.find(x=>x.id===target.dataset.id);if(f)duplicateForm(f);}
    else if(action==='delete-custom-form')deleteCustomForm(target.dataset.id);
    else if(action==='add-question-type')addQuestion(target.dataset.type);
    else if(action==='remove-question'){const d=captureFormBuilderDraft();const i=Number(target.dataset.index);d.questions.splice(i,1);state.modal={type:'formBuilder',draft:d};renderModal();}
    else if(action==='duplicate-question'){const d=captureFormBuilderDraft();const i=Number(target.dataset.index);const q=structuredClone(d.questions[i]);q.id=uid('q');d.questions.splice(i+1,0,q);state.modal={type:'formBuilder',draft:d};renderModal();}
    else if(action==='move-question'){const d=captureFormBuilderDraft();const i=Number(target.dataset.index),j=i+Number(target.dataset.direction);if(j>=0&&j<d.questions.length){[d.questions[i],d.questions[j]]=[d.questions[j],d.questions[i]];}state.modal={type:'formBuilder',draft:d};renderModal();}
    else if(action==='save-custom-form')saveCustomForm(target.dataset.stay==='true');
    else if(action==='unlock-customization'){const form=document.getElementById('customization-access-form');if(form?.reportValidity()){const password=new FormData(form).get('password');if(password==='adm123'){sessionStorage.setItem('humanevo_custom_unlocked','1');state.modal=null;state.nav='customization';state.adminOpenGroup=null;audit('Área administrativa desbloqueada','Segurança','Acesso validado pela senha parametrizada.');saveState();render();toast('Administração liberada.');}else toast('Senha de acesso incorreta.','error');}}
    else if(action==='export-system-xlsx')await exportSystemWorkbook();
    else if(action==='trigger-import-system-xlsx')document.getElementById('admin-import-xlsx')?.click();
    else if(action==='create-cloud-backup')await createCloudBackup();
    else if(action==='refresh-backup-timeline')await loadBackupTimeline(true);
    else if(action==='download-cloud-backup')await downloadCloudBackup(target.dataset.id);
    else if(action==='open-restore-backup'){state.modal={type:'restoreBackup',backupId:target.dataset.id};renderModal();}
    else if(action==='confirm-restore-backup')await restoreCloudBackup();
    else if(action==='open-bulk-provision-patients'){if(currentRole()!=='administrator')return toast('Somente o Administrador pode migrar pacientes em lote.','error');state.modal={type:'bulkProvisionPatients'};renderModal();}
    else if(action==='regenerate-bulk-password'){const field=document.querySelector('#bulk-provision-form [name="fixedPassword"]');if(field){field.value=generateStrongPassword();field.focus();field.select();}}
    else if(action==='confirm-bulk-provision-patients')await provisionPatientsInBulk();
    else if(action==='copy-bulk-credentials'){const rows=pendingBulkCredentials.filter(item=>item.success!==false).map(item=>`${item.name} | ${item.email} | ${item.password||'Senha preservada'} | Perfil: Paciente`).join('\n');await copyText(rows,'Credenciais copiadas.');}
    else if(action==='download-bulk-credentials'){downloadBlob(new Blob([bulkCredentialsCsv()],{type:'text/csv;charset=utf-8'}),`Credenciais_Pacientes_${new Date().toISOString().slice(0,10)}.csv`);}
    else if(action==='close-bulk-credentials'){pendingBulkCredentials=[];state.modal=null;render();toast('Migração finalizada. As senhas temporárias foram descartadas da memória.');}
    else if(action==='open-access-profile-form'){pendingProfileAvatarData='';pendingCredentialData=null;state.adminProfileDraftId=null;state.modal={type:'accessProfileForm'};renderModal();}
    else if(action==='save-access-profile')await saveAccessProfile();
    else if(action==='test-user-edge-function'){
      if(!cloudReady()||currentRole()!=='administrator') return toast('Entre como Administrador conectado ao banco central para testar o serviço.','error');
      try{
        const result=await cloud.managedUserFunctionHealth();
        if(result?.ok) toast(`Serviço de cadastro conectado · Cloudflare Worker ${result.version||'ativo'}.`);
        else toast('O Cloudflare Worker respondeu, mas falta configurar SUPABASE_SECRET_KEY no projeto.','error');
      }catch(error){
        if(error?.code==='CLOUDFLARE_ADMIN_API_UNREACHABLE') toast('O serviço administrativo não pôde ser alcançado. Publique o ZIP completo com _worker.js.','error');
        else if(error?.status===404||error?.code==='CLOUDFLARE_WORKER_NOT_FOUND') toast('O arquivo _worker.js não está ativo no projeto Cloudflare.','error');
        else if(error?.status===503||error?.data?.code==='WORKER_SECRET_MISSING') toast('Configure SUPABASE_SECRET_KEY nas variáveis do Cloudflare Pages.','error');
        else toast(String(error?.message||'Falha ao testar o serviço administrativo.'),'error');
      }
    }
    else if(action==='generate-patient-password'){const form=document.getElementById('patient-form');const password=generateStrongPassword();const first=form?.querySelector('[name="portalPassword"]');const confirmField=form?.querySelector('[name="portalPasswordConfirm"]');const toggle=form?.querySelector('[name="createPortalAccess"]');if(first&&confirmField){if(toggle)toggle.checked=true;first.value=password;confirmField.value=password;first.type='text';confirmField.type='text';first.focus();first.select();toast('Senha forte gerada e confirmada automaticamente.');}}
    else if(action==='copy-patient-invite'){if(pendingPatientInviteData)await copyText(patientInviteMessage(),'Mensagem de acesso copiada.');}
    else if(action==='open-patient-invite-email'){if(pendingPatientInviteData){const subject='Humanevo | Acesso ao Portal do Paciente';const url=`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(pendingPatientInviteData.email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(patientInviteMessage())}`;window.open(url,'_blank','noopener,noreferrer');}}
    else if(action==='open-patient-invite-whatsapp'){if(pendingPatientInviteData){const url=whatsappLink(pendingPatientInviteData.phone,patientInviteMessage());if(!url)return toast('Telefone inválido para abrir o WhatsApp.','error');window.open(url,'_blank','noopener,noreferrer');}}
    else if(action==='close-patient-invite'){pendingPatientInviteData=null;state.modal={type:'patient',patientId:state.selectedPatientId};saveState();render();toast('Convite encerrado. A senha temporária foi descartada da memória.');}
    else if(action==='open-whatsapp-patient'){const p=patientById(target.dataset.id);if(p){const url=whatsappLink(p.phone,`Olá, ${firstName(p.name)}. Entramos em contato pela equipe Humanevo.`);if(!url)return toast('Telefone inválido para abrir o WhatsApp.','error');window.open(url,'_blank','noopener,noreferrer');}}
    else if(action==='open-new-chat'){state.modal={type:'newChat'};renderModal();}
    else if(action==='open-intake-chat'){state.modal={type:'intakeChat'};renderModal();}
    else if(action==='create-intake-chat')await createIntakeChat();
    else if(action==='chat-channel-filter'){state.chatChannelFilter=target.dataset.value||'all';state.activeChatThreadId='';saveState();renderPageOnly();const first=(state.chatThreads||[]).map(normalizeChatThread).find(thread=>chatMatchesChannelFilter(thread,state.chatChannelFilter));if(first)await loadChatMessages(first.id,false);}
    else if(action==='start-chat-voice')startChatVoiceInput();
    else if(action==='open-patient-chat'){const p=patientById(target.dataset.id);if(!p?.authUserId)return toast('O paciente ainda não possui usuário vinculado ao portal.','error');state.modal={type:'newChat',preselectedUserId:p.authUserId};renderModal();}
    else if(action==='create-chat')await createChat();
    else if(action==='open-chat-thread')await loadChatMessages(target.dataset.id);
    else if(action==='send-chat-message')await sendChatMessage();
    else if(action==='download-chat-attachment')await downloadChatAttachment(target.dataset.id);
    else if(action==='refresh-chat')await refreshChatData();
    else if(action==='enable-chat-notifications')await enableChatNotifications();
    else if(action==='open-clear-all-chat'){if(currentRole()!=='administrator')return toast('Somente o Administrador pode limpar as conversas.','error');state.modal={type:'clearAllChat'};renderModal();}
    else if(action==='confirm-clear-all-chat')await clearAllChatConversations();
    else if(action==='generate-strong-password'){const form=document.getElementById('access-profile-form');const password=generateStrongPassword();const first=form?.querySelector('[name="temporaryPassword"]');const confirmField=form?.querySelector('[name="temporaryPasswordConfirm"]');if(first&&confirmField){first.value=password;confirmField.value=password;first.type='text';confirmField.type='text';first.focus();first.select();toast('Senha forte gerada e preenchida nos dois campos.');}}
    else if(action==='copy-access-credentials'){if(pendingCredentialData)await copyText(credentialsMessage(),'Credenciais copiadas.');}
    else if(action==='open-outlook-credentials'){if(pendingCredentialData){const subject=`Credenciais de acesso Humanevo - ${pendingCredentialData.name}`;const url=`https://outlook.office.com/mail/deeplink/compose?to=${encodeURIComponent(pendingCredentialData.email)}&subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(credentialsMessage())}`;window.open(url,'_blank','noopener,noreferrer');}}
    else if(action==='close-credentials-modal'){pendingCredentialData=null;state.modal=null;saveState();render();toast('Tela encerrada. A senha temporária foi descartada da memória do aplicativo.');}
    else if(action==='access-cockpit-tab'){state.accessCockpitTab=target.dataset.value||'pending';saveState();render();}
    else if(action==='edit-access-profile'){pendingProfileAvatarData='';pendingCredentialData=null;state.adminProfileDraftId=target.dataset.id||null;state.modal={type:'accessProfileForm',profileId:target.dataset.id||''};renderModal();}
    else if(action==='close-access-profile-modal'){pendingProfileAvatarData='';state.adminProfileDraftId=null;closeModal();}
    else if(action==='cancel-access-profile-edit'){pendingProfileAvatarData='';state.adminProfileDraftId=null;closeModal();}
    else if(action==='delete-access-profile'){const id=target.dataset.id; const profile=state.accessProfiles.find(item=>item.id===id); if(!profile||profile.locked) return; if(confirm(`Excluir o perfil de acesso de ${profile.name}?`)){state.accessProfiles=state.accessProfiles.filter(item=>item.id!==id); if(state.adminProfileDraftId===id) state.adminProfileDraftId=null; audit('Perfil de acesso excluído','Perfis de acesso',profile.name); saveState(); render(); toast('Perfil de acesso excluído.');}}
    else if(action==='save-integration'){const item=state.integrations.find(i=>i.id===target.dataset.id);const input=document.querySelector(`[data-integration-endpoint="${CSS.escape(target.dataset.id)}"]`);if(item){item.endpoint=String(input?.value||'').trim();audit('Configuração de integração salva','Integrações',item.name);saveState();render();toast('Configuração registrada.');}}
    else if(action==='close-sidebar'){state.sidebarOpen=false;saveState();render();}
    else if(action==='add-patient-status')addPatientStatus();
    else if(action==='delete-patient-status'){const id=target.dataset.id;if(state.patients.some(p=>p.status===id))return toast('Este status está em uso por pacientes.','error');state.patientStatuses=state.patientStatuses.filter(s=>s.id!==id);saveState();render();toast('Status removido.');}
    else if(action==='download-evidence'){const p=patientById(target.dataset.patient);const f=p?.evidences?.find(x=>x.id===target.dataset.id);if(f)downloadDataUrl(f.data,f.name);}
    else if(action==='delete-evidence'){const p=patientById(target.dataset.patient);if(p){p.evidences=(p.evidences||[]).filter(x=>x.id!==target.dataset.id);saveState();state.modal={type:'patient',patientId:p.id};state.patientDetailTab='evidences';render();toast('Evidência removida.');}}
    else if(action==='save-support-ticket')await saveSupportTicket(false);
    else if(action==='contact-whatsapp')await saveSupportTicket(true);
    else if(action==='trigger-logo-upload')document.getElementById('logo-upload')?.click();
    else if(action==='remove-logo'){
      try{await persistGlobalLogo('',{name:'',mime:''});audit('Logo institucional removida','Customização','A identidade padrão será usada por todos os perfis.');saveState();render();toast('Logo global removida. Todos os perfis usarão a identidade padrão.');}
      catch(error){toast(error.message||'Não foi possível remover a logo global.','error');}
    }
    else if(action==='reset-customization'){
      try{await persistGlobalLogo('',{name:'',mime:''});state.customization=structuredClone(defaultCustomization);await deleteVisualAsset('brand-logo').catch(()=>{});audit('Identidade visual restaurada','Customização','Parâmetros redefinidos para o padrão Humanevo e logo global removida.');saveState();applyCustomization();render();toast('Identidade visual global restaurada.');}
      catch(error){toast(error.message||'Não foi possível restaurar a identidade global.','error');}
    }
    else if(action==='close-modal')closeModal();
    else if(action==='calendar-prev'||action==='calendar-next'){state.calendarDetailAppointmentId='';const d=new Date(`${state.calendarCursor}T12:00:00`);d.setMonth(d.getMonth()+(action==='calendar-next'?1:-1));state.calendarCursor=`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-01`;saveState();render();}
    else if(action==='calendar-today'){state.calendarDetailAppointmentId='';const today=localIsoDate();state.calendarCursor=`${today.slice(0,7)}-01`;state.selectedDate=today;saveState();render();}
    else if(action==='select-date'){state.selectedDate=target.dataset.date;saveState();render();}
  });

  document.addEventListener('dblclick',e=>{
    if(e.target.closest('[data-appointment-id]')) return;
    const slot=e.target.closest('[data-calendar-slot]');
    if(slot){state.modal={type:'appointment',date:slot.dataset.calendarSlot};renderModal();return;}
    if(e.target.closest('button,input,label,a,select,textarea')) return;
    const card=e.target.closest('[data-patient-id]'); if(!card) return; if(!hasPermission('medical_records')) return toast('Seu perfil não possui acesso aos prontuários.','error'); state.patientDetailTab='summary';state.modal={type:'patient',patientId:card.dataset.patientId};renderModal();
  });

  document.addEventListener('toggle',e=>{const group=e.target.closest?.('[data-admin-group]');if(group){state.adminOpenGroup=group.open?group.dataset.adminGroup:null;saveState();if(group.open&&group.dataset.adminGroup==='backup')loadBackupTimeline(false);}},true);

  document.addEventListener('change',async e=>{
    if(e.target.dataset.action==='role-permission-change') { await updateRolePermission(e.target.dataset.role,e.target.dataset.permission,e.target.checked); return; }
    if(e.target.dataset.action==='user-permission-change') { await updateUserPermission(e.target.dataset.profile,e.target.dataset.permission,e.target.value); return; }
    if(e.target.id==='email-template'){const form=document.getElementById('email-form');const patient=patientById(form.querySelector('[name="patientId"]').value);const template=emailTemplates.find(x=>x.id===e.target.value);document.getElementById('email-subject').value=template.subject;document.getElementById('email-body').value=template.body(patient);}
    if(e.target.matches('[name^="q"]')) updateTemperamentPreview();
    if(e.target.id==='logo-upload') handleLogoFile(e.target.files?.[0]);
    if(e.target.matches('#access-profile-form [name="profileImage"]')) previewAccessProfileImage(e.target.files?.[0]);
    if(e.target.id==='admin-import-xlsx'){ importSystemWorkbook(e.target.files?.[0]); e.target.value=''; }
    if(e.target.matches('[data-evidence-patient]')) addPatientEvidences(e.target.dataset.evidencePatient,e.target.files||[]);
    if(e.target.id==='support-files'){const box=document.getElementById('support-file-preview');if(box)box.innerHTML=[...(e.target.files||[])].map(f=>`<span>${icon(f.type.startsWith('image/')?'image':'file',14)} ${escapeHtml(f.name)}</span>`).join('');}
    if(e.target.id==='chat-attachment-input')previewChatAttachments(e.target,'chat-file-preview');
    if(e.target.matches('.customization-control')) {
      const key=e.target.dataset.customKey;
      state.customization[key]=e.target.type==='checkbox'?e.target.checked:(e.target.dataset.valueType==='number'?Number(e.target.value):e.target.value);
      audit('Parâmetro visual alterado','Customização',key);saveState();applyCustomization();render();
    }
    if(e.target.matches('[data-q-field="type"]')) {captureFormBuilderDraft();renderFormBuilderModal();}
    if(e.target.dataset.action==='quick-status'){
      const patient=patientById(e.target.dataset.id); if(!patient) return;
      if(e.target.value==='blocked'){state.modal={type:'blockPatient',patientId:patient.id};renderModal();}
      else if(isRepositoryStatus(e.target.value)){archivePatient(patient.id,e.target.value,`Situação alterada para ${statusLabel(e.target.value).toLowerCase()} no cadastro do paciente.`);}
      else {patient.status=e.target.value;patient.blockReason='';saveState();toast('Situação atualizada.');state.modal={type:'patient',patientId:patient.id};renderModal();}
    }
    if(e.target.id==='appointment-patient-search'){const match=state.patients.find(p=>p.name.toLowerCase()===e.target.value.trim().toLowerCase());const hidden=document.getElementById('appointment-patient-id');if(hidden)hidden.value=match?.id||'';}
    if(e.target.matches('[data-appointment-conditional]'))applyAppointmentConditionalStyle(e.target);
    if(e.target.id==='support-type'){const input=document.getElementById('support-title');const prefix=document.getElementById('support-prefix');if(prefix)prefix.textContent=`[${e.target.value.toUpperCase()}] -`;if(input)input.value=input.value.toUpperCase().replace(/^\[[^\]]+\]\s*-?\s*/,'');applySupportTypeStyle(e.target.value);}
    if(e.target.dataset.action==='integration-status'){const item=state.integrations.find(i=>i.id===e.target.dataset.id);if(item){item.status=e.target.value;item.lastSync=item.status==='active'?new Date().toISOString():item.lastSync;audit('Status de integração alterado','Integrações',`${item.name}: ${item.status}`);saveState();render();toast('Status da integração atualizado.');}}
  });

  document.addEventListener('input',e=>{
    if(e.target.matches('[data-phone-mask]')){const pos=e.target.selectionStart;e.target.value=formatBrazilPhone(e.target.value);try{e.target.setSelectionRange(e.target.value.length,e.target.value.length);}catch(_){}return;}
    if(e.target.matches('[data-cep-mask]')){e.target.value=formatCep(e.target.value);return;}
    if(e.target.matches('[name="addressState"]')){e.target.value=e.target.value.toUpperCase().replace(/[^A-Z]/g,'').slice(0,2);return;}
    if(e.target.matches('[data-chat-search]')){
      const field=e.target;
      state.chatSearch=field.value;
      saveState();
      filterChatThreadsInPlace(field.value);
      requestAnimationFrame(()=>{if(document.activeElement===field){const end=field.value.length;try{field.setSelectionRange(end,end);}catch(_){}}});
      return;
    }
    if(e.target.closest('#access-profile-form')||e.target.closest('#patient-form')) return;
    if(e.target.id==='support-title'){const start=e.target.selectionStart;e.target.value=e.target.value.toUpperCase().replace(/^\[[^\]]+\]\s*-?\s*/,'');try{e.target.setSelectionRange(start,start);}catch(_){}}
    if(e.target.id==='appointment-patient-search'){const match=state.patients.find(p=>p.name.toLowerCase()===e.target.value.trim().toLowerCase());const hidden=document.getElementById('appointment-patient-id');if(hidden)hidden.value=match?.id||'';}
    if(e.target.id==='global-search'){
      state.patientSearch=e.target.value;
      state.selectedPatientIds=[];
      if(state.nav!=='patients'&&state.nav!=='repository') state.nav='patients';
      saveState();
      rerenderAndRestoreInput('#global-search');
      return;
    }
    if(e.target.id==='assessment-search'){
      state.assessmentSearch=e.target.value;
      state.assessmentPage=1;
      saveState();
      rerenderAndRestoreInput('#assessment-search');
      return;
    }
    if(e.target.id==='form-search'){
      state.formSearch=e.target.value;
      saveState();
      rerenderAndRestoreInput('#form-search');
      return;
    }
    if(e.target.matches('.customization-control')) {
      const key=e.target.dataset.customKey;
      state.customization[key]=e.target.type==='checkbox'?e.target.checked:(e.target.dataset.valueType==='number'?Number(e.target.value):e.target.value);
      const suffix={logoSize:'px',logoRadius:'px',cardRadius:'px',controlRadius:'px',sidebarWidth:'px',shadowIntensity:'x',uiScale:'x'}[key]||'';
      const output=document.querySelector(`[data-output-for="${key}"]`);if(output)output.textContent=`${e.target.value}${suffix}`;
      if(e.target.type==='color')e.target.nextElementSibling&&(e.target.nextElementSibling.textContent=e.target.value);
      applyCustomization();saveState();
    }
    if(e.target.closest('.studio-modal')&&(e.target.matches('[data-q-field]')||e.target.closest('#form-builder-meta'))) refreshBuilderPreview();
  });

  document.addEventListener('pointerover',e=>{const eventTarget=e.target.closest?.('[data-appointment-id]');if(eventTarget&&!eventTarget.contains(e.relatedTarget))showCalendarTooltip(eventTarget,e);});
  document.addEventListener('pointermove',e=>{if(e.target.closest?.('[data-appointment-id]'))positionCalendarTooltip(e);});
  document.addEventListener('pointerout',e=>{const eventTarget=e.target.closest?.('[data-appointment-id]');if(eventTarget&&!eventTarget.contains(e.relatedTarget))hideCalendarTooltip();});

  document.addEventListener('pointerdown',e=>{
    if(state.profileMenuOpen && !e.target.closest('.profile-menu-wrap')) { state.profileMenuOpen=false; render(); return; }
    const sidebar=e.target.closest('.sidebar');
    const collapseButton=e.target.closest('[data-action="toggle-sidebar-collapse"]');
    const mobileButton=e.target.closest('[data-action="toggle-sidebar"]');
    if(window.innerWidth>900 && !state.sidebarCollapsed && !sidebar && !collapseButton) {
      state.sidebarCollapsed=true;
      saveState();
      document.querySelector('.app-shell')?.classList.add('sidebar-collapsed');
      document.querySelector('.sidebar')?.classList.add('collapsed');
    }
    if(window.innerWidth<=900 && state.sidebarOpen && !sidebar && !mobileButton) {
      state.sidebarOpen=false;
      saveState();
      document.querySelector('.sidebar')?.classList.remove('open');
      document.querySelector('.sidebar-overlay')?.remove();
    }
  }, true);

  document.addEventListener('keydown',e=>{
    if(e.target?.id==='chat-message-input'&&e.key==='Enter'&&!e.isComposing){
      if(e.shiftKey||e.altKey)return;
      e.preventDefault();sendChatMessage();return;
    }
    if(e.key==='Escape'&&state.modal)closeModal();
    if(e.key==='Enter'&&e.target.matches('[data-patient-id]')){state.modal={type:'patient',patientId:e.target.dataset.patientId};renderModal();return;}
    if(e.key==='Enter'&&e.target.matches('#customization-access-form input[type="password"]')){e.preventDefault();document.querySelector('[data-action="unlock-customization"]')?.click();return;}
    if(e.key==='Enter'&&e.target.matches('#switch-user-form input[type="password"]')){e.preventDefault();document.querySelector('[data-action="confirm-switch-user"]')?.click();return;}
    if(e.key==='Enter'&&e.target.matches('#cloud-login-form input[type="password"]')){e.preventDefault();document.querySelector('[data-action="connect-cloud"]')?.click();}
  });

  window.addEventListener('storage',event=>{
    if(event.key!==STORAGE_KEY)return;
    const incoming=loadState();
    if(state.modal||isTextEntryActive()){deferredExternalState=incoming;return;}
    state=incoming;stateHydrated=true;lastAuditableSnapshot=captureAuditableState();render();
  });

  // O estado local é carregado antes da primeira pintura para impedir cintilação e troca brusca de tela.
  render();
  const demoAccess = isDemoAccess;
  if (demoAccess) sessionStorage.removeItem('humanevo_demo_professional');
  restoreStoredLogo();
  if (!demoAccess) initializeCloudSession();

  setInterval(()=>{ if(!demoAccess && document.visibilityState==='visible'&&cloudReady()) syncCloudData(false); }, Math.max(60000,Number(window.HUMANEVO_CONFIG?.POLL_INTERVAL_MS||60000)));
  setInterval(()=>{ if(!isDemoAccess&&cloudReady()) refreshChatData(false); },15000);
  document.addEventListener('visibilitychange',()=>{if(document.visibilityState==='visible'){applyDeferredExternalState();if(!isDemoAccess&&cloudReady())refreshChatData(false);}});
  if ('serviceWorker' in navigator && location.protocol !== 'file:') {
    window.addEventListener('load',()=>setTimeout(()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}),1200));
  }
})();
