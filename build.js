// build.js
const fs = require('fs');
const path = require('path');

// Lire le fichier template
const templatePath = path.join(__dirname, 'netlify', 'functions', 'membership.template.js');
const outputPath = path.join(__dirname, 'netlify', 'functions', 'membership.js');

let content = fs.readFileSync(templatePath, 'utf8');

// Remplacer les variables par leurs valeurs (prises des variables d'env)
content = content.replace('${SUPABASE_URL}', process.env.SUPABASE_URL || '');
content = content.replace('${SUPABASE_SERVICE_KEY}', process.env.SUPABASE_SERVICE_KEY || '');

// Écrire le fichier de sortie
fs.writeFileSync(outputPath, content);

console.log('✅ membership.js généré avec succès !');
console.log('URL:', process.env.SUPABASE_URL ? '✓ définie' : '✗ manquante');
console.log('KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓ définie' : '✗ manquante');