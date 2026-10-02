const Arrow = () => <span aria-hidden="true">↗</span>;

const services = [
  { number: "01", title: "Reformas integrales", text: "Transformamos tu vivienda de principio a fin: distribución, instalaciones, acabados y dirección de obra." },
  { number: "02", title: "Cocinas a medida", text: "Espacios funcionales y luminosos, diseñados alrededor de tu forma de cocinar y compartir." },
  { number: "03", title: "Baños con carácter", text: "Materiales duraderos, soluciones inteligentes y cada detalle cuidado al milímetro." },
];

const projects = [
  { place: "Madrid · Chamberí", title: "Casa Olmo", type: "Reforma integral · 2024", image: "https://images.unsplash.com/photo-1600566753190-17f0baa2a6c3?auto=format&fit=crop&w=1400&q=85" },
  { place: "Madrid · Retiro", title: "Apartamento Luz", type: "Cocina y salón · 2024", image: "https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1400&q=85" },
];

export default function Home() {
  return (
    <main>
      <header className="nav shell">
        <a className="brand" href="#inicio" aria-label="Norte Reformas, inicio"><span>N</span>NORTE<small>REFORMAS</small></a>
        <nav aria-label="Navegación principal">
          <a href="#servicios">Servicios</a><a href="#proyectos">Proyectos</a><a href="#nosotros">Nosotros</a>
        </nav>
        <a className="navCta" href="#contacto">Hablemos <Arrow /></a>
      </header>

      <section className="hero" id="inicio">
        <div className="heroImage" role="img" aria-label="Salón moderno reformado con grandes ventanales" />
        <div className="heroShade" />
        <div className="heroContent shell">
          <p className="eyebrow light">REFORMAS CON ALMA · MADRID</p>
          <h1>Espacios para<br /><em>vivir mejor.</em></h1>
          <div className="heroBottom">
            <p>Diseñamos y construimos hogares que<br />se sienten tuyos desde el primer día.</p>
            <a className="button cream" href="#contacto">CUÉNTANOS TU PROYECTO <Arrow /></a>
          </div>
        </div>
        <a className="scroll" href="#servicios">DESCUBRE MÁS <span>↓</span></a>
      </section>

      <section className="intro shell" id="nosotros">
        <p className="eyebrow">LO HACEMOS SENCILLO</p>
        <div>
          <h2>Tu casa, en buenas manos.</h2>
          <p className="lead">Sabemos que una reforma puede imponer. Por eso te acompañamos de principio a fin con un proceso claro, un equipo propio y un compromiso sencillo: cumplir lo acordado.</p>
          <div className="stats"><p><strong>+12</strong><span>AÑOS DE EXPERIENCIA</span></p><p><strong>180</strong><span>HOGARES REFORMADOS</span></p><p><strong>4.9</strong><span>VALORACIÓN MEDIA</span></p></div>
        </div>
      </section>

      <section className="services" id="servicios">
        <div className="shell">
          <div className="sectionHead"><div><p className="eyebrow">LO QUE HACEMOS</p><h2>Reformas pensadas<br /><em>para disfrutarlas.</em></h2></div><p>Un único equipo para todo el proceso.<br />Sin intermediarios. Sin sorpresas.</p></div>
          <div className="serviceGrid">
            {services.map((service) => <article key={service.number}><span>{service.number}</span><div className="icon">⌂</div><h3>{service.title}</h3><p>{service.text}</p><a href="#contacto" aria-label={`Más sobre ${service.title}`}>SABER MÁS <Arrow /></a></article>)}
          </div>
        </div>
      </section>

      <section className="work shell" id="proyectos">
        <div className="sectionHead"><div><p className="eyebrow">ÚLTIMOS PROYECTOS</p><h2>Casas que ya cuentan<br /><em>nuevas historias.</em></h2></div><a className="textLink" href="#contacto">VER TODOS LOS PROYECTOS <Arrow /></a></div>
        <div className="projects">
          {projects.map((project, index) => <article className={index ? "offset" : ""} key={project.title}>
            <div className="projectImage" style={{ backgroundImage: `url(${project.image})` }}><a href="#contacto" aria-label={`Ver ${project.title}`}>VER PROYECTO <Arrow /></a></div>
            <p>{project.place}</p><h3>{project.title}</h3><span>{project.type}</span>
          </article>)}
        </div>
      </section>

      <section className="contact" id="contacto"><div className="shell contactInner">
        <p className="eyebrow light">¿TIENES UN PROYECTO EN MENTE?</p><h2>Hagamos de tu casa<br /><em>tu lugar favorito.</em></h2><p>Cuéntanos qué imaginas. Te responderemos en menos de 24 horas.</p><a className="button cream" href="mailto:hola@nortereformas.es">HOLA@NORTEREFORMAS.ES <Arrow /></a>
      </div></section>
      <footer className="shell"><div className="brand"><span>N</span>NORTE<small>REFORMAS</small></div><p>Madrid · 910 234 567</p><p>© 2025 Norte Reformas</p></footer>
    </main>
  );
}
