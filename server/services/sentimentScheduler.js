const mongoose = require('mongoose');
const axios = require('axios');
const Post = require('../models/Post');
const sentimentService = require("./sentimentService");

const SENTIMENT_API_URL = process.env.SENTIMENT_API_URL || 'http://localhost:5004';
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE) || 250;
const MAX_RETRIES = parseInt(process.env.MAX_RETRIES) || 3;
const COOLDOWN_TIME = parseInt(process.env.COOLDOWN_TIME) || 3000; // 1 minute
const IDLE_TIMEOUT = parseInt(process.env.TIMEOUT) || 900000; // 15 minutes
const CHECK_INTERVAL = parseInt(process.env.CHECK_INTERVAL) || 60000; // 1 minute

/**
 *  Sentiment Scheduler - Activates when new data is scrapped and start analyzing in batch
 */
class SentimentScheduler 
{    
    constructor()
    {
        this.isActive = false;
        this.isRunning = false;
        this.retryCount = 0;
        this.lastRunTime = null;
        this.lastDataTimeStamp = null;
        this.checkInterval = null;
        this.idleTimeOut = null;
        this.lastProcessedCount = 0;
        this.totalProcessedCount = 0;
    }

    /**
     * Initialise the scheduler
     */
    initialise() 
    {
        console.log('INFO: Sentiment Scheduler initialised');
        this.checkInterval = setInterval(() => this.checkForNewData(), CHECK_INTERVAL);
        this.updateLastDataTimestamp();
        return true;
    }

    /**
     * Clean up the scheduler
     */
    shutdown() 
    {
        if (this.checkInterval) 
        {
            clearInterval(this.checkInterval);
            this.checkInterval = null;
        }
        
        if (this.idleTimeOut)
        {
            clearTimeout(this.idleTimeOut);
            this.idleTimeOut = null;
        }
        
        this.isActive = false;
        this.isRunning = false; // Ensure any in-progress work is abandoned
        
        console.log('INFO: Sentiment Scheduler completely shut down');
    }

    /**
     * Activate the scheduler
     */
    activate()
    {
        if (this.isActive) return;
        this.isActive = true;
        console.log('INFO: Sentiment Scheduler activated');

        if (this.idleTimeOut)
        {
            clearTimeout(this.idleTimeOut);
            this.idleTimeOut = null;
        }
        // Restore normal check frequency if it was reduced
        if (!this.checkInterval) 
        {
            this.checkInterval = setInterval(() => this.checkForNewData(), CHECK_INTERVAL);
        }
        this.startBatchAnalysis();
    }

    /**
     * Schedule deactivation after idle period
     */
    scheduleDeactivation()
    {
        if (this.idleTimeOut)
        {
            clearTimeout(this.idleTimeOut);
        }

        this.idleTimeOut = setTimeout(() => 
        {
            console.log(`INFO: Deactivating sentiment scheduler after ${IDLE_TIMEOUT/60000} minutes of inactivity`);
            this.isActive = false;

            // Stop the check interval when deactivated
            if (this.checkInterval)
            {
                clearInterval(this.checkInterval);
                this.checkInterval = null;
            }
            this.idleTimeOut = null;
        }, IDLE_TIMEOUT);
    }

    /**
     * Check for new data and start the analysis
     */
    async checkForNewData()
    {
        try
        {
            // Skip checking entirely if the scheduler is inactive
            if (!this.isActive && !this.idleTimeOut) return;

            if(this.isRunning) return;

            const unanalysed = await sentimentService.getUnanalysedCount();
            
            if (unanalysed.total > 0)
            {
                console.log(`INFO: Found ${unanalysed.total} unanalysed posts`);
                this.updateLastDataTimestamp();
                if (!this.isActive)
                {
                    this.activate();
                }
                const hasNewData = unanalysed.total >= Math.min(50, BATCH_SIZE / 2);
                const checkIDLETime = !this.lastRunTime || 
                (Date.now() - this.lastRunTime) > (2 * 60 * 1000); // 2 minutes
                if (hasNewData || checkIDLETime)
                {
                    this.startBatchAnalysis();
                }
            }
            else if (this.isActive && !this.idleTimeOut)
            {
                this.scheduleDeactivation();
            }
        }
        catch (error)
        {
            console.error('ERROR: Error checking for new data:', error.message);
        }
    }

