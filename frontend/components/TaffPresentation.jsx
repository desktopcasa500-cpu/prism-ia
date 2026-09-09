import './taff-presentation.css';

const LOGO = '/prism-logo.svg';
const POSTER = 'https://d8j0ntlcm91z4.cloudfront.net/user_3IgyPK9KRpa0YtpAdolGkHQafSY/hf_20260907_163941_afe19265-9c6b-478a-9f11-38b88fb78361.png';
const VIDEO_SRC = import.meta.env.VITE_TAFF_2_VIDEO_URL || '/taff-2.0.mp4';

export default function TaffPresentation() {
  return (
    <main className="taff-presentation" aria-label="Prism Taff 2.0">
      <video
        className="taff-film"
        autoPlay
        muted
        loop
        playsInline
        controls
        preload="metadata"
        poster={POSTER}
      >
        <source src={VIDEO_SRC} type="video/mp4" />
      </video>

      <div className="taff-film-vignette" aria-hidden="true" />
      <header className="taff-film-header">
        <div className="taff-film-brand">
          <img src={LOGO} alt="Prism IA" />
          <span>PRISM IA</span>
        </div>
        <span>TAFF 2.0</span>
      </header>
      <div className="taff-film-mark" aria-hidden="true">TAFF 2.0</div>
    </main>
  );
}
