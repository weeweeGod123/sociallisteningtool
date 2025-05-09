const { MongoClient } = require('mongodb');

async function checkDates() {
    try {
        const client = await MongoClient.connect('mongodb+srv://socialUser:WeeWeeGod123@cluster0.uplstte.mongodb.net/test?retryWrites=true&w=majority&appName=Cluster0');
        const db = client.db('social-listening');
        
        // Check Reddit posts dates
        const redditPosts = await db.collection('reddit_posts').find({}, { created_at: 1 }).limit(5).toArray();
        console.log('Sample Reddit post dates:', redditPosts.map(post => post.created_at));
        
        // Check Twitter posts dates
        const tweets = await db.collection('tweets').find({}, { created_at: 1 }).limit(5).toArray();
        console.log('Sample Tweet dates:', tweets.map(tweet => tweet.created_at));
        
        await client.close();
    } catch (error) {
        console.error('Error checking dates:', error);
    }
}

checkDates(); 