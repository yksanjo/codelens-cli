#!/usr/bin/env node

import { Command } from 'commander';
import chalk from 'chalk';
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import ora from 'ora';

const program = new Command();

// Default API URL
const API_URL = process.env.CODELENS_API_URL || 'http://localhost:3000';

// Helper to get all files in directory
function getFiles(dir: string, extensions: string[]): string[] {
  const files: string[] = [];
  
  try {
    const items = readdirSync(dir);
    
    for (const item of items) {
      const fullPath = join(dir, item);
      const stat = statSync(fullPath);
      
      if (stat.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
        files.push(...getFiles(fullPath, extensions));
      } else if (stat.isFile() && extensions.includes(extname(item).toLowerCase())) {
        files.push(fullPath);
      }
    }
  } catch (e) {
    // Ignore permission errors
  }
  
  return files;
}

// Analyze a single file
async function analyzeFile(filePath: string, options: any) {
  const spinner = ora(`Analyzing ${filePath}...`).start();
  
  try {
    const code = readFileSync(filePath, 'utf-8');
    
    const response = await fetch(`${API_URL}/api/v1/security/scan`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code, language: options.language || undefined })
    });
    
    if (!response.ok) {
      throw new Error(`API error: ${response.statusText}`);
    }
    
    const result = await response.json();
    spinner.succeed(`Analyzed ${filePath}`);
    
    return result;
  } catch (error: any) {
    spinner.fail(`Failed to analyze ${filePath}: ${error.message}`);
    return null;
  }
}

// Display results
function displayResults(results: any[]) {
  console.log('\n' + chalk.bold('═'.repeat(50)));
  console.log(chalk.bold('🔍 Security Scan Results'));
  console.log(chalk.bold('═'.repeat(50)));
  
  let totalVulns = 0;
  
  for (const result of results) {
    if (!result) continue;
    
    const vulns = result.vulnerabilities || [];
    totalVulns += vulns.length;
    
    if (vulns.length > 0) {
      console.log(chalk `\n{underline ${result.file}}`);
      
      for (const vuln of vulns) {
        const color = vuln.severity === 'critical' ? 'red' : 
                      vuln.severity === 'high' ? 'yellow' : 
                      vuln.severity === 'medium' ? 'yellow' : 'gray';
        
        console.log(chalk `{${color.bold [${vuln.severity.toUpperCase()}]}} Line ${vuln.line}: ${vuln.message}`);
        if (vuln.cwe) {
          console.log(chalk.gray(`  CWE: ${vuln.cwe}`));
        }
      }
    }
  }
  
  console.log(chalk `\n\nTotal vulnerabilities: {bold ${totalVulns}}`);
  
  if (totalVulns > 0) {
    console.log(chalk.yellow('\n⚠️  Fix the issues above before committing!'));
  } else {
    console.log(chalk.green('\n✅ No security issues found!'));
  }
}

// Main scan command
program
  .name('codelens')
  .description('AI-powered code analysis CLI')
  .version('1.0.0');

// Scan command
program
  .command('scan')
  .description('Scan files for security vulnerabilities')
  .option('-f, --file <path>', 'Single file to scan')
  .option('-d, --directory <path>', 'Directory to scan')
  .option('-l, --language <lang>', 'Language (auto-detected if not specified)')
  .option('-e, --extensions <exts>', 'File extensions to scan (default: .js,.ts,.py,.go,.java)')
  .action(async (options) => {
    if (!options.file && !options.directory) {
      console.error(chalk.red('Error: Please specify --file or --directory'));
      process.exit(1);
    }
    
    const extensions = options.extensions 
      ? options.extensions.split(',').map((e: string) => e.trim().startsWith('.') ? e.trim() : `.${e.trim()}`)
      : ['.js', '.ts', '.jsx', '.tsx', '.py', '.go', '.java', '.rb', '.php', '.cs', '.c', '.cpp', '.rs'];
    
    const spinner = ora('Starting scan...').start();
    
    try {
      const files: string[] = [];
      
      if (options.file) {
        files.push(options.file);
      } else if (options.directory) {
        files.push(...getFiles(options.directory, extensions));
      }
      
      spinner.text = `Found ${files.length} files to scan`;
      
      const results = await Promise.all(
        files.map(file => analyzeFile(file, options))
      );
      
      spinner.succeed('Scan complete!');
      
      displayResults(results);
    } catch (error: any) {
      spinner.fail(chalk.red(`Scan failed: ${error.message}`));
      process.exit(1);
    }
  });

// Explain command
program
  .command('explain')
  .description('Explain code in natural language')
  .option('-f, --file <path>', 'File to explain')
  .option('-c, --code <code>', 'Code to explain directly')
  .option('-l, --language <lang>', 'Language')
  .action(async (options) => {
    if (!options.file && !options.code) {
      console.error(chalk.red('Error: Please specify --file or --code'));
      process.exit(1);
    }
    
    const spinner = ora('Analyzing code...').start();
    
    try {
      const code = options.file ? readFileSync(options.file, 'utf-8') : options.code;
      
      const response = await fetch(`${API_URL}/api/v1/explain`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, language: options.language || undefined })
      });
      
      if (!response.ok) {
        throw new Error(`API error: ${response.statusText}`);
      }
      
      const result = await response.json();
      spinner.succeed('Analysis complete!');
      
      console.log(chalk `\n{bold 📖 Explanation:}`);
      console.log(result.explanation);
    } catch (error: any) {
      spinner.fail(chalk.red(`Failed: ${error.message}`));
      process.exit(1);
    }
  });

// Languages command
program
  .command('languages')
  .description('List supported languages')
  .action(async () => {
    try {
      const response = await fetch(`${API_URL}/api/v1/languages`);
      const result = await response.json();
      
      console.log(chalk.bold('\n📋 Supported Languages:\n'));
      
      for (const lang of result.languages) {
        console.log(`  ${chalk.cyan(lang.name)} (${lang.extensions.join(', ')})`);
      }
    } catch (error: any) {
      console.error(chalk.red(`Failed to fetch languages: ${error.message}`));
      process.exit(1);
    }
  });

// Health check
program
  .command('doctor')
  .description('Check API connection and configuration')
  .action(async () => {
    console.log(chalk.bold('\n🏥 CodeLens Health Check\n'));
    
    try {
      const response = await fetch(`${API_URL}/health`);
      const result = await response.json();
      
      console.log(`  Status: ${result.status === 'ok' ? chalk.green('✓ OK') : chalk.red('✗ FAIL')}`);
      console.log(`  Version: ${result.version}`);
      console.log(`  API Configured: ${result.aiConfigured ? chalk.green('✓ Yes') : chalk.yellow('⚠ No (AI features disabled)')}`);
      console.log(`  API URL: ${API_URL}`);
      
      if (!result.aiConfigured) {
        console.log(chalk.yellow('\n  To enable AI features, set OPENAI_API_KEY environment variable'));
      }
    } catch (error: any) {
      console.log(chalk.red(`  ✗ Failed to connect to API at ${API_URL}`));
      console.log(chalk.yellow('\n  Make sure the CodeLens API is running:'));
      console.log(chalk.gray('    npm run dev'));
      process.exit(1);
    }
  });

program.parse();
