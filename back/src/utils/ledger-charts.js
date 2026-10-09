// Gráficos nativos DrawingML: editáveis no Excel e vinculados às células do painel.
// Estrutura: https://learn.microsoft.com/office/open-xml/spreadsheet/how-to-insert-a-chart-into-a-spreadsheet
const JSZip = require('jszip');
const xml = value => String(value).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' }[char]));
const declaration = '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>';
const relns = 'http://schemas.openxmlformats.org/officeDocument/2006/relationships';

function chartXml({ title, series, months, line = false }) {
  const seriesXml = series.map((serie, index) => `<c:ser><c:idx val="${index}"/><c:order val="${index}"/><c:tx><c:v>${xml(serie.name)}</c:v></c:tx><c:spPr>${line ? `<a:ln w="28575"><a:solidFill><a:srgbClr val="${serie.color}"/></a:solidFill></a:ln>` : `<a:solidFill><a:srgbClr val="${serie.color}"/></a:solidFill><a:ln><a:noFill/></a:ln>`}</c:spPr>${line ? '<c:marker><c:symbol val="circle"/><c:size val="5"/></c:marker>' : ''}<c:cat><c:strRef><c:f>'Painel'!$A$13:$A$24</c:f><c:strCache><c:ptCount val="12"/>${months.map((name, i) => `<c:pt idx="${i}"><c:v>${xml(name)}</c:v></c:pt>`).join('')}</c:strCache></c:strRef></c:cat><c:val><c:numRef><c:f>'Painel'!$${serie.column}$13:$${serie.column}$24</c:f><c:numCache><c:formatCode>#,##0.00</c:formatCode><c:ptCount val="12"/>${serie.values.map((value, i) => `<c:pt idx="${i}"><c:v>${Number(value) || 0}</c:v></c:pt>`).join('')}</c:numCache></c:numRef></c:val>${line ? '<c:smooth val="0"/>' : ''}</c:ser>`).join('');
  const kind = line ? 'lineChart' : 'barChart';
  return `${declaration}<c:chartSpace xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="${relns}"><c:lang val="pt-BR"/><c:chart><c:title><c:tx><c:rich><a:bodyPr/><a:lstStyle/><a:p><a:r><a:rPr lang="pt-BR" sz="1400" b="1"/><a:t>${xml(title)}</a:t></a:r></a:p></c:rich></c:tx><c:overlay val="0"/></c:title><c:autoTitleDeleted val="0"/><c:plotArea><c:layout/><c:${kind}>${line ? '<c:grouping val="standard"/>' : '<c:barDir val="col"/><c:grouping val="clustered"/>'}<c:varyColors val="0"/>${seriesXml}${line ? '' : '<c:gapWidth val="75"/><c:overlap val="0"/>'}<c:axId val="10001"/><c:axId val="10002"/></c:${kind}><c:catAx><c:axId val="10001"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="b"/><c:tickLblPos val="nextTo"/><c:crossAx val="10002"/><c:crosses val="autoZero"/><c:auto val="1"/><c:lblAlgn val="ctr"/><c:lblOffset val="100"/></c:catAx><c:valAx><c:axId val="10002"/><c:scaling><c:orientation val="minMax"/></c:scaling><c:delete val="0"/><c:axPos val="l"/><c:majorGridlines/><c:numFmt formatCode="#,##0" sourceLinked="0"/><c:tickLblPos val="nextTo"/><c:crossAx val="10001"/><c:crosses val="autoZero"/><c:crossBetween val="between"/></c:valAx></c:plotArea><c:legend><c:legendPos val="b"/><c:overlay val="0"/></c:legend><c:plotVisOnly val="1"/><c:dispBlanksAs val="gap"/></c:chart><c:spPr><a:solidFill><a:srgbClr val="FFFFFF"/></a:solidFill><a:ln><a:solidFill><a:srgbClr val="DFE7F3"/></a:solidFill></a:ln></c:spPr></c:chartSpace>`;
}

