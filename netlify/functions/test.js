// netlify/functions/test.js
exports.handler = async (event) => {
    return {
        statusCode: 200,
        headers: {
            'Access-Control-Allow-Origin': '*',
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            success: true,
            message: 'La fonction Netlify fonctionne correctement !',
            timestamp: new Date().toISOString()
        })
    };
};