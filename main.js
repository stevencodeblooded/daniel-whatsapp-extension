// File name =>  of main.js
// const API_URL =
//   window.appConfig && window.appConfig.apiUrl
//     ? window.appConfig.apiUrl
//     : "http://swiftmsg.southafricanorth.cloudapp.azure.com/api";

// Properly get API URL from storage
let API_URL = "http://localhost:80/api"; // default

chrome.storage.local.get("appConfig", (result) => {
  if (result.appConfig && result.appConfig.apiUrl) {
    API_URL = result.appConfig.apiUrl;
    console.log("API URL loaded from config:", API_URL);
  }
});

console.log("API URL:", API_URL);

// In main.js
chrome.runtime.onConnect.addListener((port) => {
  console.log("Connection established");
});

// STATES & EVENTS
const SENT_STATE = "Message Sent!";
const NOTFOUND_STATE = "No WhatsApp";
const NOCODE_STATE = "No Country Code";
const BLOCKED_STATE = "Blocked Contact";
const IDLE_STATE = "---";
const MSG_SENT_EVENT = "messageSent";
let is_sent = false;
let debug_mode = false;

chrome.storage.onChanged.addListener((changes) => {
  if (changes.debugMode) {
    debug_mode = changes.debugMode.newValue;
    console.log("Debug mode set to:", debug_mode);
  }
});

chrome.storage.local.get("debugMode", (result) => {
  if (result.debugMode !== undefined) {
    debug_mode = result.debugMode;
    console.log("Debug mode initialized:", debug_mode);
  }
});

const wa = new Whatsapp();
// INJECTING ATTACHMENT INPUT
let mediaInput = document.createElement("input");
mediaInput.id = "mediaInput";
mediaInput.multiple = true;
mediaInput.type = "file";
document.body.appendChild(mediaInput);

// STATE INITIALIZATION
window.addEventListener("load", async () => {
  // DEFAULT STATE
  chrome.storage.local.set({ state: "stopped" });
  chrome.storage.local.set({ pendingStop: false });
  // GET THE LOGGED IN WHATSAPP NUMBER
  let number = await getLoggedInWhatsApp();
  chrome.storage.local.set({ senderNumber: number });
  chrome.runtime.sendMessage({ message: "got logged in whatsapp" });
});

// Error Handler
// TODO //

//////////////////////////////////////////////////////////////////////
// MESSAGE LISTENERS

/*
BUG NOTE: "sender" param must be passed to onMessage listener even if it's not used
and sendResponse() must be called to avoid port closing bug
*/

// Attachments Button Clicked
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message.toLowerCase() === "media clicked") {
    // BUG FIX: The message port closed before a response was received.
    sendResponse();
    document.getElementById("mediaInput").click();
  }
});

// Handle file transfer preparation
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "prepare_for_file_transfer") {
    sendResponse(); // Acknowledge receipt

    // Connect to the popup to request the files
    const port = chrome.runtime.connect({
      name: `file_transfer_${request.transferId}`,
    });

    // Request the files
    port.postMessage({ action: "request_files" });

    // Handle the file transfer
    port.onMessage.addListener((msg) => {
      if (msg.action === "transfer_file_list") {
        // Get the files from the message
        const receivedFiles = msg.files;

        // Create a FileList-like object
        const dataTransfer = new DataTransfer();
        for (let i = 0; i < receivedFiles.length; i++) {
          dataTransfer.items.add(receivedFiles[i]);
        }

        // Store the files in the mediaInput element
        const mediaInput = document.getElementById("mediaInput");
        if (mediaInput) {
          mediaInput.files = dataTransfer.files;
          console.log(
            "Files transferred successfully:",
            mediaInput.files.length
          );
        } else {
          console.error("Media input element not found");
        }
      }
    });
  }
});

// Start Sending Button Clicked
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message.toLowerCase() === "start sending") {
    // BUG FIX: The message port closed before a response was received.
    sendResponse();
    startSending();
  }
});

