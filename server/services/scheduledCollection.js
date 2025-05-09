const cron = require('node-cron');
const { collectData } = require('./dataCollector');

/**
 * Schedule the data collection to run at specific intervals
 * @param {string} schedule - Cron schedule expression
 */
function setupScheduledCollection(schedule = '0 */2 * * *') {
  // Default: Run every 2 hours
  console.log(`Setting up scheduled data collection with schedule: ${schedule}`);
  
  const task = cron.schedule(schedule, async () => {
    console.log(`Running scheduled data collection at ${new Date().toISOString()}`);
    try {
      await collectData();
      console.log('Scheduled collection completed successfully');
    } catch (error) {
      console.error('Error in scheduled collection:', error);
    }
  });
  
  task.start();
  console.log('Scheduler started');
  
  return task;
}

// Run the scheduled collection if this file is executed directly
if (require.main === module) {
  setupScheduledCollection();
}

module.exports = { setupScheduledCollection };