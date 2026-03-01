// build.js
const fs = require('fs');
const path = require('path');

console.log('=== DÉMARRAGE DU BUILD ===');

// Vérifier que le fichier de config existe
const configPath = path.join(__dirname, 'netlify', 'functions', 'supabase-config.js');
if (!fs.existsSync(configPath)) {
    console.error('❌ Fichier supabase-config.js non trouvé!');
    console.error('Créez-le à partir de supabase-config.example.js');
    process.exit(1);
}

// Copier le template vers membership.js (simple copie, pas de remplacement)
const templatePath = path.join(__dirname, 'netlify', 'functions', 'membership-template.js');
const outputPath = path.join(__dirname, 'netlify', 'functions', 'membership.js');

fs.copyFileSync(templatePath, outputPath);
console.log('✓ Fichier membership.js généré par copie');

console.log('✅ BUILD TERMINÉ AVEC SUCCÈS');