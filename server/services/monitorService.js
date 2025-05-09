/**
 * The function of this module is to monitor the database for changes and trigger sentiment analysis
 * when new data is inserted or updated. It uses MongoDB change streams to listen for changes
 * in the collections and notifies the sentiment scheduler to process the new data.
 * 
 * The idea of this monitor service is come from the sources below:
 *  - https://www.mongodb.com/docs/manual/reference/method/db.collection.watch/
 *  - https://www.mongodb.com/docs/manual/changeStreams/
 *  - https://mongoosejs.com/docs/api/model.html#Model.watch()
 */

const mongoose = require('mongoose');
const Post = require('../models/Post');
const sentimentScheduler = require('./sentimentScheduler');

/**
 * Service to monitor database for new data and integrate with scrapers
 */
class MonitorService 
{
    constructor() 
    {
      this.initialised = false;
      this.lastCheck = null;
      this.watchHandlers = 
      {
        tweets: null,
        reddit_posts: null,
        bluesky_posts: null
      };
      this.dbChanges = 0
      this.dbConnected = false;
    }

    /**
     * Initialise the data monitor
     */
    async initialise() 
    {
        if (this.initialised) return true;
        
        console.info('INFO: Initialising data monitor service');
        const connected = await this.connectToDatabase();
        if (!connected)
        {
            console.error('ERROR: Failed to initialise monitor service: Database connection failed');
            return false;
        }
        
        // Initialise the auto sentiment scheduler
        sentimentScheduler.initialise();
        
        // Set up database change monitor for each collection
        await this.setupChangeMonitors();
        
        // Schedule a periodic check for the change streams
        this.scheduleChangeStreamChecks();
        
        // Add a direct polling fallback
        this.scheduleDatabasePolling();
        
        this.initialised = true;
        console.info('INFO: Data monitor service initialised');
        
        return true;
    }

    /**
     * Initialise MongoDB connection
     * @returns {Promise<boolean>} - Whether the connection was successful
     */
    async connectToDatabase()
    {
        if (this.dbConnected) return true;
        
        const MONGO_URI = process.env.MONGO_URI;
        
        if (!MONGO_URI) 
        {
            console.error('ERROR: MONGO_URI is not defined in environment variables');
            return false;
        }
        
        try 
        {
            // Check if already connected
            if (mongoose.connection.readyState === 1) 
            {
                console.info('INFO: Already connected to MongoDB');
                this.dbConnected = true;
                return true;
            }
            
            // Connect to MongoDB with explicit database name
            await mongoose.connect(MONGO_URI, 
            {
                useNewUrlParser: true,
                useUnifiedTopology: true,
                dbName: process.env.MONGO_DB_NAME  // Ensure to specify the database name
            });
            
            // Verify the database information
            const connectedDb = mongoose.connection.db.databaseName;
            console.info(`INFO: Connected to MongoDB database: ${connectedDb}`);
            
            this.dbConnected = true;
            
            // Set up connection error handlers
            mongoose.connection.on('error', (err) => 
            {
                console.error('ERROR: MongoDB connection error:', err);
                this.dbConnected = false;
                
                // Close all change streams
                this.closeAllChangeStreams();
                
                // Try to reconnect after delay
                setTimeout(() => this.connectToDatabase(), 10000); // Retry after 10 seconds
            });
            
            // Set up disconnection handler
            mongoose.connection.on('disconnected', () => 
            {
                console.warn('WARN: MongoDB disconnected');
                this.dbConnected = false;
                
                // Close all change streams
                this.closeAllChangeStreams();
                
                // Try to reconnect after delay
                setTimeout(() => this.connectToDatabase(), 10000);
            });
            
            return true;
        } 
        catch (error) 
        {
            console.error('ERROR: Failed to connect to MongoDB:', error.message);
            this.dbConnected = false;
            setTimeout(() => this.connectToDatabase(), 10000); // Retry after 10 seconds
            return false;
        }
    }