async function attachLedgerCharts(buffer, charts) {
  const zip = await JSZip.loadAsync(buffer);
  // ExcelJS 4.4 grava legacyDrawing depois de tableParts quando há notas e tabelas.
  // CT_Worksheet exige o desenho das notas antes de tableParts/extLst. O Excel
  // descarta a aba inteira se essa sequência estiver invertida (outros leitores toleram).
  for (const name of Object.keys(zip.files).filter(name => /^xl\/worksheets\/sheet\d+\.xml$/.test(name))) {
    const source = await zip.file(name).async('string');
    const legacy = source.match(/<legacyDrawing\b[^>]*\/>/g);
    if (!legacy) continue;
    const without = source.replace(/<legacyDrawing\b[^>]*\/>/g, '');
    const next = /<(?:legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/.exec(without);
    const position = next ? next.index : without.lastIndexOf('</worksheet>');
    zip.file(name, without.slice(0, position) + legacy.join('') + without.slice(position));
  }
  const anchors = charts.map((chart, i) => {
    zip.file(`xl/charts/chart${i + 1}.xml`, chartXml(chart));
    return `<xdr:twoCellAnchor><xdr:from><xdr:col>8</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${6 + i * 19}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:from><xdr:to><xdr:col>17</xdr:col><xdr:colOff>0</xdr:colOff><xdr:row>${23 + i * 19}</xdr:row><xdr:rowOff>0</xdr:rowOff></xdr:to><xdr:graphicFrame macro=""><xdr:nvGraphicFramePr><xdr:cNvPr id="${i + 1}" name="Gráfico ${i + 1}"/><xdr:cNvGraphicFramePr/></xdr:nvGraphicFramePr><xdr:xfrm><a:off x="0" y="0"/><a:ext cx="0" cy="0"/></xdr:xfrm><a:graphic><a:graphicData uri="http://schemas.openxmlformats.org/drawingml/2006/chart"><c:chart xmlns:c="http://schemas.openxmlformats.org/drawingml/2006/chart" xmlns:r="${relns}" r:id="rId${i + 1}"/></a:graphicData></a:graphic></xdr:graphicFrame><xdr:clientData/></xdr:twoCellAnchor>`;
  });
  zip.file('xl/drawings/drawingLedger.xml', `${declaration}<xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main">${anchors.join('')}</xdr:wsDr>`);
  zip.file('xl/drawings/_rels/drawingLedger.xml.rels', `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${charts.map((_, i) => `<Relationship Id="rId${i + 1}" Type="${relns}/chart" Target="../charts/chart${i + 1}.xml"/>`).join('')}</Relationships>`);
  const relPath = 'xl/worksheets/_rels/sheet1.xml.rels';
  const relationships = zip.file(relPath) ? await zip.file(relPath).async('string') : `${declaration}<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"></Relationships>`;
  zip.file(relPath, relationships.replace('</Relationships>', `<Relationship Id="rIdLedgerCharts" Type="${relns}/drawing" Target="../drawings/drawingLedger.xml"/></Relationships>`));
  const sheet = await zip.file('xl/worksheets/sheet1.xml').async('string');
  // O desenho aparece após pageSetup/headerFooter e antes de tableParts/extLst.
  const drawing = '<drawing r:id="rIdLedgerCharts"/>';
  const nextDrawingElement = /<(?:legacyDrawing|legacyDrawingHF|drawingHF|picture|oleObjects|controls|webPublishItems|tableParts|extLst)\b/.exec(sheet);
  const drawingPosition = nextDrawingElement ? nextDrawingElement.index : sheet.lastIndexOf('</worksheet>');
  zip.file('xl/worksheets/sheet1.xml', sheet.slice(0, drawingPosition) + drawing + sheet.slice(drawingPosition));
  const types = await zip.file('[Content_Types].xml').async('string');
  zip.file('[Content_Types].xml', types.replace('</Types>', `<Override PartName="/xl/drawings/drawingLedger.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>${charts.map((_, i) => `<Override PartName="/xl/charts/chart${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.drawingml.chart+xml"/>`).join('')}</Types>`));
  return zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
}
module.exports = { attachLedgerCharts };
