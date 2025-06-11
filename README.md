# TypeScript Greeter Library

A modular TypeScript library that provides greeting functionality with time-based greetings and customization options.

## Project Structure

```
src/
  ├── core/           # Core business logic
  │   └── greeting.ts # Platform-independent greeting logic
  └── index.ts        # Console application entry point
dist/                 # Compiled output
  ├── core/          
  │   └── greeting.js # CommonJS module output
  ├── index.js        # Node.js entry point
  └── greeter.min.js  # Browser-ready bundled version
examples/
  └── index.html      # Browser usage example
```

## Features

- Basic greeting functionality
- Time-based greetings (morning/afternoon/evening)
- Customizable default name
- Browser and Node.js support
- UMD bundle for CDN usage

## Prerequisites

- Node.js (v14 or higher)
- npm (comes with Node.js)

## Installation

```bash
npm install
```

## Build Options

There are two ways to build this project:

### 1. TypeScript Compilation (for Node.js)
```bash
npm run build
```
This command:
- Uses TypeScript compiler (tsc)
- Creates separate .js files in dist/
- Maintains directory structure
- Outputs readable JavaScript
- Best for Node.js development

### 2. Bundle Creation (for Browser/CDN)
```bash
npm run build:bundle
```
This command:
- Uses Webpack
- Creates single minified file (dist/greeter.min.js)
- Optimized for browser usage
- Ready for CDN deployment
- UMD format for universal usage

## Development

To run the project in development mode with hot reload:
```bash
npm run dev
```

## Usage Examples

### In Browser (via CDN or direct include)

```html
<!-- Include the bundled library -->
<script src="path/to/greeter.min.js"></script>

<script>
    // Create an instance
    const greeter = new Greeter.Greeter();
    
    // Use the methods
    console.log(greeter.sayHello("John"));              // "Hello, John!"
    console.log(greeter.getFullGreeting("John"));       // "Good morning, John!" (time-based)
</script>
```

### In Node.js

```javascript
const { Greeter } = require('./dist/core/greeting');

// Create an instance
const greeter = new Greeter();

// Use the methods
console.log(greeter.sayHello("John"));         // "Hello, John!"
console.log(greeter.getFullGreeting("John"));  // "Good morning, John!" (time-based)
```

## Available Methods

- `sayHello(name?: string)`: Basic greeting
- `getGreetingTime()`: Get time-based greeting (morning/afternoon/evening)
- `getFullGreeting(name?: string)`: Complete greeting with time-based prefix

## Making Changes

After making changes to the source code:

1. For Node.js: Run `npm run build`
2. For Browser/CDN: Run `npm run build:bundle`
3. Test your changes using the example HTML file

## Example

Check `examples/index.html` for a working browser example. 