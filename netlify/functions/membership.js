// netlify/functions/membership.js
// Gère toutes les opérations d'adhésion pour Lab_Math
// Compatible avec Netlify Functions

const crypto = require('crypto');

// Configuration CORS pour permettre les requêtes depuis votre site
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// Gestionnaire principal
exports.handler = async (event) => {
    // Gérer les requêtes OPTIONS (pre-flight CORS)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        // Router selon la méthode HTTP et le chemin
        const path = event.path.replace('/.netlify/functions/membership', '');
        
        switch (event.httpMethod) {
            case 'GET':
                return await handleGet(event, path);
            case 'POST':
                return await handlePost(event, path);
            case 'PUT':
                return await handlePut(event, path);
            case 'DELETE':
                return await handleDelete(event, path);
            default:
                return {
                    statusCode: 405,
                    headers,
                    body: JSON.stringify({ error: 'Méthode non autorisée' })
                };
        }
    } catch (error) {
        console.error('Erreur:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Erreur serveur interne',
                details: error.message 
            })
        };
    }
};

// ==================== GESTION DES REQUÊTES GET ====================
async function handleGet(event, path) {
    const params = event.queryStringParameters || {};
    
    // Route: /membership/members - Récupère tous les membres
    if (path === '/members' || path === '/members/') {
        return await getAllMembers(params);
    }
    
    // Route: /membership/member/:id - Récupère un membre spécifique
    if (path.startsWith('/member/')) {
        const id = path.replace('/member/', '');
        return await getMemberById(id);
    }
    
    // Route: /membership/stats - Récupère les statistiques
    if (path === '/stats' || path === '/stats/') {
        return await getStats();
    }
    
    // Route: /membership/export - Export CSV
    if (path === '/export' || path === '/export/') {
        return await exportMembers(params.format);
    }
    
    // Route par défaut
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Route non trouvée' })
    };
}

// ==================== GESTION DES REQUÊTES POST ====================
async function handlePost(event, path) {
    const data = JSON.parse(event.body || '{}');
    
    // Route: /membership/submit - Soumission du formulaire d'adhésion
    if (path === '/submit' || path === '/submit/') {
        return await submitMembership(data);
    }
    
    // Route: /membership/login - Connexion admin
    if (path === '/login' || path === '/login/') {
        return await adminLogin(data);
    }
    
    // Route: /membership/verify - Vérification d'email
    if (path === '/verify' || path === '/verify/') {
        return await verifyEmail(data);
    }
    
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Route non trouvée' })
    };
}

// ==================== GESTION DES REQUÊTES PUT ====================
async function handlePut(event, path) {
    const data = JSON.parse(event.body || '{}');
    
    // Route: /membership/update/:id - Mise à jour du statut
    if (path.startsWith('/update/')) {
        const id = path.replace('/update/', '');
        return await updateMemberStatus(id, data);
    }
    
    // Route: /membership/member/:id - Mise à jour complète
    if (path.startsWith('/member/')) {
        const id = path.replace('/member/', '');
        return await updateMember(id, data);
    }
    
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Route non trouvée' })
    };
}

// ==================== GESTION DES REQUÊTES DELETE ====================
async function handleDelete(event, path) {
    // Route: /membership/member/:id - Suppression d'un membre
    if (path.startsWith('/member/')) {
        const id = path.replace('/member/', '');
        return await deleteMember(id);
    }
    
    return {
        statusCode: 404,
        headers,
        body: JSON.stringify({ error: 'Route non trouvée' })
    };
}

// ==================== FONCTIONS MÉTIER ====================

/**
 * Soumission du formulaire d'adhésion
 */
