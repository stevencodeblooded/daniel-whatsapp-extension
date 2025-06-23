// Implement getLoggedInWhatsApp function
async function getLoggedInWhatsApp() {
    try {
        const sender_number = await new Promise((resolve) => {
            const intervalId = setInterval(() => {
                let number = "Unknown";
                try {
                    if (window.localStorage.getItem("last-wid")) {
                        let data = window.localStorage.getItem("last-wid");
                        number = data.split("@")[0].substring(1);
                    } else if (window.localStorage.getItem("last-wid-md")) {
                        let data = window.localStorage.getItem("last-wid-md");
                        number = data.split(":")[0].substring(1);
                    }
                    
                    if (number !== "Unknown") {
                        clearInterval(intervalId);
                        resolve(number);
                    }
                } catch (error) {
                    console.error("Error getting WhatsApp number:", error);
                    clearInterval(intervalId);
                    resolve("Unknown");
                }
            }, 1000);

            // Timeout after 10 seconds
            setTimeout(() => {
                clearInterval(intervalId);
                resolve("Unknown");
            }, 10000);
        });

        return sender_number;
    } catch (error) {
        console.error("Error getting WhatsApp number:", error);
        return "Unknown";
    }
}

// Make function available globally
window.getLoggedInWhatsApp = getLoggedInWhatsApp;