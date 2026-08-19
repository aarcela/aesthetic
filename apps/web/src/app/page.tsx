import Link from 'next/link';

const STEPS = [
  {
    title: 'Ve a quién atiende hoy',
    body: 'La agenda muestra hora y paciente, sin menús escondidos.',
  },
  {
    title: 'Cobra en dólares o bolívares',
    body: 'La caja convierte sola. Tú eliges cómo pagó la persona.',
  },
  {
    title: 'Deja el historial en su ficha',
    body: 'Fotos, materiales y notas quedan en el paciente, no en un cuaderno.',
  },
];

export default function LandingPage() {
  return (
    <div className="atmosphere min-h-screen">
      <div className="mx-auto flex min-h-screen max-w-5xl flex-col px-5 pb-[max(2rem,env(safe-area-inset-bottom))] pt-[max(1.5rem,env(safe-area-inset-top))] sm:px-8">
        <header className="flex items-center justify-between gap-4">
          <p className="brand-mark text-2xl text-botanical sm:text-3xl" translate="no">
            Aesthetic
          </p>
          <Link href="/login" className="btn btn-ghost">
            Entrar
          </Link>
        </header>

        <section className="flex flex-1 flex-col justify-center py-16 sm:py-24">
          <p className="mb-3 text-sm font-semibold text-muted">Para clínicas estéticas en Venezuela</p>
          <h1 className="brand-mark max-w-3xl text-pretty text-4xl leading-tight text-botanical sm:text-5xl">
            Agenda, pacientes y caja, en un solo lugar
          </h1>
          <p className="mt-5 max-w-xl text-pretty text-lg leading-relaxed text-muted">
            Hecho para doctoras, especialistas y recepción. Letras grandes, botones claros
            y poco ruido en la pantalla.
          </p>
          <div className="mt-8">
            <Link href="/login" className="btn btn-primary">
              Entrar a la clínica
            </Link>
          </div>
        </section>

        <section className="grid gap-4 pb-10 sm:grid-cols-3">
          {STEPS.map((step) => (
            <article key={step.title} className="panel p-5">
              <h2 className="text-lg font-semibold text-botanical">{step.title}</h2>
              <p className="mt-2 text-pretty text-muted">{step.body}</p>
            </article>
          ))}
        </section>
      </div>
    </div>
  );
}
