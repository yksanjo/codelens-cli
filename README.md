# CodeLens CLI

AI-powered code analysis CLI tool for local development workflows.

## Installation

```bash
npm install -g codelens-cli
```

## Usage

### Health Check
```bash
codelens doctor
```

### Scan for Security Vulnerabilities
```bash
# Scan a single file
codelens scan -f src/index.ts

# Scan a directory
codelens scan -d ./src

# Scan with specific extensions
codelens scan -d ./src -e .js,.ts,.py
```

### Explain Code
```bash
# From file
codelens explain -f src/index.ts

# From code string
codelens explain -c "function hello() { return 'world'; }" -l javascript
```

### List Supported Languages
```bash
codelens languages
```

## Configuration

Set the API URL:
```bash
export CODELENS_API_URL=http://localhost:3000
```

Set your OpenAI API key for AI features:
```bash
export OPENAI_API_KEY=your_key_here
```

## Commands

- `scan` - Scan files for security vulnerabilities
- `explain` - Explain code in natural language
- `languages` - List supported languages
- `doctor` - Check API connection and configuration