     /**
     * Set up change streams to monitor multiple collections
     */
    async setupChangeMonitors()
    {
        try 
        {
            // Ensure we have a valid connection
            if (!this.dbConnected || mongoose.connection.readyState !== 1) 
            {
                console.warn('WARN: MongoDB connection not ready, delaying change monitor setup...');
                setTimeout(() => this.setupChangeMonitors(), 5000); // Retry after 5 seconds
                return;
            }
            
            console.info('INFO: Setting up database change monitors for multiple sources...');
            
            // Get all available collections in the correct database
            const collections = await mongoose.connection.db.listCollections().toArray();
            const availableCollections = collections.map(c => c.name);
            
            // Collection names to check
            const collectionsToMonitor = ['reddit_posts', 'tweets', 'bluesky_posts'];
            
            // Validate existing collections and set up change monitors
            for (const collectionName of collectionsToMonitor) 
            {
                if (availableCollections.includes(collectionName)) 
                {
                    await this.setupCollectionChangeMonitor(collectionName);
                } 
                else 
                {
                    console.warn(`WARN: Collection '${collectionName}' not found in database '${this.dbName}'`);
                }
            }
            return true;
        } 
        catch (error) 
        {
            console.error(`ERROR: Error setting up change monitors: ${error.message}`);
            return false;
        }
    }
 /**
     * Set up change streams to monitor multiple collections
     */
    async setupChangeMonitors()
    {
        try 
        {
            // Ensure we have a valid connection
            if (!this.dbConnected || mongoose.connection.readyState !== 1) 
            {
                console.warn('WARN: MongoDB connection not ready, delaying change monitor setup...');
                setTimeout(() => this.setupChangeMonitors(), 5000); // Retry after 5 seconds
                return;
            }
            
            console.info('INFO: Setting up database change monitors for multiple sources...');
            
            // Get all available collections in the correct database
            const collections = await mongoose.connection.db.listCollections().toArray();
            const availableCollections = collections.map(c => c.name);
            
            // Collection names to check
            const collectionsToMonitor = ['reddit_posts', 'tweets', 'bluesky_posts'];
            
            // Validate existing collections and set up change monitors
            for (const collectionName of collectionsToMonitor) 
            {
                if (availableCollections.includes(collectionName)) 
                {
                    await this.setupCollectionChangeMonitor(collectionName);
                } 
                else 
                {
                    console.warn(`WARN: Collection '${collectionName}' not found in database '${this.dbName}'`);
                }
            }
            return true;
        } 
        catch (error) 
        {
            console.error(`ERROR: Error setting up change monitors: ${error.message}`);
            return false;
        }
    }

    /**
     * Set up a change stream for a specific collection
     */
    async setupCollectionChangeMonitor(collectionName) 
    {
        try 
        {
            // Skip if monitoring is already set up
            if (this.watchHandlers[collectionName]) 
            {
                return true;
            }
            
            console.info(`INFO: Setting up change monitor for ${collectionName}...`);
            
            // Get direct collection reference
            const collection = mongoose.connection.db.collection(collectionName);
            
            // Set up the change stream with explicit resume token handling
            // Only monitor 'insert' operations - Skip 'update' operations
            const changeStream = collection.watch([
                { $match: { operationType: 'insert' } }
            ], { 
                fullDocument: 'updateLookup',
                resumeAfter: null // Start from the beginning
            });
            
            // Set up event handlers
            changeStream.on('change', (change) => {
                // Only process insert operations
                if (change.operationType === 'insert') 
                {                    
                    // Map collection names to platform names
                    let platform;
                    switch (collectionName) 
                    {
                        case 'tweets':
                            platform = 'Twitter';
                            break;
                        case 'reddit_posts':
                            platform = 'Reddit';
                            break;
                        case 'bluesky_posts':
                            platform = 'Bluesky';
                            break;
                        default:
                            // Try to get platform from the body of the document
                            platform = change.fullDocument?.platform || 'Unknown';
                    }
                    // Add platform to the change event for notifying the scheduler
                    change.detectedPlatform = platform;
                    
                    // Process the change
                    this.handleDatabaseChange(change);
                }
            });
            
            // Handle errors event
            changeStream.on('error', (error) => {
                console.error(`ERROR: Change stream error for ${collectionName}:`, error.message);
                this.watchHandlers[collectionName] = null;
                
                // Try to set up again after a delay
                setTimeout(() => this.setupCollectionChangeMonitor(collectionName), 30000);
            });
            
            // Handle close event
            changeStream.on('close', () => {
                console.info(`INFO: Change stream for ${collectionName} closed`);
                this.watchHandlers[collectionName] = null;
            });
            
            // Save the change stream handler
            this.watchHandlers[collectionName] = changeStream;
            console.info(`INFO: Change monitor for ${collectionName} initialised successfully`);
            
            return true;
        } 
        catch (error) 
        {
            console.error(`ERROR: Error setting up change monitor for ${collectionName}:`, error.message);
            return false;
        }
    }

    /**
     * Schedule periodic checks to ensure change streams are active
     */
    scheduleChangeStreamChecks() 
    {
        // Check every 5 minutes
        const checkInterval = 5 * 60 * 1000;
        
        setInterval(async () => {
            const collections = Object.keys(this.watchHandlers);
            
            // Check if the change stream is active for each collection
            for (const collection of collections) 
            {
                if (!this.watchHandlers[collection]) 
                {
                    console.warn(`WARN: Change stream for ${collection} not active, attempting to reinitialise`);
                    await this.setupCollectionChangeMonitor(collection);
                }
            }
        }, checkInterval);
        
        console.info('INFO: Scheduled change stream health checks');
    }

