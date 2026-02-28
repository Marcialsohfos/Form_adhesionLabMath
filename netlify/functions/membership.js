// netlify/functions/membership.js avec Supabase
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

// Configuration CORS
const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Content-Type': 'application/json'
};

// Clé d'administration (pour l'authentification admin)
const ADMIN_KEY = '32015labmath@2026';
const validTokens = new Set();

// Configuration Supabase (à mettre dans les variables d'environnement Netlify)
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_KEY; // La clé service_role (sécure)

// Initialisation du client Supabase avec la clé service (pour les opérations admin)
const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Nom de la table
const TABLE_NAME = 'adhesions';

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

        // Routes publiques (sans authentification)
        if (event.httpMethod === 'POST' && path === '/submit') {
            return await submitMembership(event);
        }
        
        if (event.httpMethod === 'POST' && path === '/login') {
            return await adminLogin(event);
        }

        if (event.httpMethod === 'GET' && path === '/test') {
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

        // Routes protégées (nécessitent authentification)
        const authHeader = event.headers.authorization || event.headers.Authorization;
        
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Non autorisé - Token manquant'
                })
            };
        }

        const token = authHeader.substring(7); // Enlever "Bearer "
        
        // Vérifier si le token est valide
        if (!validTokens.has(token)) {
            return {
                statusCode: 401,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Non autorisé - Token invalide'
                })
            };
        }

        // Routes protégées
        if (event.httpMethod === 'GET' && path === '/members') {
            return await getAllMembers();
        }
        
        if (event.httpMethod === 'GET' && path.startsWith('/member/')) {
            const id = path.replace('/member/', '');
            return await getMemberById(id);
        }
        
        if (event.httpMethod === 'PUT' && path.startsWith('/update/')) {
            const id = path.replace('/update/', '');
            return await updateMemberStatus(event, id);
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
                error: 'Erreur serveur interne: ' + error.message 
            })
        };
    }
};

// Soumission du formulaire (publique)
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

        // Vérifier si l'email existe déjà dans Supabase
        const { data: existingUser, error: checkError } = await supabase
            .from(TABLE_NAME)
            .select('email')
            .eq('email', data.email.toLowerCase())
            .maybeSingle();

        if (checkError) {
            console.error('Erreur vérification email:', checkError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Erreur lors de la vérification'
                })
            };
        }

        if (existingUser) {
            return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ 
                    success: false, 
                    error: 'Cet email est déjà utilisé pour une adhésion' 
                })
            };
        }

        // Préparer les données pour Supabase
        const memberData = {
            prenom: data.prenom.trim(),
            nom: data.nom.trim().toUpperCase(),
            date_naissance: data.dateNaissance || null,
            nationalite: data.nationalite || null,
            email: data.email.trim().toLowerCase(),
            telephone: data.telephone.trim(),
            adresse: data.adresse || null,
            ville: data.ville || null,
            pays: data.pays || null,
            titre: data.titre.trim(),
            institution: data.institution || null,
            domaine: data.domaine,
            presentation: data.presentation || null,
            motivation: data.motivation.trim(),
            interets: data.interets || null,
            liens: data.liens || null,
            newsletter: data.newsletter || false,
            statut: 'en_attente'
        };

        // Insérer dans Supabase
        const { data: newMember, error: insertError } = await supabase
            .from(TABLE_NAME)
            .insert([memberData])
            .select()
            .single();

        if (insertError) {
            console.error('Erreur insertion Supabase:', insertError);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Erreur lors de l\'enregistrement dans la base de données'
                })
            };
        }

        console.log('Membre ajouté avec succès:', newMember.email, 'ID:', newMember.id);

        return {
            statusCode: 200,
            headers,
            body: JSON.stringify({
                success: true,
                message: 'Votre demande d\'adhésion a été enregistrée avec succès',
                id: newMember.id
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

// Récupérer tous les membres (protégé)
async function getAllMembers() {
    try {
        const { data: members, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .order('date_soumission', { ascending: false });

        if (error) {
            console.error('Erreur Supabase:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Erreur lors de la récupération des membres'
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
                error: 'Erreur lors de la récupération des membres'
            })
        };
    }
}

// Récupérer un membre par ID (protégé)
async function getMemberById(id) {
    try {
        const { data: member, error } = await supabase
            .from(TABLE_NAME)
            .select('*')
            .eq('id', id)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return {
                    statusCode: 404,
                    headers,
                    body: JSON.stringify({
                        success: false,
                        error: 'Membre non trouvé'
                    })
                };
            }
            throw error;
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

// Mettre à jour le statut d'un membre (protégé)
async function updateMemberStatus(event, id) {
    try {
        const data = JSON.parse(event.body || '{}');
        const { statut } = data;
        
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

        const { data: updatedMember, error } = await supabase
            .from(TABLE_NAME)
            .update({ 
                statut: statut,
                date_maj: new Date().toISOString()
            })
            .eq('id', id)
            .select()
            .single();

        if (error) {
            console.error('Erreur mise à jour:', error);
            return {
                statusCode: 500,
                headers,
                body: JSON.stringify({
                    success: false,
                    error: 'Erreur lors de la mise à jour'
                })
            };
        }

        if (!updatedMember) {
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
                data: updatedMember
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

// Connexion admin (publique)
async function adminLogin(event) {
    try {
        const data = JSON.parse(event.body || '{}');
        const { password } = data;
        
        console.log('Tentative de connexion admin');
        
        if (password === ADMIN_KEY) {
            // Générer un token unique
            const token = crypto.randomBytes(32).toString('hex');
            
            // Stocker le token valide
            validTokens.add(token);
            
            // Nettoyer les anciens tokens (garder les 100 plus récents)
            if (validTokens.size > 100) {
                const tokensArray = Array.from(validTokens);
                const tokensToKeep = tokensArray.slice(-100);
                validTokens.clear();
                tokensToKeep.forEach(t => validTokens.add(t));
            }
            
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