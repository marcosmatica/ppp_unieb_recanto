// src/services/indicadoresEI.js

export const METAS_EI = [
  {
    code: 'M1',
    label: 'Gestão de sistemas e redes de ensino',
    indicadores: [
      {
        code: '1.1',
        label: 'Gestão de acesso, oferta e matrícula',
        resultadoEsperado: 'Realização de mapeamento e ampliação do atendimento, quando necessário.',
        parametros: [
          'A SEEDF realiza mapeamento da demanda e, se necessário, promove a ampliação do atendimento.',
          'A SEEDF faz a gestão da demanda em conjunto com as instituições, utilizando técnicas e ferramentas que promovam organização, controle e transparência, visando ao cumprimento da meta do Plano Distrital de Educação.',
          'A SEEDF realiza a oferta geograficamente próxima à demanda, reduzindo a necessidade de transporte, sempre que possível.',
          'A SEEDF utiliza como critério prioritário para matrícula de crianças de 0 a 3 anos a vulnerabilidade social da família, garantindo a transparência dos itens adotados.',
          'A SEEDF realiza o processo de matrícula de maneira transparente a todos os envolvidos, por meio da disponibilização de instrumentos como central de vagas ou ferramentas on-line.',
        ],
      },
    ],
  },
  {
    code: 'M2',
    label: 'Formação e remuneração dos profissionais',
    indicadores: [
      {
        code: '2.1',
        label: 'Habilitação',
        resultadoEsperado: 'Contratação de pessoal com habilitação compatível para o exercício de suas funções.',
        parametros: [
          'Todos os profissionais da instituição educativa têm habilitação compatível para o exercício de suas funções.',
          'O gestor possui graduação em Pedagogia ou formação específica em administração escolar e/ou gestão educacional.',
          'Todos os professores regentes possuem graduação em Pedagogia.',
          'O secretário escolar possui certificação adequada para o exercício da sua função.',
          'Os monitores possuem formação em nível médio e, preferencialmente, são graduandos em Pedagogia.',
        ],
      },
      {
        code: '2.2',
        label: 'Formação continuada',
        resultadoEsperado: 'Promoção de ações que priorizem os momentos destinados à formação continuada.',
        parametros: [
          'A instituição prioriza a coordenação pedagógica como momento de formação continuada que possibilita planejamento, avaliação e aprimoramento dos registros.',
          'A instituição favorece a participação dos profissionais em cursos e ações de formação continuada ofertadas pela SEEDF.',
          'A formação continuada atualiza conhecimentos, promovendo leitura e discussão de pesquisas sobre a infância e práticas de Educação Infantil, inclusive para atender crianças com deficiência.',
          'O coordenador pedagógico organiza a formação continuada com os professores na instituição educativa.',
          'Os momentos formativos estão incluídos na jornada de trabalho remunerada dos profissionais da educação.',
        ],
      },
      {
        code: '2.3',
        label: 'Condições de trabalho adequadas',
        resultadoEsperado: 'Garantia de condições dignas de trabalho para todos os profissionais da instituição.',
        parametros: [
          'A instituição garante a todos os profissionais condições adequadas de trabalho, incluindo equipamentos e materiais necessários.',
          'Os profissionais têm jornada de trabalho compatível com as demandas da Educação Infantil.',
          'A instituição promove ambiente de trabalho saudável e colaborativo entre todos os profissionais.',
          'Os profissionais recebem remuneração compatível com o piso salarial nacional e plano de carreira.',
          'A gestão assegura espaço e tempo para planejamento coletivo e individual dos professores.',
        ],
      },
    ],
  },
  {
    code: 'M3',
    label: 'Gestão das instituições de Educação Infantil',
    indicadores: [
      {
        code: '3.1',
        label: 'Organização Institucional',
        resultadoEsperado: 'Gestão democrática e participativa da instituição educativa.',
        parametros: [
          'A instituição possui Conselho Escolar atuante com representação de todos os segmentos da comunidade escolar.',
          'As decisões institucionais são tomadas de forma coletiva e participativa, com registro em atas.',
          'A instituição possui Projeto Político-Pedagógico elaborado coletivamente e em consonância com as diretrizes da SEEDF.',
          'O gestor promove reuniões periódicas com a equipe pedagógica e administrativa.',
          'A instituição garante transparência na gestão dos recursos financeiros e pedagógicos.',
        ],
      },
      {
        code: '3.2',
        label: 'Proposta Pedagógica',
        resultadoEsperado: 'Elaboração e implementação de proposta pedagógica que garanta os direitos de aprendizagem das crianças.',
        parametros: [
          'A instituição possui proposta pedagógica elaborada coletivamente, fundamentada nas Diretrizes Curriculares Nacionais para a Educação Infantil.',
          'A proposta pedagógica contempla os cinco campos de experiências da BNCC e os direitos de aprendizagem e desenvolvimento.',
          'A proposta é revisada anualmente com participação de professores, famílias e comunidade escolar.',
          'A proposta orienta efetivamente as práticas pedagógicas cotidianas dos professores.',
          'A proposta inclui estratégias de atendimento às crianças com deficiência e necessidades educacionais especiais.',
        ],
      },
      {
        code: '3.3',
        label: 'Planejamento pedagógico',
        resultadoEsperado: 'Realização de planejamento pedagógico sistemático e coletivo.',
        parametros: [
          'Os professores realizam planejamento semanal das atividades com base nos campos de experiências.',
          'O planejamento é discutido coletivamente nas coordenações pedagógicas.',
          'O planejamento considera as especificidades das crianças, respeitando faixas etárias e desenvolvimento individual.',
          'O coordenador pedagógico acompanha e orienta o planejamento dos professores.',
          'O planejamento é registrado e arquivado, possibilitando continuidade e avaliação das ações pedagógicas.',
        ],
      },
      {
        code: '3.4',
        label: 'Registro da prática educativa / escrituração',
        resultadoEsperado: 'Realização de registros sistemáticos das práticas educativas e da vida escolar das crianças.',
        parametros: [
          'Os professores realizam registros diários ou semanais das atividades e das aprendizagens das crianças.',
          'A instituição mantém a escrituração escolar atualizada e organizada.',
          'Os registros contemplam observações individuais sobre o desenvolvimento de cada criança.',
          'Os registros são utilizados como instrumento de avaliação e planejamento das práticas pedagógicas.',
          'A instituição organiza portfólios ou outros instrumentos de documentação pedagógica das crianças.',
        ],
      },
      {
        code: '3.5',
        label: 'Coordenação Pedagógica',
        resultadoEsperado: 'Atuação efetiva da coordenação pedagógica no apoio e formação dos professores.',
        parametros: [
          'A instituição possui coordenador pedagógico habilitado e com carga horária compatível com as demandas.',
          'O coordenador realiza reuniões de coordenação pedagógica coletiva com regularidade.',
          'O coordenador acompanha e orienta o trabalho dos professores individualmente e em grupo.',
          'A coordenação pedagógica promove momentos de estudo e reflexão sobre as práticas pedagógicas.',
          'O coordenador articula as relações entre a equipe gestora, professores, famílias e comunidade.',
        ],
      },
      {
        code: '3.6',
        label: 'Alimentação saudável das crianças',
        resultadoEsperado: 'Oferta de alimentação saudável, nutritiva e adequada às crianças.',
        parametros: [
          'A alimentação oferecida é elaborada por nutricionista e adequada às necessidades das crianças.',
          'A instituição respeita restrições alimentares por questões de saúde, culturais ou religiosas.',
          'Os momentos das refeições são organizados de forma acolhedora e educativa.',
          'A instituição promove educação alimentar e nutricional integrada às práticas pedagógicas.',
          'A qualidade e quantidade dos alimentos atendem às recomendações do Programa Nacional de Alimentação Escolar.',
        ],
      },
      {
        code: '3.7',
        label: 'Limpeza, salubridade e conforto',
        resultadoEsperado: 'Manutenção de espaços limpos, salubres e confortáveis para crianças e adultos.',
        parametros: [
          'Os espaços da instituição são limpos diariamente e desinfetados com regularidade.',
          'A instituição possui banheiros adequados e em quantidade suficiente para crianças e adultos.',
          'Os ambientes têm ventilação, iluminação e temperatura adequadas para o bem-estar das crianças.',
          'A instituição realiza manutenção preventiva e corretiva dos espaços físicos.',
          'Há controle de pragas e agentes causadores de doenças nos espaços da instituição.',
        ],
      },
      {
        code: '3.8',
        label: 'Segurança',
        resultadoEsperado: 'Garantia de segurança física e emocional para crianças, famílias e profissionais.',
        parametros: [
          'A instituição possui controle de entrada e saída de pessoas, garantindo a segurança das crianças.',
          'Os espaços físicos são seguros, sem riscos de acidentes para as crianças (quinas, tomadas, escadas etc.).',
          'A instituição possui plano de emergência e os profissionais são capacitados para situações de risco.',
          'Há rotinas claras para entrega e retirada das crianças, com registro de responsáveis autorizados.',
          'A instituição promove ambiente de segurança emocional, com relações pautadas no respeito e no afeto.',
        ],
      },
    ],
  },
  {
    code: 'M4',
    label: 'Currículos, interações e práticas pedagógicas',
    indicadores: [
      {
        code: '4.1',
        label: 'Crianças construindo sua autonomia nas práticas sociais',
        resultadoEsperado: 'Práticas pedagógicas que favoreçam a construção da autonomia das crianças.',
        parametros: [
          'Os professores organizam situações que favorecem a iniciativa e a tomada de decisão das crianças.',
          'As crianças têm oportunidade de fazer escolhas e expressar suas preferências nas atividades cotidianas.',
          'Os professores respeitam o ritmo individual de cada criança nas diferentes atividades.',
          'As práticas pedagógicas promovem a participação ativa das crianças na organização dos espaços e rotinas.',
          'As crianças são incentivadas a resolver conflitos e situações do cotidiano de forma autônoma.',
        ],
      },
      {
        code: '4.2',
        label: 'Crianças expressando-se por diferentes campos de experiências',
        resultadoEsperado: 'Oferta de experiências diversificadas que contemplem os campos de experiências da BNCC.',
        parametros: [
          'As atividades contemplam os cinco campos de experiências: corpo, gestos e movimentos; traços, sons, cores e formas; escuta, fala, pensamento e imaginação; espaços, tempos, quantidades e transformações; eu, o outro e o nós.',
          'Os professores oferecem materiais variados que estimulam diferentes formas de expressão.',
          'As práticas pedagógicas incluem atividades de música, artes visuais, dança, teatro e literatura.',
          'As crianças têm tempo e espaço para brincar livremente e de forma orientada.',
          'Os professores documentam e valorizam as produções e expressões das crianças.',
        ],
      },
      {
        code: '4.3',
        label: 'Crianças com experiências variadas de linguagem oral e escrita',
        resultadoEsperado: 'Promoção de práticas de linguagem oral e escrita adequadas à faixa etária.',
        parametros: [
          'Os professores promovem rodas de conversa, contação de histórias e atividades de escuta ativa.',
          'A instituição possui acervo de livros de literatura infantil acessível às crianças.',
          'As práticas incluem escrita espontânea, exploração de textos e situações de leitura compartilhada.',
          'Os professores ampliam o vocabulário das crianças em situações cotidianas e planejadas.',
          'As práticas de linguagem respeitam e valorizam as diferentes formas de expressão oral das crianças e de suas famílias.',
        ],
      },
      {
        code: '4.4',
        label: 'Crianças reconhecendo identidade e valorizando diferenças',
        resultadoEsperado: 'Promoção do reconhecimento da identidade e do respeito à diversidade.',
        parametros: [
          'As práticas pedagógicas abordam a diversidade étnico-racial, cultural e de gênero de forma positiva.',
          'Os materiais pedagógicos representam a diversidade da sociedade brasileira.',
          'Os professores trabalham a história e cultura afro-brasileira e indígena conforme as Leis 10.639/2003 e 11.645/2008.',
          'As crianças são incentivadas a valorizar as diferenças e a combater toda forma de discriminação.',
          'A instituição promove atividades que fortalecem a identidade e a autoestima de cada criança.',
        ],
      },
      {
        code: '4.5',
        label: 'Respeito à identidade, desejos e interesses das crianças',
        resultadoEsperado: 'Práticas pedagógicas que respeitem e considerem os interesses e necessidades das crianças.',
        parametros: [
          'O planejamento considera os interesses e necessidades das crianças observados no cotidiano.',
          'Os professores escutam e levam em conta as opiniões das crianças nas decisões do grupo.',
          'As práticas respeitam as diferentes formas de ser e de se expressar de cada criança.',
          'A instituição garante tempo e espaço para o brincar livre, respeitando as escolhas das crianças.',
          'Os professores não impõem padrões únicos de comportamento, respeitando a individualidade de cada criança.',
        ],
      },
      {
        code: '4.6',
        label: 'Respeito às ideias, conquistas e produções das crianças',
        resultadoEsperado: 'Valorização das produções e conquistas das crianças no cotidiano pedagógico.',
        parametros: [
          'Os professores valorizam e expõem as produções das crianças nos espaços da instituição.',
          'As conquistas individuais e coletivas são reconhecidas e celebradas pela comunidade escolar.',
          'Os professores registram e comunicam às famílias as aprendizagens e produções das crianças.',
          'As ideias e hipóteses das crianças são consideradas e exploradas nas atividades pedagógicas.',
          'A instituição organiza momentos de socialização das produções das crianças com a comunidade.',
        ],
      },
      {
        code: '4.7',
        label: 'Interação entre crianças, adultos e instituições',
        resultadoEsperado: 'Promoção de interações qualificadas entre crianças, adultos e instituições.',
        parametros: [
          'Os professores estabelecem relações afetivas e respeitosas com as crianças no cotidiano.',
          'As crianças interagem entre si em diferentes agrupamentos (faixa etária, turmas mistas etc.).',
          'A instituição promove parceria com famílias, comunidade e outras instituições do entorno.',
          'Os adultos da instituição modelam relações de respeito, cooperação e diálogo para as crianças.',
          'A instituição realiza visitas pedagógicas e atividades que aproximam as crianças da comunidade local.',
        ],
      },
    ],
  },
  {
    code: 'M5',
    label: 'Interação com a família e comunidade',
    indicadores: [
      {
        code: '5.1',
        label: 'Respeito e acolhimento',
        resultadoEsperado: 'Acolhimento respeitoso das famílias e crianças pela instituição educativa.',
        parametros: [
          'A instituição realiza período de acolhimento das crianças novas com participação das famílias.',
          'As famílias são recebidas com respeito e atenção, sem discriminação de qualquer natureza.',
          'A instituição possui canais de comunicação acessíveis e efetivos com as famílias.',
          'O ambiente institucional é organizado de forma acolhedora para crianças e famílias.',
          'A instituição respeita e valoriza os saberes, culturas e práticas das famílias atendidas.',
        ],
      },
      {
        code: '5.2',
        label: 'Garantia de direitos das famílias de participar e acompanhar',
        resultadoEsperado: 'Garantia da participação efetiva das famílias na vida escolar das crianças.',
        parametros: [
          'A instituição promove reuniões periódicas com as famílias para apresentar e discutir a proposta pedagógica.',
          'As famílias são informadas regularmente sobre o desenvolvimento e aprendizagens de seus filhos.',
          'A instituição promove momentos de participação das famílias nas atividades pedagógicas.',
          'As famílias têm acesso aos registros e documentos relacionados à vida escolar de seus filhos.',
          'A instituição cria espaços de escuta e participação das famílias nas decisões institucionais.',
        ],
      },
    ],
  },
  {
    code: 'M6',
    label: 'Intersetorialidade',
    indicadores: [
      {
        code: '6.1',
        label: 'Rede de proteção dos direitos das crianças',
        resultadoEsperado: 'Articulação da instituição com a rede de proteção dos direitos das crianças.',
        parametros: [
          'A instituição conhece e articula com os serviços da rede de proteção: CRAS, CREAS, Conselho Tutelar, UBS.',
          'Os profissionais estão capacitados para identificar e notificar situações de vulnerabilidade e violação de direitos.',
          'A instituição realiza notificações ao Conselho Tutelar quando necessário, conforme o ECA.',
          'Há fluxo claro e conhecido por todos para encaminhamento de casos de suspeita de violência.',
          'A instituição participa de reuniões e ações intersetoriais de proteção à infância no território.',
        ],
      },
      {
        code: '6.2',
        label: 'Cuidado integral das crianças',
        resultadoEsperado: 'Promoção do cuidado integral das crianças em articulação com outras políticas públicas.',
        parametros: [
          'A instituição articula com serviços de saúde para garantir acompanhamento do desenvolvimento infantil.',
          'A instituição orienta as famílias sobre a importância do acompanhamento de saúde e imunização das crianças.',
          'Há parceria com serviços de assistência social para atendimento de famílias em situação de vulnerabilidade.',
          'A instituição identifica e encaminha crianças com necessidades de atendimento especializado.',
          'A instituição integra ações de saúde, nutrição e educação no cotidiano pedagógico.',
        ],
      },
      {
        code: '6.3',
        label: 'Participação das crianças',
        resultadoEsperado: 'Garantia da participação efetiva das crianças na vida institucional.',
        parametros: [
          'As crianças participam da organização dos espaços e rotinas da instituição.',
          'As opiniões e preferências das crianças são consideradas nas decisões do cotidiano.',
          'A instituição promove assembleias ou rodas de conversa onde as crianças expressam suas ideias.',
          'As crianças têm voz ativa na escolha de atividades, brincadeiras e projetos pedagógicos.',
          'A instituição documenta e valoriza a participação das crianças como sujeitos de direitos.',
        ],
      },
      {
        code: '6.4',
        label: 'Participação social intersetorial',
        resultadoEsperado: 'Articulação da instituição com o território e outras políticas públicas.',
        parametros: [
          'A instituição participa de fóruns, conselhos e espaços de discussão de políticas para a infância.',
          'A instituição estabelece parcerias com organizações culturais, esportivas e comunitárias do entorno.',
          'A instituição promove atividades que integram as crianças ao ambiente cultural e social do território.',
          'Os profissionais conhecem os equipamentos públicos e serviços disponíveis no entorno da instituição.',
          'A instituição contribui com diagnóstico e planejamento das políticas locais para a primeira infância.',
        ],
      },
    ],
  },
  {
    code: 'M7',
    label: 'Espaços, materiais e mobiliários',
    indicadores: [
      {
        code: '7.1',
        label: 'Espaços e mobiliários que favorecem as experiências das crianças',
        resultadoEsperado: 'Organização de espaços e mobiliários adequados às necessidades e faixas etárias das crianças.',
        parametros: [
          'Os espaços são organizados de forma a favorecer a autonomia, a exploração e a interação das crianças.',
          'Os mobiliários são adequados ao tamanho e à faixa etária das crianças.',
          'Os espaços são organizados em cantos ou ambientes que estimulam diferentes experiências e brincadeiras.',
          'A instituição utiliza os espaços externos e áreas verdes como extensão do ambiente pedagógico.',
          'Os espaços são acessíveis a crianças com deficiência ou mobilidade reduzida.',
        ],
      },
      {
        code: '7.2',
        label: 'Materiais variados e acessíveis às crianças',
        resultadoEsperado: 'Oferta de materiais pedagógicos variados, seguros e acessíveis às crianças.',
        parametros: [
          'A instituição dispõe de materiais pedagógicos variados para estimular as diferentes linguagens e experiências.',
          'Os materiais são organizados de forma acessível, permitindo que as crianças façam escolhas e usem com autonomia.',
          'Os materiais são seguros, sem risco de acidentes, e adequados às faixas etárias atendidas.',
          'A instituição renova e amplia o acervo de materiais pedagógicos periodicamente.',
          'Os materiais representam a diversidade cultural e étnico-racial da sociedade brasileira.',
        ],
      },
      {
        code: '7.3',
        label: 'Espaços, materiais e mobiliários para necessidades dos adultos',
        resultadoEsperado: 'Garantia de espaços adequados para o trabalho e bem-estar dos profissionais.',
        parametros: [
          'A instituição dispõe de sala de professores ou espaço para planejamento e descanso dos profissionais.',
          'Os profissionais têm acesso a materiais e equipamentos necessários para o exercício de suas funções.',
          'Há banheiros adequados e exclusivos para adultos nas dependências da instituição.',
          'Os espaços administrativos são suficientes e adequados para o funcionamento da gestão escolar.',
          'A instituição garante aos profissionais condições ergonômicas adequadas nos espaços de trabalho.',
        ],
      },
    ],
  },
  {
    code: 'M8',
    label: 'Infraestrutura',
    indicadores: [
      {
        code: '8.1',
        label: 'Localização, entorno, acesso e condicionantes físicos',
        resultadoEsperado: 'Garantia de localização adequada e acessibilidade à instituição educativa.',
        parametros: [
          'A instituição está localizada em área de fácil acesso para a comunidade atendida.',
          'O entorno da instituição é seguro e adequado ao trânsito de crianças e famílias.',
          'A edificação possui acessibilidade para pessoas com deficiência ou mobilidade reduzida.',
          'A instituição possui área externa adequada para atividades ao ar livre e recreação das crianças.',
          'As condições físicas da edificação (estrutura, cobertura, instalações) são adequadas e seguras.',
        ],
      },
      {
        code: '8.2',
        label: 'Programa de necessidades, setorização, fluxo e proporções',
        resultadoEsperado: 'Garantia de espaços físicos adequados em quantidade, tamanho e organização para o atendimento da Educação Infantil.',
        parametros: [
          'A instituição possui salas de atividades em quantidade e tamanho adequados para o número de crianças atendidas.',
          'A setorização da edificação respeita a separação adequada entre áreas pedagógicas, administrativas e de serviço.',
          'Os fluxos de circulação são seguros e adequados para o trânsito de crianças e adultos.',
          'A instituição possui refeitório, berçário, fraldário e demais espaços específicos para a faixa etária atendida.',
          'A proporção entre espaços internos e externos é adequada para o desenvolvimento das atividades pedagógicas.',
        ],
      },
    ],
  },
]

export const DESCRIPTOR_LABELS = [
  '',
  'Insuficiente',
  'Abaixo do esperado',
  'Em desenvolvimento',
  'Adequado',
  'Referência',
]

export function getIndicadorByCode(code) {
  for (const meta of METAS_EI) {
    const ind = meta.indicadores.find(i => i.code === code)
    if (ind) return { ...ind, meta }
  }
  return null
}

export function getIndicadoresDasMetas(metasCodes) {
  return METAS_EI
    .filter(m => metasCodes.includes(m.code))
    .flatMap(m => m.indicadores.map(ind => ({ ...ind, meta: m })))
}
