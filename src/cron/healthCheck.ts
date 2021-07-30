import { database } from '@database';
import { App } from '@slack/bolt';
import log from '@utils/log';
import { codeBlock, compose } from '@utils/text';

export async function healthCheck(app: App): Promise<void> {
  try {
    // Database
    await database.open();
    log.d('cron.testJob', '✔ Spreadsheet access');

    // Slack Auth
    await app.client.auth.test({ token: process.env.SLACK_BOT_TOKEN });
    log.d('cron.testJob', '✔ Bot is authenticated');
  } catch (err) {
    log.e('cron.healthCheck', 'Health check failed:', err.message);
    log.e('cron.healthCheck', err);
    if (process.env.MODE === 'prod') {
      app.client.chat.postMessage({
        token: process.env.SLACK_BOT_TOKEN,
        channel: process.env.ERRORS_CHANNEL_ID,
        text: compose('Nightly health check failed:', codeBlock(err.message)),
      });
    }
  }
}
