// netlify/functions/membership.js
const crypto = require('crypto');
const fs = require('fs').promises;
const path = require('path');

// Configuration CORS
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// Chemin du fichier de données - Version corrigée avec chemin absolu
const DATA_FILE_PATH = path.join('/tmp', 'data.json'); // Utilisation du dossier temporaire sur Netlify

// Fonction pour lire les données
async function readData() {
    try {
        const data = await fs.readFile(DATA_FILE_PATH, 'utf8');
        return JSON.parse(data);
    } catch (error) {
        // Si le fichier n'existe pas, retourner un tableau vide
        console.log('Fichier non trouvé, création d\'un nouveau tableau');
        return [];
    }
}

// Fonction pour écrire les données
async function writeData(data) {
    try {
        await fs.writeFile(DATA_FILE_PATH, JSON.stringify(data, null, 2));
        console.log('Données sauvegardées avec succès');
    } catch (error) {
        console.error('Erreur écriture fichier:', error);
        throw error;
    }
}

// Gestionnaire principal
exports.handler = async (event) => {
    // Gérer les requêtes OPTIONS
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
        if (event.httpMethod === 'POST' && (path === '/submit' || path === '/submit/')) {
            return await submitMembership(event);
        }
        
        if (event.httpMethod === 'GET' && (path === '/members' || path === '/members/')) {
            return await getAllMembers(event);
        }
        
        if (event.httpMethod === 'GET' && path.startsWith('/member/')) {
            const id = path.replace('/member/', '');
            return await getMemberById(id);
        }
        
        if (event.httpMethod === 'POST' && (path === '/login' || path === '/login/')) {
            return await adminLogin(event);
        }
        
        if (event.httpMethod === 'PUT' && path.startsWith('/update/')) {
            const id = path.replace('/update/', '');
            return await updateMemberStatus(event, id);
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ error: 'Route non trouvée' })
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
        console.log('Données reçues:', data);
        
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

        // Lire les données existantes
        const members = await readData();

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
        
        // Sauvegarder dans le fichier
        await writeData(members);
        console.log('Membre ajouté avec succès:', newMember.email);

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
                error: 'Erreur lors de l\'enregistrement. Veuillez réessayer.'
            })
        };
    }
}

// Récupérer tous les membres
async function getAllMembers(event) {
    try {
        const members = await readData();
        const params = event.queryStringParameters || {};
        
        // Filtrer selon le statut si spécifié
        let filteredMembers = members;
        if (params.statut) {
            filteredMembers = filteredMembers.filter(m => m.statut === params.statut);
        }
        
        // Recherche
        if (params.search) {
            const searchLower = params.search.toLowerCase();
            filteredMembers = filteredMembers.filter(m => 
                (m.prenom && m.prenom.toLowerCase().includes(searchLower)) ||
                (m.nom && m.nom.toLowerCase().includes(searchLower)) ||
                (m.email && m.email.toLowerCase().includes(searchLower))
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
        console.error('Erreur getAllMembers:', error);
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

// Récupérer un membre par ID
async function getMemberById(id) {
    try {
        const members = await readData();
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
        
        const members = await readData();
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
        
        await writeData(members);
        
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
        
        // La clé d'accès que vous avez fournie
        const ADMIN_KEY = '32015labmath@2026';
        
        if (password === ADMIN_KEY) {
            // Générer un token simple
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