async function submitMembership(data) {
    // Validation des données requises
    const required = ['prenom', 'nom', 'email', 'telephone', 'titre', 'domaine', 'motivation'];
    for (const field of required) {
        if (!data[field] || data[field].trim() === '') {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: `Le champ ${field} est requis` 
                })
            };
        }
    }

    // Validation email
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({ 
                success: false, 
                error: 'Format d\'email invalide' 
            })
        };
    }

    // Générer un ID unique
    const id = 'MEM_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');

    // Créer l'objet membre complet
    const newMember = {
        id: id,
        prenom: data.prenom.trim(),
        nom: data.nom.trim().toUpperCase(),
        dateNaissance: data.dateNaissance || '',
        nationalite: data.nationalite || '',
        email: data.email.trim().toLowerCase(),
        telephone: data.telephone.trim(),
        adresse: data.adresse || '',
        ville: data.ville || '',
        pays: data.pays || '',
        titre: data.titre.trim(),
        institution: data.institution || '',
        domaine: data.domaine,
        presentation: data.presentation || '',
        motivation: data.motivation.trim(),
        interets: data.interets || '',
        liens: data.liens || '',
        newsletter: data.newsletter || false,
        date_soumission: new Date().toISOString(),
        statut: 'en_attente',
        ip: event.headers['client-ip'] || event.headers['x-forwarded-for'] || 'unknown',
        userAgent: event.headers['user-agent'] || 'unknown'
    };

    try {
        // ICI : Sauvegarde dans votre système de stockage
        // Option 1: Airtable (recommandé)
        const airtableResult = await saveToAirtable(newMember);
        
        // Option 2: Google Sheets (via API)
        // const sheetsResult = await saveToGoogleSheets(newMember);
        
        // Option 3: MongoDB Atlas
        // const mongoResult = await saveToMongoDB(newMember);
        
        // Option 4: Fichier JSON (si vous utilisez un stockage de fichiers)
        // const jsonResult = await saveToJSON(newMember);

        // Envoyer un email de confirmation
        await sendConfirmationEmail(newMember);

        // Journaliser l'action
        console.log(`Nouvelle adhésion: ${newMember.prenom} ${newMember.nom} - ${newMember.email}`);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Votre demande d\'adhésion a été enregistrée avec succès',
                id: id,
                data: {
                    prenom: newMember.prenom,
                    nom: newMember.nom,
                    email: newMember.email,
                    statut: newMember.statut
                }
            })
        };

    } catch (error) {
        console.error('Erreur sauvegarde:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de l\'enregistrement. Veuillez réessayer.'
            })
        };
    }
}

/**
 * Récupère tous les membres (pour l'admin)
 */
async function getAllMembers(params) {
    try {
        // ICI : Récupération depuis votre système de stockage
        const members = await fetchAllFromStorage(params);
        
        // Filtrer selon les paramètres
        let filteredMembers = members;
        
        if (params.statut) {
            filteredMembers = filteredMembers.filter(m => m.statut === params.statut);
        }
        
        if (params.domaine) {
            filteredMembers = filteredMembers.filter(m => m.domaine === params.domaine);
        }
        
        if (params.search) {
            const searchLower = params.search.toLowerCase();
            filteredMembers = filteredMembers.filter(m => 
                m.prenom.toLowerCase().includes(searchLower) ||
                m.nom.toLowerCase().includes(searchLower) ||
                m.email.toLowerCase().includes(searchLower)
            );
        }
        
        // Pagination
        const page = parseInt(params.page) || 1;
        const limit = parseInt(params.limit) || 50;
        const start = (page - 1) * limit;
        const paginatedMembers = filteredMembers.slice(start, start + limit);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                total: filteredMembers.length,
                page: page,
                pages: Math.ceil(filteredMembers.length / limit),
                data: paginatedMembers
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de la récupération des membres'
            })
        };
    }
}

/**
 * Récupère un membre par son ID
 */
async function getMemberById(id) {
    try {
        const member = await findMemberById(id);
        
        if (!member) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Membre non trouvé'
                })
            };
        }
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: member
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de la récupération du membre'
            })
        };
    }
}

/**
 * Met à jour le statut d'un membre
 */
