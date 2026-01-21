import { registerStrategy } from './index';
import emailStrategy from './email.strategy';
import slackStrategy from './slack.strategy';
import stripeStrategy from './stripe.strategy';
import databaseStrategy from './database.strategy';
import fileStrategy from './file.strategy';
import defaultStrategy from './default.strategy';

/**
 * Initialize all compensation strategies
 * Called on application startup
 */
export function initializeStrategies(): void {
  // Email strategies
  registerStrategy('send_email', emailStrategy);
  registerStrategy('email_*', emailStrategy);

  // Slack strategies
  registerStrategy('slack_*', slackStrategy);

  // Stripe strategies
  registerStrategy('stripe_*', stripeStrategy);

  // Database strategies
  registerStrategy('create_record', databaseStrategy);
  registerStrategy('update_record', databaseStrategy);
  registerStrategy('delete_record', databaseStrategy);
  registerStrategy('db_*', databaseStrategy);
  registerStrategy('database_*', databaseStrategy);

  // File strategies
  registerStrategy('write_file', fileStrategy);
  registerStrategy('delete_file', fileStrategy);
  registerStrategy('move_file', fileStrategy);
  registerStrategy('copy_file', fileStrategy);
  registerStrategy('file_*', fileStrategy);
  registerStrategy('fs_*', fileStrategy);

  // Default fallback - register last
  registerStrategy('*', defaultStrategy);

  console.log('Compensation strategies initialized');
}
