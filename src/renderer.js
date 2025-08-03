// Wait for electronAPI to be available
function waitForElectronAPI() {
    return new Promise((resolve) => {
        if (window.electronAPI) {
            resolve()
        } else {
            const checkAPI = () => {
                if (window.electronAPI) {
                    resolve()
                } else {
                    setTimeout(checkAPI, 100)
                }
            }
            checkAPI()
        }
    })
}

// Close app function (called from HTML)
function closeApp() {
    if (window.electronAPI) {
        window.electronAPI.closeApp()
    }
}

// Function to update battery progress bar
function updateBatteryStatus(level, isCharging, noBattery = false, state = "") {
    console.log("updateBatteryStatus called with:", { level, isCharging, noBattery, state })

    const batteryBar = document.querySelector(".battery-bar")
    const batteryLabel = document.querySelector(".battery-label")
    const batteryContainer = document.querySelector(".battery-status")
    const statusIndicator = document.querySelector(".status-indicator")

    console.log("DOM elements found:", { batteryBar, batteryLabel, batteryContainer, statusIndicator })

    if (!batteryBar || !batteryLabel || !batteryContainer || !statusIndicator) {
        console.error("Some DOM elements not found, retrying in 500ms...")
        setTimeout(() => updateBatteryStatus(level, isCharging, noBattery, state), 500)
        return
    }

    // Handle no battery case
    if (noBattery) {
        batteryBar.style.width = "0%"
        batteryLabel.textContent = "No Battery Detected"
        statusIndicator.textContent = "🖥️ Running on AC Power"
        batteryContainer.classList.remove("charging")
        batteryBar.style.background = "#666"
        console.log("Updated UI for no battery case")
        return
    }

    // Update battery bar width
    batteryBar.style.width = `${level}%`

    // Update battery label with charging status
    const chargingText = isCharging ? " (Charging)" : ""
    batteryLabel.textContent = `Battery: ${level}%${chargingText}`

    console.log("Updated battery bar width to:", `${level}%`)
    console.log("Updated battery label to:", `Battery: ${level}%${chargingText}`)

    // Update battery bar color based on level and charging status
    if (isCharging) {
        batteryBar.style.background = "#4caf50" // Green when charging
        if (state === "charged") {
            statusIndicator.textContent = "🔋 Battery fully charged"
        } else if (state === "finishing charge") {
            statusIndicator.textContent = "🔌 Finishing charge..."
        } else {
            statusIndicator.textContent = "🔌 Charging..."
        }
    } else if (level <= 20) {
        batteryBar.style.background = "#f44336" // Red when low
        statusIndicator.textContent = "⚠️ Battery low - please charge"
    } else if (level <= 50) {
        batteryBar.style.background = "#ff9800" // Orange when medium
        statusIndicator.textContent = "⚡ Battery level moderate"
    } else {
        batteryBar.style.background = "#4caf50" // Green when good
        statusIndicator.textContent = "✅ Battery level good"
    }

    // Add charging animation
    if (isCharging && state !== "charged") {
        batteryContainer.classList.add("charging")
    } else {
        batteryContainer.classList.remove("charging")
    }

    console.log("UI update completed")
}

// Initialize battery status on page load
async function initializeBatteryStatus() {
    console.log("Initializing battery status...")

    await waitForElectronAPI()
    console.log("electronAPI is now available")

    try {
        const batteryData = await window.electronAPI.getBatteryStatus()
        console.log("Initial battery data received:", batteryData)
        updateBatteryStatus(batteryData.level, batteryData.isCharging, batteryData.noBattery, batteryData.state)
    } catch (error) {
        console.error("Error getting initial battery status:", error)
        updateBatteryStatus(0, false, true)
    }

    // Set up battery update listener
    window.electronAPI.onBatteryUpdate((batteryData) => {
        console.log("Battery update received in renderer:", batteryData)
        updateBatteryStatus(batteryData.level, batteryData.isCharging, batteryData.noBattery, batteryData.state)
    })
}

// Initialize when DOM is loaded
document.addEventListener("DOMContentLoaded", () => {
    console.log("DOM loaded, initializing battery status...")
    initializeBatteryStatus()

    const mainContainer = document.querySelector(".container")
    const settingsContainer = document.querySelector(".settings-container")
    const openSettingsBtn = document.getElementById("open-settings")
    const backToMainBtn = document.getElementById("back-to-main")
    const saveSettingsBtn = document.getElementById("save-settings")
    const lowThresholdInput = document.getElementById("low-threshold")
    const highThresholdInput = document.getElementById("high-threshold")

    openSettingsBtn.addEventListener("click", async () => {
        showSettings()
    })

    backToMainBtn.addEventListener("click", () => {
        showMain()
    })

    saveSettingsBtn.addEventListener("click", () => {
        const low = parseInt(lowThresholdInput.value, 10)
        const high = parseInt(highThresholdInput.value, 10)
        window.electronAPI.setSettings({ low, high })
        showMain() // Go back to the main view
    })

    // Listen for the open-settings event from the main process
    window.electronAPI.onOpenSettings(() => {
        showSettings()
    })
})

