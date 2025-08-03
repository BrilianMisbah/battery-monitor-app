const { contextBridge, ipcRenderer } = require("electron")

console.log("Preload script is loading...")

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld("electronAPI", {
    // Get current battery status
    getBatteryStatus: () => ipcRenderer.invoke("get-battery-status"),

    // Expose functions for settings
    getSettings: () => ipcRenderer.invoke("get-settings"),
    setSettings: (settings) => ipcRenderer.invoke("set-settings", settings),

    // Expose functions for window resizing
    resizeForSettings: () => ipcRenderer.invoke("resize-for-settings"),
    resizeForMain: () => ipcRenderer.invoke("resize-for-main"),

    // Custom listener for battery updates
    onBatteryUpdate: (callback) => {
        const listener = (event, batteryData) => callback(batteryData)
        ipcRenderer.on("battery-update", listener)

        // Return a cleanup function
        return () => {
            ipcRenderer.removeListener("battery-update", listener)
        }
    },

    // Listen for tray events
    onOpenSettings: (callback) => {
        ipcRenderer.on("open-settings", callback)
    },
})

console.log("Preload script loaded, electronAPI exposed to window")
