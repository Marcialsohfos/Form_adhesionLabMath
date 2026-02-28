// build.js
const fs = require('fs');
const path = require('path');

console.log('=== DÉMARRAGE DU BUILD ===');
console.log('Variables d\'environnement disponibles:');
console.log('https://fbwfollnqdavorcvizxq.supabase.co:', process.env.https://fbwfollnqdavorcvizxq.supabase.co ? '✓ définie' : '✗ NON DÉFINIE');
console.log('sb_secret_Sm7BUoW9CKDGRzX_5LHxNQ_RmeejInq:', process.env.sb_secret_Sm7BUoW9CKDGRzX_5LHxNQ_RmeejInq ? '✓ définie' : '✗ NON DÉFINIE');

if (!process.env.SUPABASE_URL || !process.env.SUPABASE_SERVICE_KEY) {
  console.error('❌ ERREUR: Les variables Supabase ne sont pas définies!');
  console.error('Vérifiez dans Netlify → Site settings → Environment variables');
  process.exit(1);  // Arrête le build en erreur
}

// Lire le fichier template
const templatePath = path.join(__dirname, 'netlify', 'functions', 'membership-template.js');
const outputPath = path.join(__dirname, 'netlify', 'functions', 'membership.js');

let content = fs.readFileSync(templatePath, 'utf8');

// Remplacer les variables
content = content.replace('${https://fbwfollnqdavorcvizxq.supabase.co}', process.env.SUPABASE_URL);
content = content.replace('${sb_secret_Sm7BUoW9CKDGRzX_5LHxNQ_RmeejInq}', process.env.SUPABASE_SERVICE_KEY);

// Écrire le fichier de sortie
fs.writeFileSync(outputPath, content);

console.log('✅ membership.js généré avec succès !');
console.log('URL:', process.env.SUPABASE_URL.substring(0, 20) + '...');
console.log('KEY:', process.env.SUPABASE_SERVICE_KEY.substring(0, 10) + '...');