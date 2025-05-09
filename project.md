# Social Listening Application - Project Documentation

## Project Overview
The Social Listening Application is designed to collect and analyze social media data from multiple platforms including Twitter and Reddit. This document tracks the implementation of major features and serves as a centralized reference for developers.

## Implemented Features

### Authentication System
- User registration with email verification
- Secure login/logout functionality 
- Password reset capability
- Session management

### Data Collection
- Twitter data scraping
- Reddit data collection
- Boolean search operators (AND, OR, NOT)
- Scheduled data collection

### Data Analysis
- Sentiment analysis of collected content
- Data visualization dashboards
- Trend identification
- Topic clustering

### User Interface
- Responsive dashboard
- Search interface with advanced filters
- Settings page for account management
- Custom theme support

### Flash Message System
- Custom implementation replacing react-toastify and react-hot-toast
- Contextual message types (success, error, info, warning)
- Configurable timeout for automatic dismissal
- Manual dismissal option for all messages
- Persistent message support for important notifications
- Visual distinction between persistent and temporary messages
- Accessible design with appropriate ARIA attributes

### Account Management
- User profile editing
- Password changing
- Account deactivation/deletion with:
  - Clear warnings about permanent data loss
  - Confirmation modal requiring explicit text input
  - Multiple API fallbacks for reliable account deletion
  - Persistent success/error messages that remain visible during redirect
  - Automatic logout following account deactivation
  - Enhanced user feedback through the flash message system

## In Progress Features
- Export functionality for collected data
- Advanced filtering options for dashboards
- Integration with additional social media platforms
- Enhanced admin controls

## Technical Implementation Notes

### Flash Message System
The flash message system uses React Context for global state management. Key components:
- `FlashMessageContext.js`: Provides state and methods for message management
- `FlashMessage.js`: Component that renders the messages
- `FlashMessage.css`: Styling including animations and persistent message indicators

Both temporary and persistent messages are supported, with the latter requiring manual dismissal by the user. This is particularly important for critical notifications like account deactivation confirmations.

### Account Deactivation
The account deactivation process follows best security practices:
1. Initial warning in the settings page with clear consequences
2. Modal confirmation requiring the user to type "DELETE MY ACCOUNT"
3. Multiple API endpoint attempts to ensure successful deletion
4. Persistent success/error messages that remain visible during the redirect process
5. Extended redirect delay for error messages to ensure users can read important information

The process is designed to prevent accidental account deletion while ensuring users can successfully deactivate their accounts when desired. 