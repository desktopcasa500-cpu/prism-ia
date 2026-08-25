import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../lib/auth.jsx';
const TOPICS={
roteamento:['Roteamento','Como a Prism escolhe e combina motores.',[
'Roteamento é o processo interno que decide, para cada mensagem enviada, quais motores de IA externos serão acionados. A escolha depende do modelo selecionado (Nano, Mini, Edge, Tex ou Taff) e do nível de esforço definido no Effort Slider.',
'Em perfis mais leves, a mensagem pode ser direcionada a um único motor, priorizando velocidade. Em perfis mais avançados, a mesma mensagem é enviada simultaneamente para mais de um motor, e as respostas são comparadas e combinadas antes de chegar até você.',
'O roteamento também considera disponibilidade e tempo de resposta de cada provedor no momento da chamada, para manter a experiência estável mesmo se um motor específico estiver mais lento.' ]],
motores:['Motores externos','Gemini, Groq e NVIDIA NIM.',[
'A Prism IA não possui um modelo de linguagem próprio: ela se conecta a motores de IA mantidos por outras empresas e organiza o uso deles de forma combinada. Atualmente, três motores externos compõem a base da plataforma:',
'Google Gemini — utilizado principalmente para raciocínio conceitual, planejamento de arquitetura de software e estruturação de contexto antes da geração de código.',
'Groq — infraestrutura especializada em inferência de altíssima velocidade, usada para gerar e refatorar código rapidamente.',
'NVIDIA NIM — utilizado para validação de código, otimização técnica (incluindo tarefas 2D/3D) e revisão de segurança.',
'Cada motor tem pontos fortes diferentes, e é justamente a combinação entre eles — e não um motor isolado — que sustenta a proposta da Prism IA.' ]],
openrouter:['OpenRouter','A camada intermediária de modelos.',[
'OpenRouter é um serviço que funciona como intermediário entre a Prism IA e alguns provedores de modelos de IA, permitindo o acesso a diferentes motores através de uma única integração técnica, em vez de uma conexão direta com cada provedor individualmente.',
'A Prism IA utiliza esse tipo de camada intermediária para acessar determinados motores, como os modelos disponibilizados via NVIDIA. Isso simplifica a manutenção da plataforma, mas também significa que a disponibilidade desses motores específicos depende, em parte, do funcionamento do serviço intermediário além do provedor original.' ]],
orquestracao:['Orquestração paralela','Execução, comparação e síntese.',[
'Orquestração paralela é o mecanismo central da Prism IA: em vez de esperar a resposta de um motor para só então consultar outro, a plataforma envia a mesma solicitação simultaneamente para múltiplos motores.',
'Enquanto Gemini trabalha o raciocínio e a estrutura, Groq gera o código correspondente em alta velocidade, e o NVIDIA NIM valida e otimiza o resultado — tudo ao mesmo tempo. Um módulo interno, o sintetizador, recebe essas respostas paralelas, identifica divergências, corrige inconsistências e consolida tudo em uma única resposta final.',
'Esse processo é o que caracteriza o modo Ultracode, o nível mais alto de orquestração da plataforma, reservado para tarefas mais complexas ou críticas.' ]],
creditos:['Créditos e tokens','Como funciona o consumo.',[
'Cada interação com a Prism IA consome tokens — unidades de processamento de texto usadas pelos motores de IA para interpretar sua mensagem e gerar a resposta. O consumo varia conforme:',
'O modelo escolhido: perfis mais leves (Nano, Mini) consomem menos tokens por chamarem menos motores; perfis avançados (Taff, Ultracode) consomem mais, por acionarem múltiplos motores em paralelo.',
'O nível de esforço: no Effort Slider, um esforço maior aumenta a profundidade de processamento e, consequentemente, o consumo.',
'O tamanho da tarefa: projetos com mais arquivos, mais contexto ou respostas mais longas naturalmente usam mais tokens.',
'Os créditos disponíveis em cada conta são definidos pelo plano contratado, e o consumo é sempre calculado e descontado individualmente por usuário.' ]],
privacidade:['Privacidade','Isolamento de contas e credenciais.',[
'Todos os dados de uso — mensagens, histórico de conversas, métricas de tokens e sessões — são vinculados exclusivamente ao user_id de cada conta autenticada.',
'Nenhuma consulta ao banco de dados cruza informações entre contas diferentes, e novas contas sempre começam zeradas, sem histórico ou métricas de outros usuários.',
'As chaves de acesso às APIs dos motores externos (Gemini, Groq, NVIDIA) ficam armazenadas exclusivamente no backend da plataforma e nunca são expostas no navegador ou em qualquer resposta enviada ao usuário final.' ]],
limites:['Limites','Rate limiting e regras por plano.',[
'Para manter a plataforma estável para todos os usuários, a Prism IA aplica limites de uso (rate limiting) tanto por conta quanto por endereço de IP, evitando picos que possam prejudicar o desempenho geral do serviço. Além disso, cada plano de assinatura define regras próprias de acesso:',
'Grátis: acesso restrito aos modelos Nano e Mini, com cota reduzida.',
'Base, Medium e Pro: cotas progressivamente maiores, com acesso gradual aos modelos Edge, Tex e Taff.',
'Empresarial: sem restrição ao modo Ultracode, com prioridade de fila nos servidores.',
'Ao atingir o limite do plano, novas solicitações ficam temporariamente bloqueadas ou reduzidas em velocidade, até a renovação do ciclo ou upgrade de plano.' ]]
};
function Header(){const {user}=useAuth();const label=user?.name||user?.email?.split('@')[0]||'Perfil';return <header className="site-header"><Link to="/" className="site-brand"><span className="site-mark"/>PRISM IA</Link><nav><Link to="/informacoes">Informações</Link><Link to="/modelos">Modelos</Link><Link className="active" to="/termos">Termos</Link></nav>{user?<Link to="/chat" className="site-account"><span>{label.slice(0,2).toUpperCase()}</span>{label}</Link>:<Link to="/login" className="site-login">Login</Link>}</header>}
export default function TermDetail(){const {topic}=useParams();const data=TOPICS[topic]||TOPICS.roteamento;return <div className="brutal-detail editorial-page"><Header/><main><section className="detail-main"><Link to="/termos" className="detail-back">← todos os termos</Link><div className="detail-index">PRISM / TERMOS / {topic}</div><h1>{data[0]}</h1><p className="detail-summary">{data[1]}</p><div className="detail-rule"/><div className="term-full-copy">{data[2].map((text,i)=><p key={i}>{text}</p>)}</div><Link className="detail-next" to="/termos">Ver todos os termos →</Link></section></main></div>}
