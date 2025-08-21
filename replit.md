# Golf 9 Card Game

## Overview

Golf 9 is a multiplayer card game application built with React and Express. Players compete to achieve the lowest score across multiple rounds by strategically managing a 3x3 grid of cards. The game supports solo play against AI, local pass-and-play multiplayer, and online multiplayer modes.

## User Preferences

Preferred communication style: Simple, everyday language.

## Product Roadmap to Market

### Current Status: MVP Game Logic Complete
- Core game mechanics and AI fully functional
- UI/UX for game play complete with proper contrast
- Database integration ready

### Phase 1: User System & Progression (2-3 weeks)
1. **Authentication System**
   - Google OAuth integration
   - Facebook OAuth integration  
   - Email/password authentication
   - User profile creation and management

2. **Currency & XP Systems**
   - Coins earned per game completion
   - XP progression based on performance
   - Level-up rewards and unlocks
   - In-game shop for cosmetics

3. **Statistics & Profile**
   - Comprehensive game statistics tracking
   - Player profile editing capabilities
   - Achievement system
   - Leaderboards

### Phase 2: Enhanced Experience (1-2 weeks)
4. **Settings & Accessibility**
   - Sound effects for game actions
   - Vibration feedback for mobile
   - Audio preferences and volume controls
   - Visual accessibility options

5. **Cosmetic System**
   - Card back designs
   - Avatar customization
   - Table themes
   - Equipment/unlock system

### Phase 3: Online Multiplayer (2-3 weeks)
6. **Real-time Multiplayer**
   - WebSocket-based game rooms
   - Matchmaking system
   - Friend system and invites
   - Spectator mode

7. **Social Features**
   - Chat system
   - Friend challenges
   - Tournament mode
   - Social sharing

### Requirements Summary:
- **APIs Needed**: Google OAuth, Facebook OAuth, (optional: Apple, Discord)
- **Infrastructure**: Real-time WebSocket server, push notifications
- **Database**: User profiles, game history, statistics, cosmetics
- **Audio Assets**: Sound effects library
- **Legal**: Privacy policy, terms of service for app stores

## System Architecture

### Frontend Architecture
- **Framework**: React 18 with TypeScript and Vite for fast development and building
- **Routing**: Wouter for lightweight client-side routing
- **State Management**: React hooks and context for local state, TanStack Query for server state management
- **UI Library**: Radix UI components with shadcn/ui styling system
- **Styling**: Tailwind CSS with custom CSS variables for theming
- **Game Logic**: Custom hooks (`useGameLogic`) manage game state and AI behavior

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Development Setup**: Vite middleware integration for hot module replacement in development
- **Storage Interface**: Abstracted storage layer with in-memory implementation (expandable to database)
- **Session Management**: PostgreSQL session store with connect-pg-simple
- **API Structure**: RESTful endpoints with `/api` prefix

### Data Layer
- **Database ORM**: Drizzle ORM with PostgreSQL dialect
- **Schema Management**: Shared schema definitions between client and server
- **Data Models**: Users with gaming profiles (level, experience, currency) and game rooms with multiplayer support
- **Validation**: Zod schemas for type-safe data validation

### Game Engine
- **Core Logic**: Complete card game implementation with deck management, scoring, and rule validation
- **AI System**: Intelligent computer opponents with decision-making algorithms
- **Game States**: State machine handling setup, peek phase, playing, round-end, and game-end phases
- **Multiplayer Support**: Real-time game room management with player synchronization

### UI Components
- **Design System**: shadcn/ui components with custom game-specific styling
- **Responsive Design**: Mobile-first approach with breakpoint-based layouts
- **Game Interface**: Specialized components for cards, grids, and game tables
- **Accessibility**: Proper ARIA labels and keyboard navigation support

## External Dependencies

### Database & Storage
- **Neon Database**: PostgreSQL serverless database for production data storage
- **Drizzle ORM**: Type-safe database operations and migrations

### UI & Styling
- **Radix UI**: Headless, accessible component primitives
- **Tailwind CSS**: Utility-first CSS framework
- **Lucide React**: SVG icon library

### Development Tools
- **Vite**: Build tool and development server
- **TypeScript**: Static type checking
- **ESBuild**: Fast JavaScript bundler for production builds

### Runtime Libraries
- **TanStack Query**: Server state management and caching
- **React Hook Form**: Form handling and validation
- **Wouter**: Lightweight routing library
- **Date-fns**: Date manipulation utilities