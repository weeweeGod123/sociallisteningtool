# Social Listening Platform - Frontend

This is the frontend application for the Social Listening Platform, built with React.js. The application provides a comprehensive dashboard for analyzing social media data, including sentiment analysis, geographic distribution, and influencer tracking.

## Project Structure

```
src/
├── assets/           # Static assets like images and icons
├── components/       # Reusable UI components
│   ├── Modal.js     # Modal component for popup dialogs
│   └── Modal.css
├── pages/           # Main application pages
├── services/        # API service integrations
├── App.js           # Main application component
├── App.css          # Global styles
├── index.js         # Application entry point
└── index.css        # Global CSS styles
└── UserContext.js   # User authentication and role management
```

## Main Features

### Authentication & User Management

- `UserContext.js` - Global user state management and role-based access control
- `LoginPage.js` - User login interface
- `SignUpPage.js` - New user registration
- `ForgotPassword.js` - Password recovery
- `NewPassword.js` - Password reset functionality

### Dashboard

- `Dashboard.js` - Main dashboard with overview statistics
- `DashboardCharts.js` - Visualization components for dashboard
- `Dashboard.css` - Dashboard styling

### Analysis Pages

- `AdvancedSearch.js` - Advanced search functionality
- `SentimentAnalysis.js` - Sentiment analysis visualization
- `GeographicDistribution.js` - Geographic data visualization
- `SeasonalAnalysis.js` - Time-based trend analysis
- `SourceDistribution.js` - Source platform distribution
- `Influencers.js` - Influencer tracking and analysis
- `MostEngagementPage.js` - Engagement metrics analysis
- `ThemesPage.js` - Theme customization

### UI Components

- `Topbar.js` - Top navigation bar
- `Sidebar.js` - Side navigation menu
- `Modal.js` - Reusable modal component

### Settings and Help

- `SettingsPage.js` - User settings and preferences
- `HelpPage.js` - Help and documentation

## State Management

The application uses React Context API for state management:

### UserContext

- Manages global user state including authentication status and user roles
- Provides role-based access control for different features
- Handles user session persistence
- Exposes `useUser` hook for accessing user data throughout the application

## Getting Started

### Prerequisites

- Node.js (v14 or higher)
- npm (v6 or higher)

### Installation

1. Navigate to the client directory:

   ```bash
   cd client
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Start the development server:
   ```bash
   npm start
   ```

The application will run on [http://localhost:3000](http://localhost:3000).

## Available Scripts

- `npm start` - Runs the app in development mode
- `npm test` - Launches the test runner
- `npm run build` - Builds the app for production
- `npm run eject` - Ejects from Create React App (one-way operation)

## Styling

The application uses CSS for styling with a modular approach:

- Each component has its own CSS file
- Global styles are defined in `App.css` and `index.css`
- Responsive design is implemented across all components

## API Integration

The frontend communicates with the backend through services defined in the `services/` directory. All API calls are handled through these service modules.

## Contributing

1. Create a new branch for your feature
2. Make your changes
3. Test your changes
4. Submit a pull request

## License

This project is licensed under the MIT License - see the LICENSE file for details.
