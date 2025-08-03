import { app, BrowserWindow, Notification, ipcMain, systemPreferences, Tray, Menu } from "electron"
import { fileURLToPath } from "url"
import { dirname, join } from "path"
import { createRequire } from "module"
import Store from "electron-store"

const require = createRequire(import.meta.url)
const macOsBattery = require("macos-battery")

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const store = new Store({
    defaults: {
        notificationThresholds: {
            low: 20,
            high: 80,
        },
    },
})

let win
let tray
let batteryCheckInterval
let lastNotificationTime = 0
const NOTIFICATION_COOLDOWN = 30000 // 30 seconds cooldown between notifications

// Check macOS permissions
async function checkPermissions() {
    console.log("Checking macOS permissions...")

    // Check for accessibility permissions if needed
    if (process.platform === "darwin") {
        const hasAccessibilityAccess = systemPreferences.isTrustedAccessibilityClient(false)
        console.log("Accessibility access:", hasAccessibilityAccess)

        // Request permissions if needed
        if (!hasAccessibilityAccess) {
            console.log("Requesting accessibility permissions...")
            systemPreferences.isTrustedAccessibilityClient(true)
        }
    }
}

// Create a window when the app is ready
function createWindow() {
    console.log("Creating window with preload script at:", join(__dirname, "preload.js"))

    win = new BrowserWindow({
        width: 305, // Reduced width to better fit the new compact design
        height: 275, // Reduced height for a smaller footprint
        // width: 405, // Reduced width to better fit the new compact design
        // height: 375, // Reduced height for a smaller footprint
        frame: true, // Use native frame
        titleBarStyle: "hidden", // for macOS to get traffic lights
        trafficLightPosition: { x: 10, y: 13 },
        resizable: false, // Make the window not resizable
        alwaysOnTop: true,
        icon: join(__dirname, "../assets/energy.png"), // Set app icon
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: join(__dirname, "preload.js"),
            webSecurity: false, // For debugging
        },
    })

    win.loadFile("src/index.html")

    // Open DevTools for debugging
    // win.webContents.openDevTools()

    // Check permissions
    checkPermissions()

    // Log when the page finishes loading
    win.webContents.once("did-finish-load", () => {
        console.log("Page finished loading")
    })

    // Hide the window when it's closed instead of quitting
    win.on("close", (event) => {
        if (app.quitting) {
            win = null
        } else {
            event.preventDefault()
            win.hide()
        }
    })

    // Start battery monitoring
    startBatteryMonitoring()
}

// Create a tray icon when the app is ready
function createTray() {
    console.log("Creating tray icon...")
    const iconPath = join(__dirname, "../assets/energyTemplate.png") // Use template image for macOS
    console.log(`Icon path: ${iconPath}`)

    tray = new Tray(iconPath)

    const contextMenu = Menu.buildFromTemplate([
        { label: "Show App", click: () => win.show() },
        {
            label: "Settings",
            click: () => {
                win.show()
                win.webContents.send("open-settings")
            },
        },
        { type: "separator" },
        {
            label: "Quit",
            click: () => {
                app.quitting = true
                app.quit()
            },
        },
    ])

    tray.setToolTip("Battery Monitor")
    tray.setContextMenu(contextMenu)

    tray.on("click", () => {
        win.isVisible() ? win.hide() : win.show()
    })

    console.log("Tray icon created successfully.")
}

// Get battery status using macos-battery library
async function getBatteryStatus() {
    try {
        console.log("Getting battery status...")

        // Get battery data using the macos-battery library
        const batteryData = await macOsBattery.getBatteryStateObject()
        console.log("Battery data received:", batteryData)

        // Handle the case where no battery is present
        if (batteryData.percent === -1 || batteryData.state === "no battery") {
            console.log("No battery detected")
            return {
                level: 0,
                isCharging: false,
                noBattery: true,
            }
        }

        // Map the charging states
        const isCharging = batteryData.state === "charging" || batteryData.state === "charged" || batteryData.state === "finishing charge"

        const result = {
            level: batteryData.percent,
            isCharging: isCharging,
            noBattery: false,
            state: batteryData.state,
        }

        console.log("Returning battery status:", result)
        return result
    } catch (error) {
        console.error("Error getting battery status from macos-battery:", error)
        // Fallback for demo purposes or when the library fails
        return {
            level: Math.floor(Math.random() * 100),
            isCharging: Math.random() > 0.5,
            noBattery: false,
            state: "undetermined",
        }
    }
}

