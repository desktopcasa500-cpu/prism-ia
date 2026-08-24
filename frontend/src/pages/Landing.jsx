import { Link } from 'react-router-dom';

const models = ['Prism Nano 1.0A', 'Prism Mini 1.0A', 'Prism Edge 1.0A', 'Prism Tex 1.0A', 'Prism Taff 2.0'];
const plans = [
  { name: 'Free', price: 'R$ 0', desc: 'Comece a explorar o Prism IA.' },
  { name: 'Base', price: 'R$ 29', desc: 'Mais créditos e modelos avançados.' },
  { name: 'Medium', price: 'R$ 59', desc: 'Orquestração avançada para projetos.' },
  { name: 'Pro', price: 'R$ 119', desc: 'Mais potência para desenvolvimento.' },
  { name: 'Empresarial', price: 'Sob consulta', desc: 'Escala, equipes e infraestrutura dedicada.' },
];

export default function Landing() {
  return (
    <div>
      <nav className="container" style={{ display: 'flex', justifyContent: 'space-between', paddingTop: 24 }}>
        <strong style={{ fontSize: 22 }}>Prism IA</strong>
        <div style={{ display: 'flex', gap: 10 }}><Link to="/login" className="btn btn-ghost">Entrar</Link><Link to="/register" className="btn btn-primary">Começar</Link></div>
      </nav>
      <header className="container" style={{ textAlign: 'center', padding: '96px 24px 48px' }}>
        <p style={{ color: 'var(--purple)' }}>PRISM IA</p>
        <h1 style={{ fontSize: 52, lineHeight: 1.05, margin: '12px auto 20px', maxWidth: 900 }}>Crie mais rápido com <span style={{ color: 'var(--purple)' }}>orquestração paralela</span> de modelos de IA</h1>
        <p style={{ color: 'var(--text-dim)', fontSize: 18, maxWidth: 640, margin: '0 auto 32px' }}>Gemini, Groq e NVIDIA trabalhando simultaneamente para gerar, revisar e otimizar seus projetos.</p>
        <Link to="/register" className="btn btn-primary">Criar Conta Grátis</Link>
      </header>
      <section className="container" style={{ padding: '40px 24px' }}>
        <h2 style={{ textAlign: 'center' }}>Modelos Prism</h2>
        <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center', marginTop: 24 }}>{models.map((m) => <div key={m} className="glass" style={{ padding: '16px 22px' }}>{m}</div>)}</div>
      </section>
      <section className="container" style={{ padding: '60px 24px' }}>
        <h2 style={{ textAlign: 'center' }}>Planos</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(190px,1fr))', gap: 16, marginTop: 24 }}>{plans.map((p) => <div key={p.name} className="glass" style={{ padding: 24 }}><h3>{p.name}</h3><strong style={{ fontSize: 24 }}>{p.price}</strong><p style={{ color: 'var(--text-dim)' }}>{p.desc}</p></div>)}</div>
      </section>
    </div>
  );
}
