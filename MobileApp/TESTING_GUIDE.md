# Quick Start Guide: Testing the Drawer Menu

## Prerequisites
- Expo development environment set up
- Android Studio or iOS Simulator installed
- Mobile device with Expo Go app (optional)

## Running the App

### Option 1: Android Emulator
```bash
cd MobileApp
npm run android
```

### Option 2: iOS Simulator (Mac only)
```bash
cd MobileApp
npm run ios
```

### Option 3: Physical Device
```bash
cd MobileApp
npm start
```
Then scan the QR code with Expo Go app.

## Testing the Drawer

### 1. **Open the Drawer**
- Launch the app and log in
- You'll see a **menu icon (☰)** in the top-left corner of the screen
- Tap the menu icon to open the drawer

### 2. **Explore the Instagram Profile Section**
- View the Instagram-style profile icon with pink border
- Check the username and handle
- See the three statistics:
  - Followers: 24.5K
  - Reels: 2,986
  - DM Rate: 85/hr

### 3. **Navigate Using the Menu**
- Tap **Dashboard** to go to the main dashboard
- Tap **Affiliate** to view affiliate features
- Tap **Pricing** to see pricing plans
- Tap **Settings** to access settings

### 4. **Close the Drawer**
Try all three methods:
- Tap the **X button** in the top-right of the drawer
- Tap the **dark area** outside the drawer
- Tap any **menu item** (drawer closes automatically)

### 5. **Test Theme Switching**
- Go to Settings
- Toggle between light and dark mode
- Open the drawer again
- Notice how colors adapt to the theme

### 6. **Check Notifications**
- Look at the **bell icon** in the header
- Notice the red badge showing "3" notifications

## What to Look For

### ✅ Visual Checks
- [ ] Drawer slides smoothly from the left
- [ ] Instagram profile icon has pink border
- [ ] Stats are displayed in three columns
- [ ] Menu items have green icons
- [ ] Logout button is red
- [ ] Theme colors are consistent
- [ ] Text is readable
- [ ] Spacing looks good

### ✅ Interaction Checks
- [ ] Menu button opens drawer
- [ ] X button closes drawer
- [ ] Backdrop tap closes drawer
- [ ] Menu items navigate correctly
- [ ] Drawer closes after navigation
- [ ] Logout works properly
- [ ] Animations are smooth
- [ ] No lag or stuttering

### ✅ Responsive Checks
- [ ] Drawer width is appropriate (75% of screen)
- [ ] Content scrolls if needed
- [ ] Works on different screen sizes
- [ ] Safe areas respected (notches, etc.)

## Troubleshooting

### Drawer Not Opening
- Check if menu button is visible
- Ensure no JavaScript errors in console
- Restart the app

### Styling Issues
- Clear cache: `npm start -- --clear`
- Rebuild: `npm run android` or `npm run ios`

### Navigation Not Working
- Check expo-router is properly configured
- Verify all routes exist
- Check console for errors

## Customization Testing

### Update Profile Name
1. Open `src/components/CustomDrawer.tsx`
2. Find line 126: `DMPanda User`
3. Change to your name
4. Save and reload app
5. Open drawer to see changes

### Update Instagram Handle
1. Open `src/components/CustomDrawer.tsx`
2. Find line 131: `@dmpanda`
3. Change to your handle
4. Save and reload app

### Update Stats
1. Open `src/components/CustomDrawer.tsx`
2. Find lines 137-148
3. Change the numbers
4. Save and reload app

## Screenshots to Take

For documentation/review:
1. Drawer closed (showing menu button)
2. Drawer open (full view)
3. Instagram profile section (close-up)
4. Navigation menu items
5. Account section
6. Light theme version
7. Dark theme version

## Performance Testing

### Check Animation Performance
- Open and close drawer multiple times
- Should be smooth (60 fps)
- No stuttering or lag

### Check Memory Usage
- Open drawer
- Navigate between screens
- Close drawer
- Repeat 10 times
- App should remain responsive

## Known Limitations

1. **Profile Image**: Currently shows Instagram icon, not actual user photo
2. **Stats**: Hardcoded values, not fetched from API
3. **Notifications**: Badge count is static (3)
4. **Gestures**: No swipe-to-open gesture (tap only)

## Next Steps After Testing

If everything works:
1. ✅ Mark as complete
2. 📝 Document any issues found
3. 🎨 Consider design improvements
4. 🔧 Plan API integration for real data
5. 📱 Test on multiple devices

## Support

If you encounter issues:
1. Check the console for errors
2. Review `DRAWER_MENU.md` for documentation
3. Check `IMPLEMENTATION_SUMMARY.md` for details
4. Verify all dependencies are installed

---

**Happy Testing! 🚀**
