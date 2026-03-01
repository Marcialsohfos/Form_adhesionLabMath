const fs = require('fs');
const path = require('path');

console.log('=== DÉMARRAGE DU BUILD ===');

// Copier le template vers membership.js
const templatePath = path.join(__dirname, 'netlify', 'functions', 'membership-template.js');
const outputPath = path.join(__dirname, 'netlify', 'functions', 'membership.js');

if (!fs.existsSync(templatePath)) {
    console.error('❌ Template non trouvé!');
    process.exit(1);
}

fs.copyFileSync(templatePath, outputPath);
console.log('✓ Fichier membership.js généré avec succès');