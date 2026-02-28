// netlify/functions/membership.js
const crypto = require('crypto');

// Configuration CORS
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// Clé d'administration (à changer en production)
const ADMIN_KEY = '32015labmath@2026';

// Stockage en mémoire (sera réinitialisé à chaque déploiement)
// Pour la production, utilisez une vraie base de données comme MongoDB Atlas ou Airtable
let inMemoryDB = [];

// Charger les données initiales depuis l'environnement ou un service externe
// Pour l'instant, on initialise avec des données de test
const initializeDB = () => {
    if (inMemoryDB.length === 0) {
        // Données de test
        inMemoryDB = [
            {
                id: 'MEM_' + Date.now() + '_test1',
                prenom: 'Jean',
                nom: 'MARTIN',
                email: 'jean.martin@example.com',
                telephone: '+237 620 307 439',
                domaine: 'Intelligence Artificielle',
                date_soumission: new Date().toISOString(),
                statut: 'en_attente'
            }
        ];
    }
    return inMemoryDB;
};

// Gestionnaire principal
exports.handler = async (event) => {
    // Gérer les requêtes OPTIONS (CORS preflight)
    if (event.httpMethod === 'OPTIONS') {
        return {
            statusCode: 200,
            headers,
            body: ''
        };
    }

    try {
        const path = event.path.replace('/.netlify/functions/membership', '');
        console.log('Méthode:', event.httpMethod, 'Path:', path);
        
        // Routes
        if (event.httpMethod === 'POST' && path === '/submit') {
            return await submitMembership(event);
        }
        
        if (event.httpMethod === 'GET' && path === '/members') {
            return await getAllMembers(event);
        }
        
        if (event.httpMethod === 'GET' && path.startsWith('/member/')) {
            const id = path.replace('/member/', '');
            return await getMemberById(id);
        }
        
        if (event.httpMethod === 'POST' && path === '/login') {
            return await adminLogin(event);
        }
        
        if (event.httpMethod === 'PUT' && path.startsWith('/update/')) {
            const id = path.replace('/update/', '');
            return await updateMemberStatus(event, id);
        }

        // Route de test
        if (event.httpMethod === 'GET' && path === '/test') {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'La fonction membership est opérationnelle',
                    timestamp: new Date().toISOString(),
                    membersCount: inMemoryDB.length
                })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
                success: false,
                error: 'Route non trouvée',
                path: path 
            })
        };
    } catch (error) {
        console.error('Erreur globale:', error);
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

// Soumission du formulaire
async function submitMembership(event) {
    try {
        const data = JSON.parse(event.body || '{}');
        console.log('Données reçues:', JSON.stringify(data, null, 2));
        
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

        // Initialiser la DB
        const members = initializeDB();

        // Vérifier si l'email existe déjà
        const emailExists = members.some(m => m.email && m.email.toLowerCase() === data.email.toLowerCase());
        if (emailExists) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Cet email est déjà utilisé pour une adhésion' 
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
            statut: 'en_attente'
        };

        // Ajouter le nouveau membre
        members.push(newMember);
        console.log('Membre ajouté avec succès:', newMember.email, 'ID:', newMember.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Votre demande d\'adhésion a été enregistrée avec succès',
                id: id
            })
        };

    } catch (error) {
        console.error('Erreur soumission:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de l\'enregistrement. Veuillez réessayer.',
                details: error.message
            })
        };
    }
}

// Récupérer tous les membres
async function getAllMembers(event) {
    try {
        const members = initializeDB();
        
        // Vérifier l'authentification pour l'accès admin
        const authHeader = event.headers.authorization || event.headers.Authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Non autorisé'
                })
            };
        }

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                total: members.length,
                data: members
            })
        };
        
    } catch (error) {
        console.error('Erreur getAllMembers:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de la récupération des membres',
                details: error.message
            })
        };
    }
}

// Récupérer un membre par ID
async function getMemberById(id) {
    try {
        const members = initializeDB();
        const member = members.find(m => m.id === id);
        
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
        console.error('Erreur getMemberById:', error);
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

// Mettre à jour le statut d'un membre
async function updateMemberStatus(event, id) {
    try {
        const data = JSON.parse(event.body || '{}');
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
        
        const members = initializeDB();
        const index = members.findIndex(m => m.id === id);
        
        if (index === -1) {
            return {
                statusCode: 404,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Membre non trouvé'
                })
            };
        }
        
        members[index].statut = statut;
        members[index].date_maj = new Date().toISOString();
        if (commentaire) {
            members[index].commentaire_admin = commentaire;
        }
        
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
        console.error('Erreur updateMemberStatus:', error);
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

// Connexion admin
async function adminLogin(event) {
    try {
        const data = JSON.parse(event.body || '{}');
        const { password } = data;
        
        if (password === ADMIN_KEY) {
            // Générer un token simple
            const token = crypto.randomBytes(32).toString('hex');
            
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'Connexion réussie',
                    token: token
                })
            };
        } else {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Clé d\'accès invalide'
                })
            };
        }
    } catch (error) {
        console.error('Erreur adminLogin:', error);
        return {
            statusCode: 500,
            headers,
            body: JSON.stringify({
                success: false,
                error: 'Erreur lors de la connexion'
            })
        };
    }
}