import fs from 'fs';

const code = fs.readFileSync('src/components/BookedVehicles.jsx', 'utf8');
const lines = code.split('\n');

let level = 0;
let tags = [];

for (let i = 2173; i < 3145; i++) {
  const line = lines[i];
  
  // Find all JSX tags in this line (very basic token extraction)
  // Match <div ...> or <div> or </div>
  const regex = /<\/?div(?: [^>]*)?>/g;
  let match;
  while ((match = regex.exec(line)) !== null) {
    const tag = match[0];
    if (tag.startsWith('</')) {
      level--;
      tags.pop();
      // console.log(`Line ${i+1}: Close -> Level ${level} (${tag})`);
    } else {
      level++;
      tags.push({ line: i+1, content: tag });
      // console.log(`Line ${i+1}: Open  -> Level ${level} (${tag})`);
    }
  }
}

console.log('Final Stack Level:', level);
if (level !== 0) {
  console.log('Unclosed tags:', tags);
} else {
  console.log('Nesting is perfectly balanced!');
}
