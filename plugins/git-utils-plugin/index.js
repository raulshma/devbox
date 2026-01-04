/**
 * Git Utils Plugin
 *
 * Provides useful git utilities
 */

const { Command } = require('commander');
const { execSync } = require('child_process');

/**
 * Git Utils Plugin Class
 */
class GitUtilsPlugin {
  constructor() {
    this.metadata = {
      id: 'git-utils',
      name: 'Git Utils Plugin',
      version: '1.0.0',
      description: 'Git utilities for common git operations',
      author: 'Developer Toolbox',
    };
    this.context = null;
  }

  async initialize(context) {
    this.context = context;
    context.logger.info('Git Utils Plugin initialized');
  }

  getCommands() {
    const chalk = require('chalk');

    return [
      {
        command: new Command('git-stats')
          .description('Show git repository statistics')
          .action(async () => {
            try {
              console.log(chalk.blue.bold('\n📊 Git Repository Statistics\n'));

              // Get total commits
              const commits = execSync('git rev-list --count HEAD').toString().trim();
              console.log(chalk.white(`Total Commits: ${commits}`));

              // Get branches
              const branches = execSync('git branch -a').toString().trim();
              const branchCount = branches.split('\n').length;
              console.log(chalk.white(`Total Branches: ${branchCount}`));

              // Get current branch
              const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();
              console.log(chalk.white(`Current Branch: ${currentBranch}`));

              // Get latest commit
              const latestCommit = execSync('git log -1 --pretty=format:"%h - %s (%cr)"').toString().trim();
              console.log(chalk.white(`Latest Commit: ${latestCommit}`));

              console.log();
            } catch (error) {
              console.error(chalk.red('Error: Not a git repository or git not available'));
            }
          }),
      },
      {
        command: new Command('git-clean-branches')
          .description('List and optionally delete merged branches')
          .option('-d, --delete', 'Delete merged branches (local only)')
          .action(async (options) => {
            try {
              console.log(chalk.blue.bold('\n🧹 Clean Git Branches\n'));

              // Get merged branches (excluding main/master)
              const mergedBranches = execSync('git branch --merged').toString().trim();
              const currentBranch = execSync('git rev-parse --abbrev-ref HEAD').toString().trim();

              const branches = mergedBranches
                .split('\n')
                .map(b => b.trim().replace('*', '').trim())
                .filter(b => b && b !== currentBranch && b !== 'main' && b !== 'master');

              if (branches.length === 0) {
                console.log(chalk.gray('No merged branches to clean'));
                return;
              }

              console.log(chalk.white('Merged branches (excluding main/master/current):'));
              for (const branch of branches) {
                console.log(chalk.gray(`  - ${branch}`));
              }

              if (options.delete) {
                console.log(chalk.yellow('\nDeleting merged branches...'));
                for (const branch of branches) {
                  try {
                    execSync(`git branch -d ${branch}`);
                    console.log(chalk.green(`  ✓ Deleted ${branch}`));
                  } catch {
                    console.log(chalk.red(`  ✗ Failed to delete ${branch}`));
                  }
                }
              } else {
                console.log(chalk.gray('\nUse --delete flag to actually delete these branches'));
              }

              console.log();
            } catch (error) {
              console.error(chalk.red('Error: Not a git repository or git not available'));
            }
          }),
      },
    ];
  }

  async cleanup() {
    if (this.context) {
      this.context.logger.info('Git Utils Plugin cleaned up');
    }
  }
}

// Export the plugin class
module.exports = GitUtilsPlugin;
