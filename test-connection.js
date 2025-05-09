const { MongoClient } = require('mongodb');

async function testConnection() {
    try {
        const client = await MongoClient.connect('mongodb+srv://socialUser:WeeWeeGod123@cluster0.uplstte.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        console.log('Successfully connected to MongoDB!');
        const db = client.db('social-listening');
        const collections = await db.listCollections().toArray();
        console.log('Available collections:', collections.map(c => c.name));
        await client.close();
    } catch (error) {
        console.error('Failed to connect:', error);
    }
}

testConnection(); 