// Handle comprehensive media clearing
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (
    request.message === "clear_media_files" ||
    request.message === "clear_all_media_data"
  ) {
    try {
      console.log("Clearing all media files in content script...");

      // Clear the main media input element
      const mediaInput = document.getElementById("mediaInput");
      if (mediaInput) {
        mediaInput.value = "";
        mediaInput.files = null;

        // Create a new empty DataTransfer to clear files
        const dataTransfer = new DataTransfer();
        mediaInput.files = dataTransfer.files;

        console.log(
          "Main media input cleared, files count:",
          mediaInput.files.length
        );
      }

      // Clear any file inputs that might exist in the page
      const allFileInputs = document.querySelectorAll('input[type="file"]');
      allFileInputs.forEach((input, index) => {
        input.value = "";
        const emptyTransfer = new DataTransfer();
        input.files = emptyTransfer.files;
        console.log(`File input ${index} cleared`);
      });

      // Reset the originalMediaFiles variable if it exists
      if (typeof originalMediaFiles !== "undefined") {
        originalMediaFiles = null;
      }

      // Clear any global variables that might store media
      if (typeof window.selectedMediaFiles !== "undefined") {
        window.selectedMediaFiles = null;
      }

      sendResponse({
        status: "success",
        message: "All media files cleared",
        clearedInputs: allFileInputs.length,
      });
    } catch (error) {
      console.error("Error clearing media files:", error);
      sendResponse({
        status: "error",
        message: error.toString(),
      });
    }
  }

  // Always return true for async response
  return true;
});

// Handle file transfer from extension to WhatsApp
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.message === "transfer_media_files") {
    try {
      console.log("Received media transfer request");

      // Create file objects from the data
      const fileData = request.fileData;
      if (!fileData || !fileData.length) {
        console.error("No file data received");
        sendResponse({ status: "error", message: "No files to transfer" });
        return;
      }

      // Create a FileList-like object
      const dataTransfer = new DataTransfer();

      // Process each file
      for (const file of fileData) {
        try {
          // Safely convert base64 to blob
          const dataUrl = file.data;
          const base64Index = dataUrl.indexOf(",") + 1;
          if (base64Index === 0) {
            console.error("Invalid data URL format for file:", file.name);
            continue;
          }

          const base64 = dataUrl.substring(base64Index);
          // Use safer method to decode base64
          try {
            const byteString = atob(base64);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);

            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }

            const blob = new Blob([ab], { type: file.type });
            const fileObj = new File([blob], file.name, { type: file.type });
            dataTransfer.items.add(fileObj);
          } catch (decodeError) {
            console.error("Error decoding file data:", decodeError);
            // Continue with other files
            continue;
          }
        } catch (error) {
          console.error("Error processing file:", file.name, error);
          // Continue with other files
        }
      }

      // Store the files in the mediaInput element
      const mediaInput = document.getElementById("mediaInput");
      if (mediaInput) {
        if (dataTransfer.files.length > 0) {
          mediaInput.files = dataTransfer.files;

          // Add more detailed logging
          if (debug_mode) {
            console.log(
              "Media files transferred successfully:",
              mediaInput.files.length
            );
            mediaInput.files.forEach((file, index) => {
              console.log(`File ${index + 1}:`, {
                name: file.name,
                type: file.type,
                size: file.size,
              });
            });
          }

          sendResponse({
            status: "success",
            fileCount: dataTransfer.files.length,
          });
        } else {
          console.error("No valid files were processed");

          if (debug_mode) {
            chrome.runtime.sendMessage({
              message: "media_transfer_error",
              error: "No valid files could be processed",
            });
          }

          sendResponse({
            status: "error",
            message: "No valid files to transfer",
          });
        }
      } else {
        console.error("Media input element not found");

        if (debug_mode) {
          chrome.runtime.sendMessage({
            message: "media_transfer_error",
            error: "Media input element not found",
          });
        }

        sendResponse({
          status: "error",
          message: "Media input element not found",
        });
      }
    } catch (error) {
      console.error("Error processing media files:", error);

      if (debug_mode) {
        chrome.runtime.sendMessage({
          message: "media_transfer_error",
          error: error.toString(),
        });
      }

      sendResponse({
        status: "error",
        message: error.toString(),
      });
    }
  }
});

// Also keep prepare_for_file_transfer handler as fallback
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "prepare_for_file_transfer") {
    sendResponse(true); // Immediately respond to prevent connection errors
  }
});

// This function will be called when the start sending process initiates
async function handleMediaSending() {
  const mediaInput = document.getElementById("mediaInput");
  if (!mediaInput || !mediaInput.files || mediaInput.files.length === 0) {
    console.log("No media files to send");
    return false;
  }

  console.log("Media files ready for sending:", mediaInput.files.length);
  return true;
}

