# Mobile App - Left Side Drawer Menu

## Overview
The mobile app now features a beautiful left-side drawer menu with Instagram profile integration and all app features.

## Features

### 🎨 Instagram Profile Section
- **Profile Icon**: Custom Instagram-style profile icon with gradient-like border effect
- **User Information**: Displays username and Instagram handle (@dmpanda)
- **Live Stats**: Shows real-time Instagram statistics:
  - Followers count (24.5K)
  - Reels count (2,986)
  - DM Rate (85/hr)

### 📱 Navigation Menu
The drawer includes all main app sections:
- **Dashboard**: Main overview with stats and analytics
- **Affiliate**: Affiliate program management
- **Pricing**: Subscription plans and pricing
- **Settings**: App settings and preferences

### 🔐 Account Management
- **Profile**: Quick access to profile settings
- **Logout**: Secure logout functionality

### ✨ Design Features
- **Theme-Aware**: Automatically adapts to light/dark mode
- **Smooth Animations**: Slide-in/out animations for drawer
- **Modern UI**: Clean, premium design with proper spacing
- **Touch Feedback**: Visual feedback on all interactive elements
- **Notification Badge**: Bell icon with notification count in header

## Components

### CustomDrawer
Main drawer component with Instagram profile and navigation menu.

**Props:**
- `visible` (boolean): Controls drawer visibility
- `onClose` (function): Callback when drawer should close

### DrawerHeader
Header component with menu button and notifications.

**Props:**
- `title` (string): Page title to display
- `onMenuPress` (function): Callback when menu button is pressed

### InstagramProfileIcon
Reusable Instagram-style profile icon component.

**Props:**
- `size` (number): Icon size in pixels (default: 80)
- `isDark` (boolean): Whether to use dark theme styling

## Usage

The drawer is automatically integrated into all tab screens. Users can:
1. Tap the **menu icon** (☰) in the header to open the drawer
2. Tap the **X button** or **backdrop** to close the drawer
3. Navigate to any section by tapping menu items
4. View Instagram stats at a glance

## File Structure

```
src/
├── components/
│   ├── CustomDrawer.tsx       # Main drawer component
│   ├── DrawerHeader.tsx       # Header with menu button
│   ├── InstagramProfileIcon.tsx # Instagram profile icon
│   └── index.ts               # Component exports
└── app/
    └── (tabs)/
        └── _layout.tsx        # Tab layout with drawer integration
```

## Customization

### Update Instagram Stats
Edit the stats in `CustomDrawer.tsx`:
```typescript
<Text style={[styles.statValue, { color: textColor }]}>24.5K</Text>
<Text style={[styles.statLabel, { color: mutedColor }]}>Followers</Text>
```

### Change Profile Information
Update the profile section in `CustomDrawer.tsx`:
```typescript
<Text style={[styles.profileName, { color: textColor }]}>
    Your Name
</Text>
<Text style={styles.instagramHandle}>@yourhandle</Text>
```

### Add New Menu Items
Add items to the `menuItems` array in `CustomDrawer.tsx`:
```typescript
const menuItems: MenuItem[] = [
    { icon: Home, label: 'Dashboard', route: '/(tabs)' },
    // Add your new item here
    { icon: YourIcon, label: 'New Feature', route: '/(tabs)/newfeature' },
];
```

## Dependencies
- `lucide-react-native`: Icons
- `react-native-gesture-handler`: Touch gestures
- `expo-router`: Navigation

## Notes
- The drawer width is set to 75% of screen width for optimal mobile experience
- All animations use native driver for better performance
- The drawer automatically closes when navigating to a new screen
- Theme changes are reflected immediately in the drawer
