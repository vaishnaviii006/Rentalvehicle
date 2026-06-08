import fs from 'fs';

const filePath = '../client/src/components/BookedVehicles.jsx';
try {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  lines.forEach((line, index) => {
    if (line.includes('currentRentalCost') || line.includes('currentRentalCost =') || line.includes('currentRentalCost:')) {
      console.log(`${index + 1}: ${line.trim()}`);
    }
  });
} catch (error) {
  console.error('Error:', error);
}