// Analytics functionality
document.getElementById("open-analytics").addEventListener("click", () => {
    showAnalytics()
})

document.getElementById("back-to-main-from-analytics").addEventListener("click", () => {
    showMain()
})

document.getElementById("refresh-analytics").addEventListener("click", () => {
    loadAnalyticsData()
})

function showSettings() {
    window.electronAPI.resizeForSettings()
    document.querySelector(".container").style.display = "none"
    document.querySelector(".settings-container").style.display = "block"
    document.querySelector(".analytics-container").style.display = "none"
    document.querySelector(".bottom-buttons").style.display = "none" // Hide buttons in settings

    // Load settings data
    loadSettingsData()
}

function showAnalytics() {
    document.querySelector(".container").style.display = "none"
    document.querySelector(".settings-container").style.display = "none"
    document.querySelector(".analytics-container").style.display = "block"
    document.querySelector(".bottom-buttons").style.display = "none" // Hide buttons in analytics
    loadAnalyticsData()
}

function showMain() {
    window.electronAPI.resizeForMain()
    document.querySelector(".container").style.display = "block"
    document.querySelector(".settings-container").style.display = "none"
    document.querySelector(".analytics-container").style.display = "none"
    document.querySelector(".bottom-buttons").style.display = "flex" // Show buttons in main
}

async function loadSettingsData() {
    try {
        const settings = await window.electronAPI.getSettings()
        document.getElementById("low-threshold").value = settings.low
        document.getElementById("high-threshold").value = settings.high
    } catch (error) {
        console.error("Error loading settings:", error)
    }
}

async function loadAnalyticsData() {
    try {
        console.log("Loading analytics data...")

        // Show loading state
        const elements = {
            health: document.getElementById("battery-health"),
            cycleCount: document.getElementById("cycle-count"),
            designCapacity: document.getElementById("design-capacity"),
            currentCapacity: document.getElementById("current-capacity"),
            timeAt100: document.getElementById("time-at-100"),
            totalOverchargeTime: document.getElementById("total-overcharge-time"),
            totalChargeTime: document.getElementById("total-charge-time"),
            lastFullCharge: document.getElementById("last-full-charge"),
        }

        Object.values(elements).forEach(el => {
            if (el) el.textContent = "Loading..."
        })

        const analytics = await window.electronAPI.getBatteryAnalytics()
        console.log("Analytics data:", analytics)

        // Update health section
        if (elements.health) {
            elements.health.textContent = typeof analytics.health === 'number'
                ? `${analytics.health}%`
                : analytics.health
        }

        if (elements.cycleCount) {
            elements.cycleCount.textContent = analytics.cycleCount.toString()
        }

        if (elements.designCapacity) {
            elements.designCapacity.textContent = typeof analytics.designCapacity === 'number'
                ? `${analytics.designCapacity} mAh`
                : analytics.designCapacity
        }

        if (elements.currentCapacity) {
            elements.currentCapacity.textContent = typeof analytics.currentCapacity === 'number'
                ? `${analytics.currentCapacity} mAh`
                : analytics.currentCapacity
        }

        // Update timing section
        if (elements.timeAt100) {
            const time100 = analytics.timeAt100
            elements.timeAt100.textContent = time100 > 0
                ? `${time100}m`
                : "0m"
        }

        if (elements.totalOverchargeTime) {
            const totalOvercharge = analytics.totalOverchargeTime
            if (totalOvercharge >= 60) {
                const hours = Math.floor(totalOvercharge / 60)
                const minutes = totalOvercharge % 60
                elements.totalOverchargeTime.textContent = `${hours}h ${minutes}m`
            } else {
                elements.totalOverchargeTime.textContent = `${totalOvercharge}m`
            }
        }

        if (elements.totalChargeTime) {
            const totalTime = analytics.totalChargeTime
            if (totalTime >= 60) {
                const hours = Math.floor(totalTime / 60)
                const minutes = totalTime % 60
                elements.totalChargeTime.textContent = `${hours}h ${minutes}m`
            } else {
                elements.totalChargeTime.textContent = `${totalTime}m`
            }
        }

        if (elements.lastFullCharge) {
            elements.lastFullCharge.textContent = analytics.lastFullCharge === "-" || analytics.lastFullCharge === "Never"
                ? "-"
                : new Date(analytics.lastFullCharge).toLocaleString()
        }

    } catch (error) {
        console.error("Error loading analytics:", error)

        // Show error state
        document.querySelectorAll(".analytics-value").forEach(el => {
            el.textContent = "Error"
        })
    }
}

// Clean up listeners when page unloads
window.addEventListener("beforeunload", () => {
    if (window.electronAPI) {
        window.electronAPI.removeBatteryUpdateListener()
    }
})
