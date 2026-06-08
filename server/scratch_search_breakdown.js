import fs from 'fs';

const filePath = '../client/src/components/BookedVehicles.jsx';
try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('Rental Charges Breakdown') || line.includes('Base Plan Cost') || line.includes('Extra Hour Charge') || line.includes('Extra KM Charge') || line.includes('Actual Rental Bill')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
} catch (error) {
  console.error('Error:', error);
}