async function updateMemberStatus(id, data) {
    const { statut, commentaire } = data;
    
    if (!['en_attente', 'accepte', 'refuse'].includes(statut)) {
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Statut invalide'
            })
        };
    }
    
    try {
        // ICI : Mise à jour dans votre système de stockage
        const updated = await updateMemberInStorage(id, { 
            statut: statut,
            date_maj: new Date().toISOString(),
            commentaire_admin: commentaire || ''
        });
        
        if (!updated) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Membre non trouvé'
                })
            };
        }
        
        // Envoyer un email de notification
        await sendStatusNotificationEmail(id, statut, commentaire);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: `Statut mis à jour: ${statut}`,
                data: { id, statut }
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de la mise à jour'
            })
        };
    }
}

/**
 * Statistiques
 */
async function getStats() {
    try {
        const members = await fetchAllFromStorage({});
        
        const stats = {
            total: members.length,
            en_attente: members.filter(m => m.statut === 'en_attente').length,
            accepte: members.filter(m => m.statut === 'accepte').length,
            refuse: members.filter(m => m.statut === 'refuse').length,
            par_domaine: {},
            par_mois: {},
            newsletter: members.filter(m => m.newsletter).length
        };
        
        // Statistiques par domaine
        members.forEach(m => {
            const domaine = m.domaine || 'non_spécifié';
            stats.par_domaine[domaine] = (stats.par_domaine[domaine] || 0) + 1;
        });
        
        // Statistiques par mois
        members.forEach(m => {
            if (m.date_soumission) {
                const mois = m.date_soumission.substring(0, 7); // YYYY-MM
                stats.par_mois[mois] = (stats.par_mois[mois] || 0) + 1;
            }
        });
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                data: stats
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors du calcul des statistiques'
            })
        };
    }
}

/**
 * Export CSV
 */
async function exportMembers(format = 'csv') {
    try {
        const members = await fetchAllFromStorage({});
        
        if (format === 'csv') {
            // Créer le CSV
            const headers = ['ID', 'Prénom', 'Nom', 'Email', 'Téléphone', 'Titre', 'Domaine', 'Statut', 'Date'];
            const csvRows = [];
            
            csvRows.push(headers.join(','));
            
            members.forEach(m => {
                const row = [
                    m.id,
                    `"${m.prenom}"`,
                    `"${m.nom}"`,
                    `"${m.email}"`,
                    `"${m.telephone}"`,
                    `"${m.titre}"`,
                    m.domaine,
                    m.statut,
                    m.date_soumission ? m.date_soumission.substring(0, 10) : ''
                ];
                csvRows.push(row.join(','));
            });
            
            const csv = csvRows.join('\n');
            
            return {
                statusCode: 200,
                headers: {
                    ...headers,
                    'Content-Type': 'text/csv',
                    'Content-Disposition': 'attachment; filename=members_export.csv'
                },
                body: csv
            };
        }
        
        return {
            statusCode: 400,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Format non supporté'
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de l\'export'
            })
        };
    }
}

/**
 * Connexion admin
 */
async function adminLogin(data) {
    const { username, password } = data;
    
    // À remplacer par votre système d'authentification
    const ADMIN_USERNAME = process.env.ADMIN_USERNAME || 'admin';
    const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'LabMath2025!';
    
    if (username === ADMIN_USERNAME && password === ADMIN_PASSWORD) {
        // Générer un token simple (en production, utilisez JWT)
        const token = crypto.randomBytes(32).toString('hex');
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Connexion réussie',
                token: token,
                expires: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
            })
        };
    } else {
        return {
            statusCode: 401,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Identifiants invalides'
            })
        };
    }
}

/**
 * Vérification d'email (pour éviter les doublons)
 */
async function verifyEmail(data) {
    const { email } = data;
    
    try {
        const members = await fetchAllFromStorage({});
        const existing = members.find(m => m.email.toLowerCase() === email.toLowerCase());
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                exists: !!existing,
                message: existing ? 'Cet email est déjà utilisé' : 'Email disponible'
            })
        };
        
    } catch (error) {
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de la vérification'
            })
        };
    }
}

// ==================== FONCTIONS DE STOCKAGE ====================

