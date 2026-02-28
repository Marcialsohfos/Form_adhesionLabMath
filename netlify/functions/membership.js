// netlify/functions/membership.js
const crypto = require('crypto');
const { MongoClient } = require('mongodb');

// Configuration CORS
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// URI MongoDB (à remplacer avec vos identifiants)
// Créez un compte gratuit sur https://www.mongodb.com/atlas
const MONGODB_URI = process.env.MONGODB_URI || 'votre_uri_mongodb';
const DB_NAME = 'labmath';
const COLLECTION_NAME = 'members';

let cachedClient = null;
let cachedDb = null;

async function connectToDatabase() {
    if (cachedClient && cachedDb) {
        return { client: cachedClient, db: cachedDb };
    }

    const client = new MongoClient(MONGODB_URI);
    await client.connect();
    const db = client.db(DB_NAME);
    
    cachedClient = client;
    cachedDb = db;
    
    return { client, db };
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

        // Route de test
        if (event.httpMethod === 'GET' && (path === '/test' || path === '/test/')) {
            return {
                statusCode: 200,
                headers,
                body: JSON.stringify({
                    success: true,
                    message: 'La fonction membership est opérationnelle',
                    timestamp: new Date().toISOString()
                })
            };
        }

        return {
            statusCode: 404,
            headers,
            body: JSON.stringify({ 
                success: false,
                error: 'Route non trouvée'
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

        const { db } = await connectToDatabase();
        const collection = db.collection(COLLECTION_NAME);

        // Vérifier si l'email existe déjà
        const existingMember = await collection.findOne({ 
            email: data.email.trim().toLowerCase() 
        });
        
        if (existingMember) {
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

        // Insérer dans MongoDB
        await collection.insertOne(newMember);
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
        const { db } = await connectToDatabase();
        const collection = db.collection(COLLECTION_NAME);
        
        const params = event.queryStringParameters || {};
        
        // Construire le filtre
        let filter = {};
        if (params.statut) {
            filter.statut = params.statut;
        }
        
        // Recherche
        if (params.search) {
            const searchRegex = new RegExp(params.search, 'i');
            filter.$or = [
                { prenom: searchRegex },
                { nom: searchRegex },
                { email: searchRegex }
            ];
        }
        
        // Pagination
        const page = parseInt(params.page) || 1;
        const limit = parseInt(params.limit) || 50;
        const skip = (page - 1) * limit;
        
        // Exécuter la requête
        const members = await collection
            .find(filter)
            .sort({ date_soumission: -1 })
            .skip(skip)
            .limit(limit)
            .toArray();
        
        const total = await collection.countDocuments(filter);
        
        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                total: total,
                page: page,
                pages: Math.ceil(total / limit),
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
        const { db } = await connectToDatabase();
        const collection = db.collection(COLLECTION_NAME);
        
        const member = await collection.findOne({ id: id });
        
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
        
        const { db } = await connectToDatabase();
        const collection = db.collection(COLLECTION_NAME);
        
        const updateData = {
            $set: {
                statut: statut,
                date_maj: new Date().toISOString()
            }
        };
        
        if (commentaire) {
            updateData.$set.commentaire_admin = commentaire;
        }
        
        const result = await collection.updateOne(
            { id: id },
            updateData
        );
        
        if (result.matchedCount === 0) {
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
        
        // La clé d'accès (devrait être dans les variables d'environnement)
        const ADMIN_KEY = process.env.ADMIN_KEY || '32015labmath@2026';
        
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