    /**
     * Schedule periodic polling of the database as a fallback
     * This is a backup plan in case the change streams is not working
     */
    scheduleDatabasePolling() 
    {
        // Check every minute
        const checkInterval = 60 * 1000;
        
        setInterval(async () => 
        {
            try 
            {
                if (!this.dbConnected) return;
                
                if (this.watchHandlers.reddit_posts == null && this.watchHandlers.tweets == null && this.watchHandlers.bluesky_posts == null)
                {
                    // Check the reddit_posts collection first
                    const redditPostsCollection = mongoose.connection.db.collection('reddit_posts');
                    
                    // Find posts that need sentiment analysis
                    const unanalysedPosts = await redditPostsCollection.find({ 
                        sentiment: null,
                        sentiment_analysis_failed: { $ne: true },
                        sentiment_analysis_skipped: { $ne: true }
                    }).limit(50).toArray();
                    
                    if (unanalysedPosts.length > 0) 
                    {
                        console.info(`INFO: Found ${unanalysedPosts.length} unanalysed Reddit posts through direct polling`);
                        
                        // Process each post
                        for (const post of unanalysedPosts) 
                        {
                            sentimentScheduler.notifyNewData({
                                platform: 'Reddit',
                                docId: post._id,
                                changeType: 'poll'
                            });
                        }
                    }
                    
                    // Also check tweets collection
                    const tweetsCollection = mongoose.connection.db.collection('tweets');
                    
                    // Find tweets that need sentiment analysis
                    const unanalysedTweets = await tweetsCollection.find({ 
                        sentiment: null,
                        sentiment_analysis_failed: { $ne: true },
                        sentiment_analysis_skipped: { $ne: true }
                    }).limit(50).toArray();
                    
                    if (unanalysedTweets.length > 0) 
                    {
                        console.info(`INFO: Found ${unanalysedTweets.length} unanalysed tweets through direct polling`);
                        
                        // Process each tweet
                        for (const tweet of unanalysedTweets) 
                        {
                            sentimentScheduler.notifyNewData({
                                platform: 'Twitter',
                                docId: tweet._id,
                                changeType: 'poll'
                            });
                        }
                    }

                    // Check bluesky_posts collection
                    const blueSkyCollection = mongoose.connection.db.collection('bluesky_posts');
                    
                    // Find Bluesky posts that need sentiment analysis
                    const unanalysedBluesky = await blueSkyCollection.find({ 
                        sentiment: null,
                        sentiment_analysis_failed: { $ne: true },
                        sentiment_analysis_skipped: { $ne: true }
                    }).limit(50).toArray();
                    
                    if (unanalysedBluesky.length > 0) 
                    {
                        console.info(`INFO: Found ${unanalysedBluesky.length} unanalysed Bluesky posts through direct polling`);
                        
                        // Process each Bluesky post
                        for (const post of unanalysedBluesky) 
                        {
                            sentimentScheduler.notifyNewData({
                                platform: 'Bluesky',
                                docId: post._id,
                                changeType: 'poll'
                            });
                        }
                    }
                }
            }
            catch (error) 
            {
                console.error('ERROR: Error during direct database polling:', error.message);
            }
        }, checkInterval);
        
        console.info('INFO: Scheduled direct database polling fallback');
    }
    
    /**
     * Handle database update or insert events
     * @param {Object} change - The change event from MongoDB
     */
    handleDatabaseChange(change) 
    {
        try 
        {
            // Increment counter
            this.dbChanges++;
            
            // Get platform from the detected platform or the document
            let platform = change.detectedPlatform || 'Unknown';
            
            if (change.fullDocument && !platform) 
            {
                platform = change.fullDocument.platform || 'Unknown';
            }
            
            // For insert operations
            if (change.operationType === 'insert') 
            {
                const newDoc = change.fullDocument;
                console.info(`INFO: New ${platform} post detected with ID: ${newDoc._id}`);
                
                // Notify the sentiment scheduler
                sentimentScheduler.notifyNewData({
                    platform: platform,
                    docId: newDoc._id,
                    changeType: 'insert'
                });
            }
            
            this.lastCheck = new Date();
        } 
        catch (error) 
        {
            console.error(`ERROR: Error handling database change: ${error.message}`);
        }
    }
    /**
     * Close all active change streams
     */
    closeAllChangeStreams() 
    {
        const collections = Object.keys(this.watchHandlers);
        
        for (const collection of collections)
        {
            if (this.watchHandlers[collection]) 
            {
                try 
                {
                    this.watchHandlers[collection].close();
                    console.info(`INFO: Closed change stream for ${collection}`);
                } 
                catch (closeError) 
                {
                    console.error(`ERROR: Error closing change stream for ${collection}:`, closeError);
                }
                // Set the handler to null to indicate it's closed
                this.watchHandlers[collection] = null;
            }
        }
    }

    /**
     * Get the current status of the monitor and scheduler
     */
    getStatus() 
    {
        // Check which collections are actively being monitored
        const activeStreams = {};
        Object.keys(this.watchHandlers).forEach(collection => {
            activeStreams[collection] = !!this.watchHandlers[collection];
        });
        
        return {
            monitorInitialised: this.initialised,
            lastCheck: this.lastCheck,
            dbChanges: this.dbChanges,
            changeStreams: activeStreams,
            dbConnected: this.dbConnected,
            dbName: this.dbName,
            sentimentScheduler: sentimentScheduler.getStatus()
        };
    }
}

// Create and export singleton instance
const monitorService = new MonitorService();
module.exports = monitorService;