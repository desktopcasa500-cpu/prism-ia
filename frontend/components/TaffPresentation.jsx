import './taff-presentation.css';

const LOGO = '/prism-logo.svg';
const skyA = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_163941_afe19265-9c6b-478a-9f11-38b88fb78361.png';
const skyB = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_164039_58d2db10-831c-4cb0-9beb-16ad40d3a051.png';
const skyC = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_163911_b08367dd-5849-4588-a997-13e1f426c5b9.png';
const tree = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_162947_51f32417-a589-4722-a16e-2e51d670fb12.png';
const macaw = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_163911_27315a30-630f-4aef-b11f-0088d93b0f41.png';
const toucan = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_164513_5eb13b1c-33c9-4384-988c-2e8667a2e9ca.png';
const hummingbird = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_162730_b68b811d-2567-44cd-8e8b-ec92a5a50c91.png';
const owl = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_162731_3400832c-2d59-4703-aa04-eba25f7c9da2.png';
const finalSky = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_161759_cb110b6e-acea-481f-8eee-bb81fd783f6d.png';

function Scene({ image, kicker, title, description, className = '', objectPosition = 'center' }) {
  return (
    <article className={`taff-scene ${className}`}>
      <img src={image} alt="" loading="lazy" style={{ objectPosition }} />
      <div className="taff-scene-wash" aria-hidden="true" />
      <div className="taff-scene-grain" aria-hidden="true" />
      <div className="taff-scene-copy">
        <span>{kicker}</span>
        <h2>{title}</h2>
        {description && <p>{description}</p>}
      </div>
    </article>
  );
}

function Bird({ image, species, index }) {
  return (
    <article className="taff-bird">
      <img src={image} alt="" loading="lazy" />
      <div className="taff-bird-copy">
        <span>{String(index).padStart(2, '0')}</span>
        <strong>{species}</strong>
      </div>
    </article>
  );
}

export default function TaffPresentation() {
  return (
    <section className="taff-presentation" aria-label="Prism Taff 2.0">
      <header className="taff-presentation-head">
        <div className="taff-head-brand"><img src={LOGO} alt="Prism IA" /><span>PRISM IA</span></div>
        <span>TAFF 2.0 / VISUAL STUDY</span>
      </header>

      <section className="taff-intro">
        <div className="taff-intro-stage">
          <img className="taff-intro-logo" src={LOGO} alt="Prism IA" />
          <div className="taff-intro-rule" aria-hidden="true" />
          <h1>TAFF <b>2.0</b></h1>
        </div>
      </section>

      <Scene image={skyA} kicker="I" title="Começamos no céu." description="Uma passagem simples. Luz, espaço e movimento quase imperceptível." className="taff-sky" objectPosition="center 54%" />
      <Scene image={skyB} kicker="II" title="O mundo vai descendo." description="A paisagem muda de escala sem mudar de linguagem." className="taff-sky taff-sky-alt" objectPosition="center 48%" />
      <Scene image={skyC} kicker="III" title="Até encontrar o chão." description="A câmera continua baixa, devagar, até a forma da árvore surgir." className="taff-sky taff-sky-low" objectPosition="center 44%" />
      <Scene image={tree} kicker="IV" title="Uma árvore no papel." description="Desenhada como uma página de caderno: simples, silenciosa, imperfeita." className="taff-tree" objectPosition="center" />

      <section className="taff-birds" aria-label="Pássaros brasileiros">
        <header>
          <span>V / FAUNA BRASILEIRA</span>
          <h2>Depois, uma espécie de cada vez.</h2>
        </header>
        <div className="taff-bird-grid">
          <Bird image={macaw} species="Arara" index={1} />
          <Bird image={toucan} species="Tucano" index={2} />
          <Bird image={hummingbird} species="Beija-flor" index={3} />
          <Bird image={owl} species="Coruja" index={4} />
        </div>
      </section>

      <section className="taff-end">
        <img src={finalSky} alt="" loading="lazy" />
        <div className="taff-end-wash" aria-hidden="true" />
        <div className="taff-end-grain" aria-hidden="true" />
        <div className="taff-end-copy">
          <img src={LOGO} alt="Prism IA" />
          <span>PRISM IA</span>
          <strong>NEW PRISM TAFF 2.0</strong>
        </div>
      </section>
    </section>
  );
}
