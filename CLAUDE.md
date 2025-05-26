# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alliance is a multi-platform application with:

1. Frontend web application (React, Vite, Tailwind CSS)
2. Admin panel (React, Vite, Tailwind CSS)
3. Mobile application (React Native with Expo)
4. Backend server (NestJS, TypeORM, PostgreSQL)
5. Shared code modules

## Setup and Installation

For all components:
```bash
yarn install
```

For server:
```bash
cd server
npm install
cp .env.example .env  # Set up environment variables
```

You will need a PostgreSQL database running locally with credentials matching your .env file.

## Development Commands

### Frontend

```bash
# Start development server
cd apps/frontend
yarn dev
# or from project root:
yarn frontend:dev

# Run storybook
yarn workspace @alliance/frontend storybook

# Run linting
cd apps/frontend
yarn lint
```

### Admin Panel

```bash
# Start development server
cd apps/admin
yarn dev
# or from project root:
yarn admin:dev

# Run linting
cd apps/admin
yarn lint
```

### Mobile

```bash
# Start development server
cd apps/mobile
yarn start

# Build
yarn eas build --platform [ios|android]
```

### Server

```bash
# Start development server
cd server
npm run start:dev
# or from project root:
yarn server:dev

# Run all tests
cd server
npm run test

# Run end-to-end tests
cd server
npm run test:e2e

# Run specific test file
cd server
npm run test -- path/to/test.spec.ts

# Run linting
cd server
npm run lint
```

### API Client Generation

The frontend and mobile apps use auto-generated API client code based on the OpenAPI specification provided by the server:

```bash
# Generate API client (requires dev server running)
yarn gen-api
```

## Project Architecture

### Backend (NestJS)

The backend is structured as a NestJS application with modules for different features:

1. **Auth Module**: Handles authentication, JWT tokens, and user registration
2. **User Module**: User management and profiles
3. **Actions Module**: Core functionality for user actions and tasks
4. **Communiques Module**: Announcement functionality
5. **Forum Module**: Discussion forum with posts and replies
6. **Images Module**: Image upload and management

Each module follows NestJS conventions with:
- Entity files (database models)
- DTOs (Data Transfer Objects)
- Controllers (API endpoints)
- Services (business logic)
- Guards (authentication)

### Frontend Structure

The frontend is built with React, Vite, and Tailwind CSS:

1. **Components**: Reusable UI components
2. **Pages**: Page-level components for different routes
3. **Lib**: Utility functions and context providers
4. **Stories**: Storybook stories for components

### Authentication

Authentication is implemented with JWT tokens and supports both cookie-based and header-based authentication for different clients.

## Development Guidelines

### Backend Development

When creating new endpoints:
1. Use `nest g resource` to generate the appropriate files
2. For all controller endpoints, add `@ApiOkResponse({ type: ... })` decorator to specify the OpenAPI output
3. Ensure function return types match the DTO type
4. Use either `@AuthGuard` or `@AdminGuard` depending on the appropriate security level
5. For DTOs, use mapped types based on database entities (e.g., `OmitType`, `PickType`) rather than redefining values

### Frontend Development

1. Use the auto-generated API client for backend communication
2. Run `yarn gen-api` within the project root to regenerate API functions before using new endpoints
3. Use Tailwind CSS for styling
4. Create reusable components in the components directory
5. Add Storybook stories for new components

### Testing

1. Write unit tests for new services and controllers
2. Add end-to-end tests for new API endpoints
3. Run tests before submitting changes