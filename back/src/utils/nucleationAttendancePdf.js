// Ficha de presença da Nucleação em PDF: cabeçalho do Movimento, dados do encontro e uma linha por pessoa
// com espaço para assinar.
const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');

const LOGO = path.join(__dirname, '../../../front/imgs/mfc_logo01.png');
const INK = '#1d1b3d';
const MUTED = '#5d5b78';
const LINE = '#9aa0b5';

/** Uma linha por pessoa (noivo e noiva em linhas seguidas). Contatos antigos só têm "Fulano & Fulana" no nome. */
function attendeesFromContacts(contacts) {
  const people = [];
  for (const contact of contacts) {
    const named = [contact.noivo_name, contact.noiva_name].map((n) => String(n || '').trim()).filter(Boolean);
    const names = named.length
      ? named
      : String(contact.name || '').split(/\s+&\s+|\s+e\s+/i).map((n) => n.trim()).filter(Boolean);
    for (const name of names.length ? names : [String(contact.name || '').trim() || 'Sem nome']) people.push(name);
  }
  return people;
}

const dateBr = (iso) => {
  const match = String(iso || '').match(/^(\d{4})-(\d{2})-(\d{2})/);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : '';
};

/** Gera o PDF e devolve um Buffer. `extraRows` = linhas em branco no fim (para quem aparecer e não estiver na lista). */
function buildAttendancePdf({ group, names, extraRows = 3 }) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margins: { top: 40, bottom: 50, left: 40, right: 40 }, bufferPages: true,
      info: { Title: `Ficha de presença — ${group.name}`, Author: 'Movimento Familiar Cristão de Tatuí' } });
    const chunks = [];
    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const colNumber = 34; const colName = 250; const colSign = width - colNumber - colName;
    const rowHeight = 30;
    const bottomLimit = () => doc.page.height - doc.page.margins.bottom - 8;

    const drawHeader = () => {
      let y = 36;
      if (fs.existsSync(LOGO)) doc.image(LOGO, left, y, { fit: [58, 58] });
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(16).text('MOVIMENTO FAMILIAR CRISTÃO', left + 72, y + 6, { width: width - 72 });
      doc.font('Helvetica-Bold').fontSize(13).fillColor(MUTED).text('TATUÍ', left + 72, y + 27, { width: width - 72 });
      y += 70;
      doc.moveTo(left, y).lineTo(left + width, y).lineWidth(1.2).strokeColor(INK).stroke();
      y += 10;
      doc.font('Helvetica-Bold').fontSize(14).fillColor(INK).text('FICHA DE PRESENÇA — NUCLEAÇÃO', left, y, { width });
      y = doc.y + 3;
      doc.font('Helvetica-Bold').fontSize(11).fillColor(INK).text(`Grupo: ${group.name}`, left, y, { width });
      y = doc.y + 2;
      const info = [
        group.event_date && `Data: ${dateBr(group.event_date)}`,
        group.event_time && `Horário: ${group.event_time}`,
        group.location && `Local: ${group.location}`,
        group.leader && `Responsável: ${group.leader}`,
      ].filter(Boolean).join('   ·   ');
      if (info) { doc.font('Helvetica').fontSize(10).fillColor(MUTED).text(info, left, y, { width }); y = doc.y + 2; }
      y += 8;
      // cabeçalho da tabela
      doc.rect(left, y, width, 22).fillColor('#eceaf6').fill();
      doc.fillColor(INK).font('Helvetica-Bold').fontSize(10);
      doc.text('Nº', left + 6, y + 6, { width: colNumber - 8 });
      doc.text('NOME', left + colNumber + 6, y + 6, { width: colName - 10 });
      doc.text('ASSINATURA', left + colNumber + colName + 6, y + 6, { width: colSign - 10 });
      return y + 22;
    };

    let y = drawHeader();
    const drawRow = (index, name) => {
      if (y + rowHeight > bottomLimit()) { doc.addPage(); y = drawHeader(); }
      doc.moveTo(left, y + rowHeight).lineTo(left + width, y + rowHeight).lineWidth(0.6).strokeColor(LINE).stroke();
      doc.moveTo(left + colNumber, y).lineTo(left + colNumber, y + rowHeight).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.moveTo(left + colNumber + colName, y).lineTo(left + colNumber + colName, y + rowHeight).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.moveTo(left, y).lineTo(left, y + rowHeight).moveTo(left + width, y).lineTo(left + width, y + rowHeight).lineWidth(0.4).strokeColor(LINE).stroke();
      doc.fillColor(MUTED).font('Helvetica').fontSize(9).text(String(index), left + 6, y + rowHeight / 2 - 4, { width: colNumber - 8 });
      if (name) doc.fillColor(INK).font('Helvetica').fontSize(11).text(name, left + colNumber + 6, y + rowHeight / 2 - 6, { width: colName - 12, height: rowHeight - 4, ellipsis: true, lineBreak: false });
      y += rowHeight;
    };

    names.forEach((name, i) => drawRow(i + 1, name));
    for (let i = 0; i < extraRows; i += 1) drawRow(names.length + i + 1, '');

    // Rodapé com página e data de emissão em todas as páginas
    const range = doc.bufferedPageRange();
    const issued = new Date().toLocaleDateString('pt-BR');
    for (let i = range.start; i < range.start + range.count; i += 1) {
      doc.switchToPage(i);
      doc.page.margins.bottom = 0; // escrever abaixo da margem faria o PDFKit abrir outra página
      doc.font('Helvetica').fontSize(8).fillColor(MUTED);
      const footerY = doc.page.height - 34;
      doc.text(`Movimento Familiar Cristão de Tatuí · ${names.length} ${names.length === 1 ? 'pessoa' : 'pessoas'} · emitida em ${issued}`, left, footerY, { width: width - 90, lineBreak: false });
      doc.text(`Página ${i - range.start + 1} de ${range.count}`, left + width - 90, footerY, { width: 90, align: 'right', lineBreak: false });
    }
    doc.end();
  });
}

module.exports = { attendeesFromContacts, buildAttendancePdf };
