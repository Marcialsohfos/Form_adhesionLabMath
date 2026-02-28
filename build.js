
// build.js
const fs = require('fs');
const path = require('path');

// Lire le fichier template (avec le nouveau nom)
const templatePath = path.join(__dirname, 'netlify', 'functions', 'membership-template.js');
const outputPath = path.join(__dirname, 'netlify', 'functions', 'membership.js');

let content = fs.readFileSync(templatePath, 'utf8');

// Remplacer les variables par leurs valeurs
content = content.replace('${https://fbwfollnqdavorcvizxq.supabase.co}', process.env.SUPABASE_URL || '');
content = content.replace('${sb_secret_Sm7BUoW9CKDGRzX_5LHxNQ_RmeejInq}', process.env.SUPABASE_SERVICE_KEY || '');

// Écrire le fichier de sortie
fs.writeFileSync(outputPath, content);

console.log('✅ membership.js généré avec succès !');
console.log('URL:', process.env.SUPABASE_URL ? '✓ définie' : '✗ manquante');
console.log('KEY:', process.env.SUPABASE_SERVICE_KEY ? '✓ définie' : '✗ manquante');