/**
 * Sauvegarde dans Airtable (recommandé)
 */
async function saveToAirtable(member) {
    const AIRTABLE_API_KEY = process.env.AIRTABLE_API_KEY;
    const AIRTABLE_BASE_ID = process.env.AIRTABLE_BASE_ID;
    const AIRTABLE_TABLE = process.env.AIRTABLE_TABLE || 'Adhésions';
    
    if (!AIRTABLE_API_KEY || !AIRTABLE_BASE_ID) {
        console.warn('Airtable non configuré, utilisation du stockage local');
        return await saveToLocalJSON(member);
    }
    
    const response = await fetch(`https://api.airtable.com/v0/${AIRTABLE_BASE_ID}/${AIRTABLE_TABLE}`, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${AIRTABLE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            records: [{
                fields: {
                    'ID': member.id,
                    'Prénom': member.prenom,
                    'Nom': member.nom,
                    'Email': member.email,
                    'Téléphone': member.telephone,
                    'Titre': member.titre,
                    'Domaine': member.domaine,
                    'Motivation': member.motivation,
                    'Statut': member.statut,
                    'Date': member.date_soumission.split('T')[0],
                    'Newsletter': member.newsletter ? 'Oui' : 'Non'
                }
            }]
        })
    });
    
    return await response.json();
}

/**
 * Sauvegarde dans un fichier JSON local (pour développement)
 */
async function saveToLocalJSON(member) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const filePath = path.resolve(__dirname, '../../data.json');
    
    try {
        let data = [];
        try {
            const content = await fs.readFile(filePath, 'utf8');
            data = JSON.parse(content);
        } catch (e) {
            // Fichier n'existe pas encore
        }
        
        data.push(member);
        await fs.writeFile(filePath, JSON.stringify(data, null, 2));
        
        return { success: true, id: member.id };
    } catch (error) {
        console.error('Erreur sauvegarde locale:', error);
        throw error;
    }
}

/**
 * Récupère tous les membres depuis le stockage
 */
async function fetchAllFromStorage(params = {}) {
    // À adapter selon votre système de stockage
    try {
        const fs = require('fs').promises;
        const path = require('path');
        
        const filePath = path.resolve(__dirname, '../../data.json');
        const content = await fs.readFile(filePath, 'utf8');
        return JSON.parse(content);
    } catch (e) {
        return [];
    }
}

/**
 * Trouve un membre par son ID
 */
async function findMemberById(id) {
    const members = await fetchAllFromStorage();
    return members.find(m => m.id === id);
}

/**
 * Met à jour un membre dans le stockage
 */
async function updateMemberInStorage(id, updates) {
    const fs = require('fs').promises;
    const path = require('path');
    
    const filePath = path.resolve(__dirname, '../../data.json');
    let members = await fetchAllFromStorage();
    let found = false;
    
    members = members.map(m => {
        if (m.id === id) {
            found = true;
            return { ...m, ...updates };
        }
        return m;
    });
    
    if (found) {
        await fs.writeFile(filePath, JSON.stringify(members, null, 2));
    }
    
    return found;
}

// ==================== FONCTIONS EMAIL ====================

/**
 * Envoie un email de confirmation
 */
async function sendConfirmationEmail(member) {
    // À implémenter avec SendGrid, Mailgun, etc.
    console.log(`Email de confirmation envoyé à ${member.email}`);
    return true;
}

/**
 * Envoie une notification de changement de statut
 */
async function sendStatusNotificationEmail(id, statut, commentaire) {
    const member = await findMemberById(id);
    if (!member) return false;
    
    console.log(`Notification de statut envoyée à ${member.email}: ${statut}`);
    return true;
}

// ==================== FONCTIONS UTILITAIRES ====================

/**
 * Valide un email
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Génère un ID unique
 */
function generateId() {
    return 'MEM_' + Date.now() + '_' + crypto.randomBytes(4).toString('hex');
}

/**
 * Formate une date
 */
function formatDate(date) {
    return new Date(date).toLocaleDateString('fr-FR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
}