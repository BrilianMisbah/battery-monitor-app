# 🔋 Battery Monitor App

A beautiful, feature-rich battery monitoring application **exclusively for macOS** built with Electron. Monitor your battery health, track charging patterns, and get intelligent notifications to optimize your MacBook's battery life.

**⚠️ macOS Only**: This app is specifically designed for macOS and uses macOS-specific system features. It is not compatible with Windows or Linux.

![Battery Monitor App](assets/energy.png)

## ✨ Features

### 🔋 **Real-Time Battery Monitoring**
- **Live battery percentage** with visual battery bar
- **Charging status detection** with animated indicators
- **Battery state monitoring** (charging, discharging, charged)
- **Automatic updates** every 5 seconds

### 📊 **Comprehensive Analytics**
- **Battery Health**: Current condition and cycle count
- **Capacity Information**: Design vs current capacity
- **Charging Time Tracking**: Session-based overcharge monitoring
- **Real-time Metrics**: Time spent at 100% and total charge time

### 🔔 **Smart Notifications**
- **Low Battery Alerts**: Configurable thresholds (default: 20%)
- **High Battery Warnings**: Remind to unplug at 80%
- **100% Full Notifications**: Prevent overcharging (every 10 minutes)
- **Intelligent Cooldowns**: Prevent notification spam
- **Charging State Detection**: Stop low battery alerts when charging

### ⚙️ **Customizable Settings**
- **Low Battery Threshold**: Set custom low battery alert percentage
- **High Battery Threshold**: Set custom high battery alert percentage
- **Persistent Settings**: Settings saved between app sessions

### 🎨 **Beautiful UI**
- **Glassmorphism Design**: Modern, translucent interface
- **Responsive Layout**: Adapts to different window sizes
- **Dark Theme**: Easy on the eyes
- **Smooth Animations**: Charging animations and transitions

### 🖥️ **System Integration**
- **Tray Icon**: Always accessible from menu bar
- **Native macOS Integration**: Proper dock icon and notifications
- **Background Operation**: Runs silently in the background
- **Proper Shutdown Handling**: Clean app termination
- **macOS-Specific Features**: Uses native macOS battery APIs and system commands

## 🚀 Installation

### Prerequisites
- **macOS 10.12 or later** (required - app is not compatible with other operating systems)
- Node.js 16+ and npm

### Development Setup
```bash
# Clone the repository
git clone <repository-url>
cd battery-monitor-app

# Install dependencies
npm install

# Start the app in development mode
npm start
```

### Building for Distribution
```bash
# Build for macOS (creates .dmg files)
npm run build-mac

# Build for distribution (no publishing)
npm run dist
```

The built app will be available in the `dist/` folder:
- `Battery Monitor-1.0.0-arm64.dmg` - For Apple Silicon Macs (M1/M2/M3)
- `Battery Monitor-1.0.0-x64.dmg` - For Intel Macs

**Note**: This app is designed exclusively for macOS and cannot be built for Windows or Linux.

## 📱 Usage

### Main Interface
- **Battery Bar**: Visual representation of current battery level
- **Percentage Display**: Current battery percentage
- **Status Indicator**: Shows charging/discharging status
- **Settings Button (⚙️)**: Access notification settings
- **Analytics Button (📊)**: View detailed battery analytics

### Tray Menu
- **Show App**: Display the main window
- **Settings**: Quick access to notification settings
- **Quit**: Close the application completely

### Settings Page
- **Low Battery Alert**: Set percentage for low battery warnings
- **High Battery Alert**: Set percentage for high battery warnings
- **Save**: Apply your settings
- **Back**: Return to main view

### Analytics Page
- **Battery Health**: Current condition and cycle count
- **Capacity Info**: Design and current capacity in mAh
- **Charging Time**: Session-based time tracking
- **Refresh**: Update analytics data
- **Back**: Return to main view

## 🔧 Configuration

### Notification Thresholds
- **Low Battery**: Default 20% (configurable)
- **High Battery**: Default 80% (configurable)
- **100% Full**: Automatic every 10 minutes

### Notification Cooldowns
- **Low Battery**: 2 minutes when not charging
- **High Battery**: 5 minutes when charging
- **100% Full**: 10 minutes when at 100%

## 🛠️ Technical Details

### Architecture
- **Frontend**: HTML5, CSS3, JavaScript
- **Backend**: Electron (Node.js)
- **Battery Data**: macOS system commands + macos-battery library (macOS-specific)
- **Storage**: electron-store for persistent settings
- **Platform**: macOS only - uses native macOS APIs and system integration

### Key Components
- **Main Process**: Battery monitoring, notifications, system integration
- **Renderer Process**: UI rendering and user interactions
- **Preload Script**: Secure IPC communication
- **Analytics Engine**: Real-time battery health data collection

### System Requirements
- **OS**: macOS 10.12+ (exclusively - no Windows or Linux support)
- **Architecture**: Intel (x64) and Apple Silicon (arm64)
- **Memory**: ~50MB RAM usage
- **Storage**: ~100MB disk space
- **Dependencies**: macOS system commands and native battery APIs

## 🎯 Battery Health Features

### Overcharge Prevention
- **Real-time tracking** of time spent at 100%
- **Session-based monitoring** (resets each charge cycle)
- **Smart notifications** to prevent overcharging
- **Analytics insights** for charging habit optimization

### Health Monitoring
- **Cycle count tracking** from system data
- **Capacity degradation** monitoring
- **Battery condition** assessment
- **Historical data** for trend analysis

## 🔒 Privacy & Security

- **Local Only**: No data sent to external servers
- **System Permissions**: Only requests necessary macOS battery access
- **Secure IPC**: Isolated communication between processes
- **No Tracking**: Completely private battery monitoring
- **macOS Native**: Uses only macOS system APIs and commands

## 🐛 Troubleshooting

### Common Issues

**App won't start:**
- Check Node.js version (requires 16+)
- Ensure all dependencies are installed
- Check macOS permissions for accessibility

**Battery data not showing:**
- Verify macOS battery permissions
- Check if battery is detected by macOS system
- Ensure you're running on macOS (app is not compatible with other OS)
- Restart the app if needed

**Notifications not working:**
- Check macOS notification permissions
- Verify notification settings in app
- Ensure app is not in Do Not Disturb mode

### Development Debugging
```bash
# Enable DevTools (uncomment in main.js)
win.webContents.openDevTools()

# Check console logs for debugging
# All battery data and events are logged
```

## 📈 Future Features

- [ ] Battery health trend analysis
- [ ] Export analytics data
- [ ] Custom notification sounds
- [ ] Battery usage statistics
- [ ] Power consumption monitoring
- [ ] Enhanced macOS integration features
- [ ] Advanced battery health predictions

**Note**: All future features will remain macOS-exclusive to maintain optimal performance and system integration.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

- **Electron** for the desktop application framework
- **macos-battery** for macOS battery data access
- **Apple** for macOS system integration and APIs
- **Community** for feedback and suggestions

---

**Made with ❤️ for better battery health**

*Optimize your MacBook's battery life with intelligent monitoring and smart notifications. Designed exclusively for macOS.*