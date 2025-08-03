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
let lastLowBatteryNotificationTime = 0
let lastHighBatteryNotificationTime = 0
let lastFullBatteryNotificationTime = 0
let isCurrentlyCharging = false // Track charging state to detect changes
let timeAt100Start = null // When battery reached 100% while charging
let chargingStartTime = null // When charging started
let totalTimeAt100 = 0 // Total accumulated time at 100%
let totalOverchargeTime = 0 // Total accumulated overcharge time across all sessions
let isQuitting = false // Track if app is in process of quitting
const LOW_BATTERY_COOLDOWN = 120000 // 2 minutes for low battery when not charging
const HIGH_BATTERY_COOLDOWN = 300000 // 5 minutes for high battery notifications
const FULL_BATTERY_COOLDOWN = 600000 // 10 minutes for 100% battery notifications

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

    // Handle window close
    win.on("close", (event) => {
        if (isQuitting) {
            // App is quitting, allow close
            win = null
        } else {
            // User clicked X, hide window instead of quitting
            event.preventDefault()
            win.hide()
        }
    })

    // Handle window closed
    win.on("closed", () => {
        win = null
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
                isQuitting = true
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

        // Track charging time for analytics
        trackChargingTime(result.level, isCharging)

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

// Get detailed battery analytics using system commands
async function getBatteryAnalytics() {
    try {
        console.log("Getting battery analytics...")

        // Get basic battery data from macos-battery
        const batteryData = await macOsBattery.getBatteryStateObject()
        console.log("Basic battery data received:", batteryData)

        // Get detailed battery info using system commands
        const { exec } = require('child_process')
        const util = require('util')
        const execAsync = util.promisify(exec)

        let health = "Unknown"
        let cycleCount = 0
        let designCapacity = 0
        let currentCapacity = 0
        let temperature = 0
        let voltage = 0

        try {
            // Get all battery information in one command
            const batteryResult = await execAsync('system_profiler SPPowerDataType')
            const batteryLines = batteryResult.stdout.split('\n')

            for (const line of batteryLines) {
                const trimmedLine = line.trim()

                // Get cycle count
                if (trimmedLine.includes('Cycle Count:')) {
                    cycleCount = parseInt(trimmedLine.split(':')[1].trim()) || 0
                }
                // Get battery condition/health
                else if (trimmedLine.includes('Condition:')) {
                    health = trimmedLine.split(':')[1].trim() || "Unknown"
                }
                // Get maximum capacity (this is the health percentage)
                else if (trimmedLine.includes('Maximum Capacity:')) {
                    const capacityMatch = trimmedLine.match(/(\d+)%/)
                    if (capacityMatch) {
                        // Convert percentage to actual capacity (approximate)
                        // Most MacBook batteries are around 5000-7000 mAh
                        const percentage = parseInt(capacityMatch[1])
                        designCapacity = 6000 // Approximate design capacity
                        currentCapacity = Math.round((percentage / 100) * designCapacity)
                    }
                }
            }

            console.log("Parsed battery data:", {
                cycleCount,
                health,
                designCapacity,
                currentCapacity
            })

        } catch (cmdError) {
            console.log("System command failed, using fallback data:", cmdError.message)
        }

        // Calculate time metrics
        const now = Date.now()
        let currentTimeAt100 = 0
        let totalChargeTime = 0

        if (timeAt100Start && batteryData.percent >= 100 && isCurrentlyCharging) {
            currentTimeAt100 = Math.floor((now - timeAt100Start) / 1000 / 60) // minutes
        }

        if (chargingStartTime && isCurrentlyCharging) {
            totalChargeTime = Math.floor((now - chargingStartTime) / 1000 / 60) // minutes
        }

        return {
            health: health,
            cycleCount: cycleCount,
            designCapacity: designCapacity,
            currentCapacity: currentCapacity,
            timeAt100: currentTimeAt100,
            totalChargeTime: totalChargeTime,
            totalOverchargeTime: totalTimeAt100, // Session overcharge time (resets each charge)
            lastFullCharge: "-", // Not easily available via system commands
            temperature: "-", // Not available in system_profiler output
            voltage: "-", // Not available in system_profiler output
        }
    } catch (error) {
        console.error("Error getting battery analytics:", error)
        return {
            health: "Error",
            cycleCount: "-",
            designCapacity: "-",
            currentCapacity: "-",
            timeAt100: 0,
            totalChargeTime: 0,
            totalOverchargeTime: 0,
            lastFullCharge: "-",
            temperature: "-",
            voltage: "-",
        }
    }
}

// Track charging time for analytics
function trackChargingTime(level, isCharging) {
    const now = Date.now()

    // Track when charging starts
    if (isCharging && !isCurrentlyCharging) {
        chargingStartTime = now
        console.log("Charging started, tracking charge time")
    }

    // Track when charging stops
    if (!isCharging && isCurrentlyCharging) {
        chargingStartTime = null
        timeAt100Start = null
        totalTimeAt100 = 0 // Reset session overcharge time when charging stops
        console.log("Charging stopped, reset timers and session overcharge time")
    }

    // Track time at 100%
    if (level >= 100 && isCharging) {
        if (!timeAt100Start) {
            timeAt100Start = now
            console.log("Battery reached 100%, starting 100% timer")
        }
    } else {
        if (timeAt100Start) {
            // Add to total time at 100% before resetting
            const sessionTimeAt100 = Math.floor((now - timeAt100Start) / 1000 / 60)
            totalTimeAt100 += sessionTimeAt100
            totalTimeAt100 += sessionTimeAt100 // Add to session overcharge time
            timeAt100Start = null
            console.log(`Battery dropped below 100% or stopped charging. Session time at 100%: ${sessionTimeAt100}m, Session overcharge time: ${totalTimeAt100}m`)
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

    // Detect charging state changes
    const chargingStateChanged = isCurrentlyCharging !== isCharging
    if (chargingStateChanged) {
        console.log(`Charging state changed: ${isCurrentlyCharging} -> ${isCharging}`)
        isCurrentlyCharging = isCharging

        // If started charging, reset low battery notification timer to stop spam
        if (isCharging) {
            lastLowBatteryNotificationTime = now
            console.log("Started charging - low battery notifications paused")
        }
    }

    // LOW BATTERY NOTIFICATIONS
    if (level <= thresholds.low && !isCharging) {
        // Send low battery notification with appropriate cooldown
        if (now - lastLowBatteryNotificationTime >= LOW_BATTERY_COOLDOWN) {
            const urgencyLevel = level <= 10 ? "CRITICAL" : level <= 15 ? "VERY LOW" : "LOW"
            sendNotification(
                `Battery ${urgencyLevel}`,
                `Battery is at ${level}%. Please plug in your charger immediately!`
            )
            lastLowBatteryNotificationTime = now
            console.log(`Sent low battery notification: ${level}%`)
        }
    }

    // FULL BATTERY NOTIFICATIONS (100% charged)
    if (level >= 100 && isCharging) {
        // Send 100% notification with longer cooldown (10 minutes)
        if (now - lastFullBatteryNotificationTime >= FULL_BATTERY_COOLDOWN) {
            sendNotification("Battery Full 🔋", "Battery is fully charged! Unplug your charger to preserve battery health.")
            lastFullBatteryNotificationTime = now
            console.log(`Sent full battery notification: ${level}%`)
        }
    }
    // HIGH BATTERY NOTIFICATIONS (when charging, but not 100%)
    else if (level >= thresholds.high && level < 100 && isCharging) {
        // Only send if enough time passed since last high battery notification
        if (now - lastHighBatteryNotificationTime >= HIGH_BATTERY_COOLDOWN) {
            sendNotification("Battery Almost Full", `Battery is at ${level}%. You can unplug your charger.`)
            lastHighBatteryNotificationTime = now
            console.log(`Sent high battery notification: ${level}%`)
        }
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
        win.setSize(305, 280, true) // Animate the resize
    }
})

ipcMain.handle("resize-for-main", () => {
    if (win) {
        win.setSize(305, 275, true) // Animate back to original size
    }
})

// IPC handler for battery analytics
ipcMain.handle("get-battery-analytics", async () => {
    try {
        return await getBatteryAnalytics()
    } catch (error) {
        console.error("Error getting battery analytics:", error)
        return {
            health: "Error",
            cycleCount: "N/A",
            designCapacity: "N/A",
            currentCapacity: "N/A",
            timeAt100: 0,
            totalChargeTime: 0,
            lastFullCharge: "Error",
        }
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
    console.log("App quitting, cleaning up...")
    cleanupApp()
})

// Handle system shutdown/restart
app.on("before-quit-for-update", () => {
    console.log("App updating, cleaning up...")
    cleanupApp()
})

// Handle macOS system shutdown/restart
if (process.platform === 'darwin') {
    app.on("before-quit", () => {
        console.log("macOS system shutdown detected, cleaning up...")
        cleanupApp()
    })
}

// Handle Windows system shutdown/restart
if (process.platform === 'win32') {
    process.on('SIGTERM', () => {
        console.log("Windows system shutdown detected, cleaning up...")
        cleanupApp()
    })
}

// Handle Linux system shutdown/restart
if (process.platform === 'linux') {
    process.on('SIGTERM', () => {
        console.log("Linux system shutdown detected, cleaning up...")
        cleanupApp()
    })
}

// Comprehensive cleanup function
function cleanupApp() {
    try {
        console.log("Starting app cleanup...")
        isQuitting = true

        // Clear all intervals
        if (batteryCheckInterval) {
            clearInterval(batteryCheckInterval)
            console.log("Cleared battery check interval")
        }

        // Destroy tray
        if (tray && !tray.isDestroyed()) {
            tray.destroy()
            console.log("Destroyed tray")
        }

        // Close all windows
        const windows = BrowserWindow.getAllWindows()
        windows.forEach(window => {
            if (!window.isDestroyed()) {
                window.destroy()
                console.log("Destroyed window")
            }
        })

        // Force quit after cleanup
        setTimeout(() => {
            console.log("Force quitting app...")
            app.exit(0)
        }, 1000)

    } catch (error) {
        console.error("Error during cleanup:", error)
        app.exit(1)
    }
}