//////////////////////////////////////////////////////////////////////
// Elements Listeners

// return selected attachments as string to show it on UI
mediaInput.addEventListener("input", () => {
  let files = "";
  Array.from(mediaInput.files).forEach((file) => {
    files += file.name + ", ";
  });
  chrome.runtime.sendMessage({
    message: "choosed media",
    data: files.slice(0, -2),
  });
});

//////////////////////////////////////////////////////////////////////
// Functions  ////////////////

// Check If Data Exists in Storage and Returns it
async function fetchStorage(key) {
  let data = await chrome.storage.local.get(key);
  if (data[key]) {
    return data[key];
  }
  return null;
}

async function checkSubscription() {
  const authUser = await fetchStorage("authUser");
  const subscription = await fetchStorage("subscription");

  if (!authUser || !authUser.token) {
    console.log("User not authenticated");
    return { canSend: false, isPremium: false };
  }

  // If we have cached subscription data, check if it's fresh (less than 5 minutes old)
  if (subscription && subscription.lastChecked) {
    const fiveMinutesAgo = Date.now() - 5 * 60 * 1000;
    if (new Date(subscription.lastChecked).getTime() > fiveMinutesAgo) {
      // Check if subscription has expired locally
      if (subscription.status === "active" && subscription.expiry) {
        const now = new Date();
        const expiryDate = new Date(subscription.expiry);
        if (now > expiryDate) {
          // Subscription has expired, force refresh from server
          console.log("Cached subscription is expired, refreshing from server");
        } else {
          // Still valid, use cached data
          const isPremium = subscription.status === "active";
          const canSend =
            isPremium || subscription.messagesSent < subscription.messagesLimit;
          return { canSend, isPremium };
        }
      } else {
        // Not active subscription, use cached data
        const isPremium = false;
        const canSend = subscription.messagesSent < subscription.messagesLimit;
        return { canSend, isPremium };
      }
    }
  }

  // Fetch fresh data from the server
  try {
    const response = await fetch(`${API_URL}/paystack/user-subscription`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      if (response.status === 401) {
        console.error("Authentication failed - token may be expired");
        await chrome.storage.local.remove("authUser");
        checkAuthStatus();
        return { canSend: false, isPremium: false };
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    const data = await response.json();

    if (data.success) {
      const isPremium = data.data.subscriptionStatus === "active";
      const canSend =
        isPremium || data.data.messagesSent < data.data.messagesLimit;

      // Cache the subscription data with timestamp
      await chrome.storage.local.set({
        subscription: {
          status: data.data.subscriptionStatus,
          messagesSent: data.data.messagesSent || 0,
          messagesLimit:
            data.data.messagesLimit === "unlimited"
              ? -1
              : data.data.messagesLimit || 200,
          expiry: data.data.subscriptionExpiry,
          lastChecked: new Date().toISOString(),
        },
      });

      return { canSend, isPremium };
    }

    return { canSend: false, isPremium: false };
  } catch (error) {
    console.error("Error checking subscription:", error);

    // If we have cached data, use it even if stale
    if (subscription) {
      const isPremium = subscription.status === "active";
      const canSend =
        isPremium || subscription.messagesSent < subscription.messagesLimit;
      return { canSend, isPremium };
    }

    return { canSend: true, isPremium: false };
  }
}

// Function to increment message count on the server
async function incrementMessageCount() {
  const authUser = await fetchStorage("authUser");
  const subscription = await fetchStorage("subscription");

  // No need to increment for premium users
  if (subscription && subscription.status === "active") {
    return true;
  }

  if (!authUser || !authUser.token) {
    console.log("User not authenticated");
    return false;
  }

  try {
    const response = await fetch(`${API_URL}/paystack/increment-message`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to increment message count");
    }

    const data = await response.json();

    if (data.success) {
      // Update local storage
      const subscription = (await fetchStorage("subscription")) || {};
      subscription.messagesSent = data.data.messagesSent;
      await chrome.storage.local.set({ subscription });
      return true;
    }

    return false;
  } catch (error) {
    console.error("Error incrementing message count:", error);
    if (debug_mode) {
      chrome.runtime.sendMessage({
        message: "api_error",
        error: "Message count update failed: " + error.message,
      });
    }
    return false;
  }
}

// Sending Process
async function startSending() {
  // First check subscription status
  const { canSend, isPremium } = await checkSubscription();

  if (!canSend) {
    chrome.runtime.sendMessage({
      message: "Message limit reached",
      type: "limit",
    });
    return;
  }

  let sheetData = await fetchStorage("sheetData");
  let sendingOrder = await fetchStorage("sendingOrder");
  let messageContent = await fetchStorage("messageContent");
  let limiterObj = await fetchStorage("messagesLimit");
  let messagesLimit = parseInt(limiterObj.messages);
  let minutesLimit = parseInt(limiterObj.minutes);
  let randomDelay = await fetchStorage("delay");
  let minDelay = parseInt(randomDelay.min);
  let maxDelay = parseInt(randomDelay.max);
  let i = 0;
  let sent = 0;
  // CHANGE APP STATE TO START
  chrome.runtime.sendMessage({ message: "started sending" });
  // WAIT FOR WHATSAPP TO LOAD
  await wa.isElementVisible(wa.textInput, 1000);

  // Get numbers from textarea if available
  let numbersTextarea = document.getElementById("numbersTextarea");
  let numbersToProcess = [];

  if (numbersTextarea && numbersTextarea.value.trim() !== "") {
    // Parse comma-separated numbers from textarea
    numbersToProcess = numbersTextarea.value
      .split(",")
      .map((num) => num.trim())
      .filter(Boolean);
    console.log("Using numbers from textarea:", numbersToProcess);
  } else if (sheetData && sheetData.length > 0) {
    // Use numbers from Excel sheet
    console.log("Using numbers from Excel sheet");
    numbersToProcess = sheetData;
  } else {
    // No numbers found
    chrome.runtime.sendMessage({
      message: "No numbers found to send messages to",
    });
    return;
  }

  // SENDING LOOP START

  // Store the original files if media is selected
  let originalMediaFiles = null;
  const mediaInput = document.getElementById("mediaInput");
  if (mediaInput && mediaInput.files && mediaInput.files.length > 0) {
    // Create a copy of the files
    const dataTransfer = new DataTransfer();
    for (let i = 0; i < mediaInput.files.length; i++) {
      dataTransfer.items.add(mediaInput.files[i]);
    }
    originalMediaFiles = dataTransfer.files;
  }

  for (i; i < numbersToProcess.length; i++) {
    // STOP BTN CLICK CHECK
    if (await fetchStorage("pendingStop")) {
      chrome.runtime.sendMessage({ message: "stopped sending" });
      break;
    }
    // MESSAGES LIMIT
    if (sent >= messagesLimit) {
      sent = 0; // reset sent
      let delayMillieseconds = minutesLimit * 60000;
      chrome.runtime.sendMessage({
        message: "limit reached",
        delay: delayMillieseconds,
      });
      await delay(delayMillieseconds);
    }

    // Process number based on source
    let name, phone, rowObj;

    if (typeof numbersToProcess[i] === "string") {
      // It's from textarea
      phone = numbersToProcess[i];
      name = ""; // No name for numbers from textarea
    } else {
      // It's from Excel sheet
      rowObj = numbersToProcess[i];
      let columnA_checked = await fetchStorage("column");
      name = columnA_checked === "a" ? rowObj.row[1] : rowObj.row[0];
      phone = columnA_checked === "a" ? rowObj.row[0] : rowObj.row[1];
      // SKIP "not found" NUMBERS AND "sent" NUMBERS AND CURRENT CONTACT
      if (
        rowObj.state === NOTFOUND_STATE ||
        rowObj.state === SENT_STATE ||
        rowObj.state === NOCODE_STATE
      ) {
        continue;
      }
    }

    // SAVING CURRENT CONTACT TO STORAGE
    await chrome.storage.local.set({
      currentContact: {
        name: name,
        phone: phone,
      },
    });

    // ADDING CONTACT NAME TO MESSAGE CONTENT
    let message;
    if (name) {
      message = messageContent.replace(/{name}/g, name);
    } else {
      message = messageContent.replace(/{name}/g, "");
    }

    // OPEN CHAT
    await wa.openChat(phone);
    await delay(2000);
    // CHECK IF CHAT OPENED
    let isOpened = await wa.isChatOpened();
    if (isOpened === true) {
      // STOP BTN CLICK CHECK
      if (await fetchStorage("pendingStop")) {
        chrome.runtime.sendMessage({ message: "stopped sending" });
        break;
      }

      // Re-check subscription status for each message to ensure we're under limits
      const currentSubscription = await checkSubscription();
      if (!currentSubscription.canSend) {
        chrome.runtime.sendMessage({
          message: "Message limit reached during sending",
          type: "limit",
        });
        break;
      }

      // CHECK SENDING ORDER and handle accordingly
      if (sendingOrder === "textFirst") {
        // SEND TEXT FIRST
        if (!debug_mode) {
          let messageSent = false;

          // Send text only if message is not empty
          if (message && message.trim() !== "") {
            const textSent = await wa.sendText(message);
            if (textSent) {
              messageSent = true;
              // Wait for text to be sent
              await delay(2000);
            }
          }

          // SEND MEDIA (for premium users or if text was sent but we want to send media too)
          if (isPremium) {
            const mediaInput = document.getElementById("mediaInput");
            if (mediaInput && originalMediaFiles) {
              // Restore the files before each send
              mediaInput.files = originalMediaFiles;
            }
            if (mediaInput && mediaInput.files && mediaInput.files.length > 0) {
              // Ensure WhatsApp is ready for media
              await ensureWhatsAppReady();

              // Check file type to determine which send method to use
              const fileType = mediaInput.files[0].type;
              console.log("File type:", fileType);

              if (
                fileType.startsWith("image/") ||
                fileType.startsWith("video/")
              ) {
                console.log("Sending image/video after text...");
                const mediaSent = await wa.sendImage(mediaInput);
                if (mediaSent && !messageSent) {
                  messageSent = true;
                }
              } else {
                console.log("Sending document after text...");
                const mediaSent = await wa.sendDocument(mediaInput);
                if (mediaSent && !messageSent) {
                  messageSent = true;
                }
              }
            }
          }

          // Only increment message count once per contact
          if (messageSent) {
            await incrementMessageCount();
            sent++; // Increment sent counter
          }

          // Set is_sent based on whether anything was sent
          is_sent = messageSent;
        }
      } else if (sendingOrder === "attachmentFirst") {
        if (!debug_mode) {
          let messageSent = false;

          // SEND MEDIA first (for premium users)
          if (isPremium) {
            const mediaInput = document.getElementById("mediaInput");
            if (mediaInput && originalMediaFiles) {
              // Restore the files before each send
              mediaInput.files = originalMediaFiles;
            }
            if (mediaInput && mediaInput.files && mediaInput.files.length > 0) {
              // Check file type to determine which send method to use
              const fileType = mediaInput.files[0].type;

              if (
                fileType.startsWith("image/") ||
                fileType.startsWith("video/")
              ) {
                console.log("Sending image/video before text...");
                const mediaSent = await wa.sendImage(mediaInput);
                if (mediaSent) {
                  messageSent = true;
                }
              } else {
                console.log("Sending document before text...");
                const mediaSent = await wa.sendDocument(mediaInput);
                if (mediaSent) {
                  messageSent = true;
                }
              }

              // Wait for media to be fully sent
              await delay(3000);
            }
          }

          // SEND TEXT (if exists)
          if (message && message.trim() !== "") {
            // Ensure WhatsApp is ready for text input
            await ensureWhatsAppReady();

            const textSent = await wa.sendText(message);
            if (textSent && !messageSent) {
              messageSent = true;
            }
          }

          // Only increment message count once per contact
          if (messageSent) {
            await incrementMessageCount();
            sent++; // Increment sent counter
          }

          // Set is_sent based on what was sent
          is_sent = messageSent;
        }
      } else {
        // CAPTION MODE
        if (!debug_mode) {
          let messageSent = false;

          // SEND MEDIA WITH CAPTION (Premium users) or just text
          const mediaInput = document.getElementById("mediaInput");
          if (mediaInput && originalMediaFiles) {
            // Restore the files before each send
            mediaInput.files = originalMediaFiles;
          }

          if (mediaInput && mediaInput.files && mediaInput.files.length > 0) {
            // Check file type to determine which send method to use
            const fileType = mediaInput.files[0].type;

            // Use message as caption only if it exists and user is premium
            const captionToUse =
              isPremium && message && message.trim() !== "" ? message : null;

            if (
              fileType.startsWith("image/") ||
              fileType.startsWith("video/")
            ) {
              console.log("Sending image/video with caption...");
              const mediaSent = await wa.sendImage(
                mediaInput,
                !!captionToUse,
                captionToUse
              );
              if (mediaSent) {
                messageSent = true;
              }
            } else {
              console.log("Sending document with caption...");
              const mediaSent = await wa.sendDocument(
                mediaInput,
                !!captionToUse,
                captionToUse
              );
              if (mediaSent) {
                messageSent = true;
              }
            }
          } else if (message && message.trim() !== "") {
            // No media, just send text
            const textSent = await wa.sendText(message);
            if (textSent) {
              messageSent = true;
            }
          }

          // Only increment message count once per contact
          if (messageSent) {
            await incrementMessageCount();
            sent++; // Increment sent counter
          }

          is_sent = messageSent;
        }
      }

      // UPDATE STATE
      if (rowObj) {
        rowObj.state = SENT_STATE;
      }
    } else {
      // UPDATE STATE
      if (rowObj) {
        rowObj.state = NOTFOUND_STATE;
      }
    }

    // CALC PROGRESS BAR VALUE
    let precentage =
      Math.round(((i + 1) / numbersToProcess.length) * 100) + "%";
    // SAVING TO STORAGE
    await chrome.storage.local.set({ sheetData: sheetData });
    await chrome.storage.local.set({ progressBar: precentage });
    // ADDING TO REPORT TABLE & UPDATING PROGRESS BAR
    chrome.runtime.sendMessage({
      message: "report table and progress bar",
      name: name || "N/A",
      number: phone,
      state: rowObj ? rowObj.state : isOpened ? SENT_STATE : NOTFOUND_STATE,
    });
    // RANDOM DELAY
    console.log("random delay start");
    await delay(randint(minDelay * 1000, maxDelay * 1000));
    console.log("random delay end");
  }

  // SENDING LOOP END ***
  // CHECK IF STOPPED OR FINISHED
  if (await fetchStorage("pendingStop")) {
    chrome.storage.local.set({ pendingStop: false });
  } else {
    chrome.runtime.sendMessage({ message: "finished sending successfully!" });
  }
}

async function getLoggedInWhatsApp() {
  try {
    // WAIT FOR WHATSAPP TO LOAD
    await wa.isElementVisible(wa.textInput, 1000);
    // GETTING LOGGED IN WHATSAPP NUMBER
    let sender_number = "Unknown";
    if (window.localStorage.getItem("last-wid")) {
      let data = window.localStorage.getItem("last-wid");
      sender_number = data.split("@")[0].substring(1);
    } else if (window.localStorage.getItem("last-wid-md")) {
      let data = window.localStorage.getItem("last-wid-md");
      sender_number = data.split(":")[0].substring(1);
    } else {
      console.warn("Could not find WhatsApp ID in localStorage");
    }
    return sender_number;
  } catch (error) {
    console.error("Error getting WhatsApp number:", error);
    return "Unknown";
  }
}

async function delay(t = Number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

async function ensureWhatsAppReady() {
  // Wait for any modals or overlays to disappear
  await delay(1000);

  // Check if there's an attachment preview modal open and close it
  const closeButtons = document.querySelectorAll(
    '[data-testid="x-viewer"] button, [aria-label="Close"], [data-icon="x"]'
  );
  for (const btn of closeButtons) {
    if (btn && btn.offsetParent !== null) {
      // Check if visible
      btn.click();
      await delay(500);
    }
  }

  // Click outside any open modals to ensure they close
  const backdrop = document.querySelector(
    '.overlay, [data-testid="popup-backdrop"]'
  );
  if (backdrop) {
    backdrop.click();
    await delay(500);
  }

  // Ensure the main text input is available and focused
  await wa.isElementVisible(wa.textInput, 1000);

  // Find and focus the text input
  const textInput = document.querySelector(
    '[contenteditable="true"][data-tab="10"]'
  );
  if (textInput) {
    textInput.click();
    textInput.focus();
    await delay(500);
  }
}
//////////////////////////////////////////////////////////////////////