// Start battery monitoring
function startBatteryMonitoring() {
    console.log("Starting battery monitoring...")

    // Wait for the renderer to be ready before sending initial data
    win.webContents.once("dom-ready", () => {
        console.log("DOM ready, sending initial battery data...")
        setTimeout(async () => {
            const batteryData = await getBatteryStatus()
            console.log("Initial battery data:", batteryData)
            if (win && !win.isDestroyed()) {
                win.webContents.send("battery-update", batteryData)
            }
        }, 1000) // Wait 1 second for everything to be fully loaded
    })

    // Check battery status every 5 seconds
    batteryCheckInterval = setInterval(async () => {
        try {
            const batteryData = await getBatteryStatus()

            // Send battery data to renderer
            if (win && !win.isDestroyed() && win.webContents.isDestroyed() === false) {
                win.webContents.send("battery-update", batteryData)
                console.log("Sent battery update to renderer:", batteryData)
            }

            // Check for notifications (only if we have a battery)
            if (!batteryData.noBattery) {
                checkBatteryNotifications(batteryData.level, batteryData.isCharging)
            }
        } catch (error) {
            console.error("Error getting battery info:", error)
        }
    }, 5000) // Check every 5 seconds
}

// Check and send battery notifications
function checkBatteryNotifications(level, isCharging) {
    const now = Date.now()
    const thresholds = store.get("notificationThresholds")

    // Only send notifications if enough time has passed since last notification
    if (now - lastNotificationTime < NOTIFICATION_COOLDOWN) {
        return
    }

    if (level <= thresholds.low && !isCharging) {
        sendNotification("Battery Low", `Battery is at ${level}%. Please plug in your charger.`)
        lastNotificationTime = now
    } else if (level >= thresholds.high && isCharging) {
        sendNotification("Battery Almost Full", `Battery is at ${level}%. You can unplug your charger.`)
        lastNotificationTime = now
    }
}

// Send system notification
function sendNotification(title, message) {
    if (Notification.isSupported()) {
        new Notification({ title, body: message }).show()
    }
}

// IPC handlers
ipcMain.handle("get-battery-status", async () => {
    try {
        return await getBatteryStatus()
    } catch (error) {
        console.error("Error getting battery status:", error)
        return { level: 0, isCharging: false, noBattery: true }
    }
})

// IPC handlers for settings
ipcMain.handle("get-settings", () => {
    return store.get("notificationThresholds")
})

ipcMain.handle("set-settings", (event, settings) => {
    store.set("notificationThresholds", settings)
})

// IPC handler to resize window for settings
ipcMain.handle("resize-for-settings", () => {
    if (win) {
        win.setSize(300, 320, true) // Animate the resize
    }
})

ipcMain.handle("resize-for-main", () => {
    if (win) {
        win.setSize(285, 245, true) // Animate back to original size
    }
})

// When the app is ready, create the window
app.whenReady().then(() => {
    createWindow()
    createTray()

    // Set dock icon for development (macOS only)
    if (process.platform === 'darwin') {
        const dockIconPath = join(__dirname, "../assets/energy.png")
        app.dock.setIcon(dockIconPath)
    }
})

// Quit the app when closed
app.on("window-all-closed", () => {
    if (process.platform !== "darwin") {
        clearInterval(batteryCheckInterval)
        app.quit()
    }
})

app.on("activate", () => {
    if (BrowserWindow.getAllWindows().length === 0) {
        createWindow()
    }
})

// Clean up on app quit
app.on("before-quit", () => {
    clearInterval(batteryCheckInterval)
    tray.destroy()
})
