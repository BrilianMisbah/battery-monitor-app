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
        window.electronAPI.resizeForSettings()
        mainContainer.style.display = "none"
        settingsContainer.style.display = "block"
        openSettingsBtn.style.display = "none"

        const settings = await window.electronAPI.getSettings()
        lowThresholdInput.value = settings.low
        highThresholdInput.value = settings.high
    })

    backToMainBtn.addEventListener("click", () => {
        window.electronAPI.resizeForMain()
        mainContainer.style.display = "block"
        settingsContainer.style.display = "none"
        openSettingsBtn.style.display = "block"
    })

    saveSettingsBtn.addEventListener("click", () => {
        const low = parseInt(lowThresholdInput.value, 10)
        const high = parseInt(highThresholdInput.value, 10)
        window.electronAPI.setSettings({ low, high })
        backToMainBtn.click() // Go back to the main view
    })

    // Listen for the open-settings event from the main process
    window.electronAPI.onOpenSettings(() => {
        openSettingsBtn.click()
    })
})

// Clean up listeners when page unloads
window.addEventListener("beforeunload", () => {
    if (window.electronAPI) {
        window.electronAPI.removeBatteryUpdateListener()
    }
})
