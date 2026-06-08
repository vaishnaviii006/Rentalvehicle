import fs from 'fs';

const code = fs.readFileSync('src/components/BookedVehicles.jsx', 'utf8');
const lines = code.split('\n');

// Parse lines between 2174 and 3137
let stack = [];
for (let i = 2173; i < 3137; i++) {
  const line = lines[i];
  // Simple regex to find divs
  const opens = (line.match(/<div[ >]/g) || []).length;
  const closes = (line.match(/<\/div>/g) || []).length;
  if (opens > 0 || closes > 0) {
    console.log(`Line ${i+1}: Opens: ${opens}, Closes: ${closes} | ${line.trim().substring(0, 60)}`);
  }
}
