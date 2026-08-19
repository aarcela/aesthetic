export type VisitPrescriptionKind = 'full' | 'indications' | 'exams';

export type VisitPrescriptionData = {
  kind: VisitPrescriptionKind;
  clinicName: string;
  clinicTaxId?: string | null;
  locationName?: string | null;
  specialistName: string;
  patientName: string;
  patientNationalId?: string | null;
  patientAge?: number | null;
  visitDate: string;
  serviceName?: string | null;
  visitDiagnosis?: string | null;
  indications?: string | null;
  requestedExams?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatBlock(value?: string | null) {
  if (!value?.trim()) return '';
  return escapeHtml(value.trim()).replace(/\n/g, '<br />');
}

function documentTitle(kind: VisitPrescriptionKind) {
  if (kind === 'exams') return 'Orden de exámenes';
  if (kind === 'indications') return 'Receta / Indicaciones';
  return 'Receta médica';
}

function buildSections(data: VisitPrescriptionData) {
  const sections: Array<{ title: string; body: string }> = [];
  const diagnosis = formatBlock(data.visitDiagnosis);
  const indications = formatBlock(data.indications);
  const exams = formatBlock(data.requestedExams);

  if (data.kind === 'full' || data.kind === 'indications' || data.kind === 'exams') {
    if (diagnosis) sections.push({ title: 'Diagnóstico', body: diagnosis });
  }

  if ((data.kind === 'full' || data.kind === 'indications') && indications) {
    sections.push({ title: 'Indicaciones / Tratamiento', body: indications });
  }

  if ((data.kind === 'full' || data.kind === 'exams') && exams) {
    sections.push({ title: 'Exámenes solicitados', body: exams });
  }

  return sections;
}

function buildHtml(data: VisitPrescriptionData) {
  const sections = buildSections(data);
  const title = documentTitle(data.kind);
  const patientMeta = [
    data.patientNationalId ? `CI: ${escapeHtml(data.patientNationalId)}` : null,
    data.patientAge != null ? `${data.patientAge} años` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const sectionHtml =
    sections.length > 0
      ? sections
          .map(
            (section) => `
        <section class="section">
          <h2>${escapeHtml(section.title)}</h2>
          <div class="body">${section.body}</div>
        </section>`,
          )
          .join('')
      : `<p class="empty">No hay contenido clínico para imprimir en este documento.</p>`;

  return `<!DOCTYPE html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)} · ${escapeHtml(data.patientName)}</title>
    <style>
      @page { margin: 18mm 16mm; size: A4; }
      * { box-sizing: border-box; }
      body {
        margin: 0;
        color: #1c2422;
        font: 14px/1.5 Georgia, "Times New Roman", serif;
      }
      .sheet {
        max-width: 720px;
        margin: 0 auto;
      }
      .header {
        text-align: center;
        border-bottom: 2px solid #163f3b;
        padding-bottom: 12px;
        margin-bottom: 20px;
      }
      .clinic {
        font-size: 22px;
        font-weight: 700;
        letter-spacing: 0.02em;
        color: #163f3b;
      }
      .meta {
        margin-top: 6px;
        font-size: 12px;
        color: #5b6b66;
      }
      .doc-title {
        margin: 18px 0 14px;
        text-align: center;
        font-size: 16px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.08em;
      }
      .patient-grid {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 16px;
        margin-bottom: 18px;
        font-size: 13px;
      }
      .label {
        display: block;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #5b6b66;
        margin-bottom: 2px;
      }
      .section {
        margin: 16px 0;
        page-break-inside: avoid;
      }
      .section h2 {
        margin: 0 0 8px;
        font-size: 12px;
        text-transform: uppercase;
        letter-spacing: 0.06em;
        color: #163f3b;
      }
      .section .body {
        min-height: 48px;
        padding: 10px 12px;
        border: 1px solid rgba(22, 63, 59, 0.18);
        border-radius: 8px;
        white-space: pre-wrap;
      }
      .rx {
        margin-top: 8px;
        font-size: 28px;
        font-weight: 700;
        color: #163f3b;
      }
      .footer {
        margin-top: 36px;
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 24px;
        font-size: 12px;
      }
      .sign-line {
        margin-top: 48px;
        border-top: 1px solid #1c2422;
        padding-top: 6px;
        text-align: center;
      }
      .empty {
        color: #5b6b66;
        font-style: italic;
      }
    </style>
  </head>
  <body>
    <div class="sheet">
      <header class="header">
        <div class="clinic">${escapeHtml(data.clinicName)}</div>
        <div class="meta">
          ${data.clinicTaxId ? `RIF: ${escapeHtml(data.clinicTaxId)}` : ''}
          ${data.clinicTaxId && data.locationName ? ' · ' : ''}
          ${data.locationName ? escapeHtml(data.locationName) : ''}
        </div>
      </header>

      <div class="doc-title">${escapeHtml(title)}</div>

      <div class="patient-grid">
        <div>
          <span class="label">Paciente</span>
          <strong>${escapeHtml(data.patientName)}</strong>
          ${patientMeta ? `<div>${patientMeta}</div>` : ''}
        </div>
        <div>
          <span class="label">Fecha</span>
          <strong>${escapeHtml(data.visitDate)}</strong>
          ${
            data.serviceName
              ? `<div><span class="label">Procedimiento</span>${escapeHtml(data.serviceName)}</div>`
              : ''
          }
        </div>
      </div>

      ${sectionHtml}

      ${
        data.kind !== 'exams' && formatBlock(data.indications)
          ? '<div class="rx" aria-hidden="true">℞</div>'
          : ''
      }

      <footer class="footer">
        <div>
          <span class="label">Profesional tratante</span>
          <div>${escapeHtml(data.specialistName)}</div>
        </div>
        <div>
          <div class="sign-line">Firma y sello</div>
        </div>
      </footer>
    </div>
    <script>
      window.onload = function () {
        window.focus();
        window.print();
      };
    </script>
  </body>
</html>`;
}

export function printVisitPrescription(data: VisitPrescriptionData) {
  const sections = buildSections(data);
  if (sections.length === 0) {
    return false;
  }

  const popup = window.open('', '_blank', 'noopener,noreferrer,width=900,height=700');
  if (!popup) {
    return false;
  }

  popup.document.open();
  popup.document.write(buildHtml(data));
  popup.document.close();
  return true;
}

export function visitHasPrintableContent(
  data: Pick<
    VisitPrescriptionData,
    'kind' | 'visitDiagnosis' | 'indications' | 'requestedExams'
  >,
) {
  return buildSections({
    ...data,
    clinicName: '',
    specialistName: '',
    patientName: '',
    visitDate: '',
  }).length > 0;
}