    /**
     * Start batch analysis
     */
    async startBatchAnalysis()
    {
        if(this.isRunning)
        {
            return;
        }

        this.isRunning = true;
        console.log('INFO: Starting batch sentiment analysis');

        try
        {
            const healthCheck = await sentimentService.checkHealth();
            if (healthCheck.status !== 'healthy')
            {
                console.error('ERROR: Sentiment analysis server is not available');
                this.isRunning = false;
                return;
            }

            const result = await sentimentService.analyseBatch(BATCH_SIZE);
            const unanalysed = await sentimentService.getUnanalysedCount();
            this.lastRunTime = Date.now();
            this.lastProcessedCount = result.processed;
            this.totalProcessedCount += result.processed;
            this.retryCount = 0;
            console.log(`INFO: Sentiment batch completed: ${result.processed} processed, ${result.errors} errors. ${unanalysed.total} posts remaining.`);
            
            // If there are still unanalysed posts, schedule the next batch
            const remainingUnanalysed = unanalysed.total;
            if (remainingUnanalysed > 0 && this.isActive)
            {
                const delay = 1000; // 1 second
                setTimeout(() => 
                    {
                        this.isRunning = false;
                        this.startBatchAnalysis(); // Recursively call to start the next batch
                    }, delay);
            }
            else
            {
                this.isRunning = false;          
                if (remainingUnanalysed === 0)
                {
                    console.log('INFO: Batch analysis completed, no more unanalysed posts');
                    this.scheduleDeactivation();
                }
            }
        }
        catch (error)
        {
            console.error('ERROR: Error in batch analysis:', error.message);
            this.isRunning = false;
            this.retryCount++;

            if(this.retryCount < MAX_RETRIES)
            {
                const cooldown = COOLDOWN_TIME * Math.pow(2, this.retryCount - 1) * 1000; // Exponential backoff
                console.info(`INFO: Scheduling retry #${this.retryCount} in ${cooldown/1000} seconds`);
                setTimeout(() => {
                    this.isRunning = false;
                    this.startBatchAnalysis();
                }, cooldown);
            } 
            else 
            {
              console.error(`ERROR: Maximum retries (${MAX_RETRIES}) reached. Waiting for next data check.`);
              this.retryCount = 0;
            }
        }
    }

    /**
     * Get the status of the scheduler
     * @returns {Object} - The status of the scheduler
     */
    getStatus()
    {
        return {
            isActive: this.isActive,
            isRunning: this.isRunning,
            lastRunTime: this.lastRunTime ? new Date(this.lastRunTime).toISOString() : null,
            lastDataTimeStamp: this.lastDataTimeStamp ? new Date(this.lastDataTimeStamp).toISOString() : null,
            totalProcessedCount: this.totalProcessedCount,
            lastProcessedCount: this.lastProcessedCount,
            retryCount: this.retryCount,
            idleTimeoutActive: !!this.idleTimeout,
            batchSize: BATCH_SIZE,
            cooldownTime: COOLDOWN_TIME
        };
    }

    /**
     * Trigger from external services when new data is available
     * @param {Object} info - Information about the new data
     */
    notifyNewData(info = {}) 
    {
        console.info(`INFO: Received new data notification: ${info.platform || 'Unknown'} - ${info.changeType || 'general'}`);
        
        // Update timestamp and activate if needed
        this.updateLastDataTimestamp();
        
        if (!this.isActive) 
        {
            this.activate();
        }
        else if (!this.isRunning) 
        {
            // If not currently running but already active, start batch analysis immediately
            this.startBatchAnalysis();
        }
        return {
            acknowledged: true,
            scheduler: this.getStatus()
        };
    }

    /**
     * Update the last data timestamp
     */
    updateLastDataTimestamp()
    {
        this.lastDataTimeStamp = new Date();
    }
}

// Create and export a singleton instance
const sentimentScheduler = new SentimentScheduler();
module.exports = sentimentScheduler;