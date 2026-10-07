const XLSX = require('xlsx');
const path = require('path');

const filePath = 'c:\\Users\\Eduardo\\Desktop\\MFC\\mfc-system\\Lançamentos Diários MFC 2026.xlsx';
const workbook = XLSX.readFile(filePath);
const sheetName = workbook.SheetNames[0];
const worksheet = workbook.Sheets[sheetName];
const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });

console.log('--- HEADERS ---');
console.log(data[0]);
console.log('--- SAMPLE ROWS ---');
for (let i = 1; i < 10; i++) {
  if (data[i]) {
    console.log(`Row ${i}:`, JSON.stringify(data[i]));
  }
}
