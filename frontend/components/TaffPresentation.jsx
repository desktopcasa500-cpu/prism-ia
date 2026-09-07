import './taff-presentation.css';

const skyA = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_163941_afe19265-9c6b-478a-9f11-38b88fb78361.png';
const skyB = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_164039_58d2db10-831c-4cb0-9beb-16ad40d3a051.png';
const macaw = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_163911_27315a30-630f-4aef-b11f-0088d93b0f41.png';
const toucan = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_164513_5eb13b1c-33c9-4384-988c-2e8667a2e9ca.png';
const reveal = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_163910_c3ea17b8-7ea6-4d4d-8c1c-51734aa7e8f0.png';

function Scene({ image, eyebrow, title, copy, className = '' }) {
  return (
    <article className={`taff-scene ${className}`}>
      <img src={image} alt="" loading="lazy" />
      <div className="taff-scene-shade" />
      <div className="taff-scene-copy">
        <span>{eyebrow}</span>
        <h3>{title}</h3>
        {copy && <p>{copy}</p>}
      </div>
    </article>
  );
}

export default function TaffPresentation() {
  return (
    <section className="taff-presentation" aria-label="TAFF 2.0">
      <div className="taff-presentation-head">
        <span>PRISM / TAFF 2.0</span>
        <span>VISUAL STUDY / 01</span>
      </div>

      <Scene
        image={skyA}
        eyebrow="TAFF 2.0 / DESCENT"
        title="Da altura, tudo desacelera."
        copy="Uma passagem aérea suave abre a sequência antes da fauna aparecer."
        className="taff-sky"
      />

      <Scene
        image={skyB}
        eyebrow="TAFF 2.0 / ATMOSPHERE"
        title="A paisagem vira textura."
        copy="Azul, pêssego, rosa queimado e creme permanecem no mesmo registro pictórico."
        className="taff-sky taff-sky-secondary"
      />

      <Scene
        image={macaw}
        eyebrow="TAFF 2.0 / FAUNA 01"
        title="Brasil, observado de perto."
        copy="A arara-azul entra como uma prancha de história natural, leve e detalhada."
        className="taff-fauna"
      />

      <Scene
        image={toucan}
        eyebrow="TAFF 2.0 / FAUNA 02"
        title="Outra espécie. O mesmo mundo."
        copy="O tucano amplia a sequência sem quebrar a linguagem pictórica e a paleta do filme."
        className="taff-fauna taff-fauna-secondary"
      />

      <article className="taff-reveal" style={{ backgroundImage: `url(${reveal})` }}>
        <div className="taff-reveal-overlay" />
        <div className="taff-reveal-center">
          <span>PRISM PRESENTS</span>
          <div className="taff-reveal-title">TAFF 2.0</div>
        </div>
      </article>
    </section>
  );
}
