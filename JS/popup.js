/*
--Storage Structure--
    sheetData: [{row:[], state:""}]
    sheetFileName: ""
    messageContent: ""
    column: "a" or "b"
    windowID: number
    messagesLimit: {messages:"number", minutes:"number"}
    sendingOrder: "textFirst" OR "attachmentFirst" OR "caption"
    delay: {min: "number", max: "number"}
    progressBar: ""
    state: "stopped" or "working"
    pendingStop: true or false
    senderNumber: ""
    freeMessages: {remaining: "number", max: "number"}
    userid: ""
    key: ""
    isKeyActivated: {status: boolean, expire: "Date"}
    currentContact: {name: "", phone: ""}
    authUser: {name: "", email: "", token: ""}
*/
let wa_interval;
const SENT_STATE = "Message Sent!";
const NOTFOUND_STATE = "No WhatsApp";
const NOCODE_STATE = "No Country Code";
const BLOCKED_STATE = "Blocked Contact";
const IDLE_STATE = "---";
const APP_NAME = "SwiftMsg";
// const API_URL = "http://swiftmsg.southafricanorth.cloudapp.azure.com/api";
const API_URL = "http://localhost:80/api";

const upgradeToPremiumBtn = document.getElementById("upgradeToPremium");
const subscriptionBadge = document.getElementById("subscriptionBadge");
const attachmentLock = document.getElementById("attachmentLock");
const freeMessagesContainer = document.getElementById("freeMessages");
const paystackModal = new bootstrap.Modal(
  document.getElementById("paystackModal")
);
const payWithPaystackBtn = document.getElementById("payWithPaystack");

// Payment verification with Paystack
const verifyPaymentModal = new bootstrap.Modal(
  document.getElementById("verifyPaymentModal")
);
const verifyPaymentForm = document.getElementById("verifyPaymentForm");
const verifyPaymentBtn = document.getElementById("verifyPaymentBtn");
const paymentReference = document.getElementById("paymentReference");
const verifyPaymentError = document.getElementById("verifyPaymentError");
const verifyPaymentSuccess = document.getElementById("verifyPaymentSuccess");

// Form elements
const loginForm = document.getElementById("loginForm");
const registerForm = document.getElementById("registerForm");
const loginError = document.getElementById("loginError");
const registerError = document.getElementById("registerError");
const logoutBtn = document.getElementById("logoutBtn");
const userInfo = document.getElementById("userInfo");
const username = document.getElementById("username");
// Modal
const authModal = new bootstrap.Modal(document.getElementById("authModal"));
// Other elements
const excelInput = document.getElementById("excel-sheet");
const mediaBtn = document.getElementById("mediaBtn");
const sendingBtn = document.getElementById("sendBtn");
const clearBtn = document.getElementById("clearBtn");
const prgoressBar = document.getElementById("progressBar");
const messageBox = document.getElementById("messagebox");
const numbersColumns = document.getElementById("numbersColumns");
const excelBtn = document.getElementById("excelBtn");
const excelFileName = document.getElementById("sheetFileName");
const mediaFileName = document.getElementById("mediaView");
const radioColA = document.getElementById("col_a");
const radioColB = document.getElementById("col_b");
const messagesInputRange = document.getElementById("messagesRange");
const messagesBadge = document.getElementById("messagesBadge");
const minutesInput = document.getElementById("minutes");
const progressBar = document.getElementById("progressBar");
const sendingOrderRadio = document.getElementById("sendingOrder");
const reportTab = document.getElementById("report-tab");
const addName = document.getElementById("addName");
const freeMessages = document.querySelector("#freeMessages #remaining");
const freeMessages_max = document.querySelector("#freeMessages #max");
const minDelay = document.getElementById("minDelay");
const maxDelay = document.getElementById("maxDelay");

// Add a "Verify Payment" button to your payment modal
const showVerifyPaymentBtn = document.createElement("button");
showVerifyPaymentBtn.className = "btn btn-info mt-2 w-100";
showVerifyPaymentBtn.textContent = "Already Paid? Verify Payment";
showVerifyPaymentBtn.addEventListener("click", () => {
  paystackModal.hide();
  verifyPaymentModal.show();
});
document
  .querySelector("#paystackModal .modal-body")
  .appendChild(document.createElement("hr"));
document
  .querySelector("#paystackModal .modal-body")
  .appendChild(showVerifyPaymentBtn);

// onstart updating UI with storage data
window.addEventListener("load", async () => {
  // Check authentication status
  await checkAuthStatus();

  updateUI();

  // INITIALIZE "isKeyActivated" VALUE TO FALSE ; TO KEEP CHECKING THE API ON EVERY APP START

  // RELOADING WHATSAPP
  let webTab = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (webTab[0]) {
    chrome.tabs.update(webTab[0].id, { active: true });
    let state = await fetchStorage("state");
    if (state !== "working") {
      chrome.tabs.reload(webTab[0].id);
    }
  }

  updateMessageCountDisplay();

  // Set up listener for numbers textarea to save input
  const numbersTextarea = document.getElementById("numbersTextarea");
  if (numbersTextarea) {
    // Load saved numbers if available
    const savedNumbers = await fetchStorage("numbersTextarea");
    if (savedNumbers) {
      numbersTextarea.value = savedNumbers;
    }

    // Save numbers when changed
    numbersTextarea.addEventListener("change", () => {
      chrome.storage.local.set({ numbersTextarea: numbersTextarea.value });
    });
  }
});

// This handles showing/hiding premium features based on subscription status
async function updateSubscriptionUI() {
  const authUser = await fetchStorage("authUser");

  if (!authUser || !authUser.token) {
    return;
  }

  try {
    // Fetch user subscription status
    const response = await fetch(`${API_URL}/paystack/user-subscription`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to fetch subscription status");
    }

    const data = await response.json();
    console.log("Subscription response:", data);

    // Define isPremium variable based on the API response
    const isPremium =
      data.success &&
      (data.data.subscriptionStatus === "active" ||
        data.data.messagesLimit === "unlimited" ||
        data.data.messagesLimit === -1);

    console.log("User premium status:", isPremium);

    // Update subscription badge
    if (subscriptionBadge) {
      subscriptionBadge.textContent = isPremium ? "Premium" : "Free";
      subscriptionBadge.className = isPremium
        ? "badge bg-success me-2"
        : "badge bg-secondary me-2";
    }

    if (isPremium) {
      // Hide for premium users
      if (attachmentLock) {
        attachmentLock.style.display = "none";
      }
    } else {
      // Show for free users
      if (attachmentLock) {
        attachmentLock.style.display = "inline";
      }
    }

    // When saving subscription data to storage
    await chrome.storage.local.set({
      subscription: {
        status: data.data.subscriptionStatus || "free",
        messagesSent:
          typeof data.data.messagesSent === "number" &&
          data.data.messagesSent < 1000000
            ? data.data.messagesSent
            : 0,
        messagesLimit: isPremium
          ? "unlimited"
          : typeof data.data.messagesLimit === "number" &&
            data.data.messagesLimit < 1000000
          ? data.data.messagesLimit
          : 200,
        expiry: data.data.subscriptionExpiry || null,
      },
    });

    // Update UI elements based on subscription status
    updateMessageCountDisplay();
    updateUpgradeButtonVisibility();
  } catch (error) {
    console.error("Error fetching subscription:", error);
    // Default to free tier on error
    await chrome.storage.local.set({
      subscription: {
        status: "free",
        messagesSent: 0,
        messagesLimit: 200,
        expiry: null,
      },
    });

    updateMessageCountDisplay();
  }
}

function getMessageDisplay(subscription) {
  if (!subscription) return { remaining: "0", max: "200" };

  // Check more thoroughly if user is premium
  const isPremium =
    subscription &&
    (subscription.status === "active" ||
      subscription.messagesLimit === "unlimited" ||
      subscription.messagesLimit === -1);

  if (isPremium) {
    // For premium users, just return "Unlimited" without repeating it
    return { remaining: "Unlimited", max: "" };
  } else {
    // For free users, ensure we use numeric values with proper max of 200
    const max =
      subscription && typeof subscription.messagesLimit === "number"
        ? subscription.messagesLimit
        : 200;
    const used =
      subscription && typeof subscription.messagesSent === "number"
        ? subscription.messagesSent
        : 0;
    const remaining = Math.max(0, max - used);
    return { remaining: remaining.toString(), max: max.toString() };
  }
}


function updateMessageCountDisplay() {
  chrome.storage.local.get("subscription", async (result) => {
    const subscription = result.subscription;
    console.log("Current subscription data:", subscription);

    // Get the elements
    const freeMessagesContainer = document.getElementById("freeMessages");
    if (!freeMessagesContainer) return; // Exit if container doesn't exist

    const textContainer = freeMessagesContainer.querySelector(".text-center");
    if (!textContainer) return; // Exit if text container doesn't exist

    // Strict check for premium status
    const isPremium =
      subscription &&
      (subscription.status === "active" ||
        subscription.messagesLimit === "unlimited" ||
        subscription.messagesLimit === -1);

    console.log("Is premium user:", isPremium);

    if (isPremium) {
      // For premium users, display "Unlimited messages" and hide container
      textContainer.innerHTML =
        "<strong>Messages:</strong> Unlimited messages this month";
      freeMessagesContainer.style.display = "none"; // Hide for premium users
    } else {
      // For free users, carefully format the numbers
      const messagesLimit =
        subscription &&
        typeof subscription.messagesLimit === "number" &&
        subscription.messagesLimit < 1000000
          ? subscription.messagesLimit
          : 200; // Default to 200 for free tier or invalid values

      const messagesSent =
        subscription &&
        typeof subscription.messagesSent === "number" &&
        subscription.messagesSent < 1000000
          ? subscription.messagesSent
          : 0;

      const remaining = Math.max(0, messagesLimit - messagesSent);

      // Set the HTML directly to ensure proper formatting
      textContainer.innerHTML = `<strong>Messages:</strong> ${remaining}/${messagesLimit} this month`;

      // Make sure the container is visible for free users
      freeMessagesContainer.style.display = "flex";
    }
  });
}

function updateUpgradeButtonVisibility() {
  chrome.storage.local.get("subscription", async (result) => {
    const subscription = result.subscription;

    // Check if user is premium
    const isPremium =
      subscription &&
      (subscription.status === "active" ||
        subscription.messagesLimit === "unlimited" ||
        subscription.messagesLimit === -1);

    // Get all upgrade buttons
    const upgradeButtons = [
      document.getElementById("mainUpgradeToPremium"),
      document.getElementById("upgradeToPremium"),
      // Any other upgrade buttons you have
    ];

    // Hide/show buttons based on subscription status
    upgradeButtons.forEach((button) => {
      if (button) {
        button.style.display = isPremium ? "none" : "block";
      }
    });

    // Also hide the premium container if needed
    const premiumContainer = document.getElementById("premiumUpgradeContainer");
    if (premiumContainer) {
      premiumContainer.style.display = isPremium ? "none" : "block";
    }
  });
}

// Call this function when the UI is updated
document.addEventListener("DOMContentLoaded", function () {
  updateUpgradeButtonVisibility();
  // Call again when checking auth status
  checkAuthStatus().then(() => {
    updateUpgradeButtonVisibility();
  });
});

// Add this function to check if user can send messages
async function canSendMessage() {
  const authUser = await fetchStorage("authUser");
  const subscription = await fetchStorage("subscription");

  if (!authUser || !authUser.token) {
    return false;
  }

  // Premium users can always send
  if (subscription && subscription.status === "active") {
    return true;
  }

  // Free users need to check limit
  try {
    const response = await fetch(`${API_URL}/paystack/check-message-limit`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
    });

    if (!response.ok) {
      throw new Error("Failed to check message limit");
    }

    const data = await response.json();

    if (data.success) {
      // Update UI - using our new function
      updateMessageCountDisplay();
      return data.data.canSendMessage;
    }

    return false;
  } catch (error) {
    console.error("Error checking message limit:", error);
    return false;
  }
}

// Add this function to increment message count
async function incrementMessageCount() {
  const authUser = await fetchStorage("authUser");
  const subscription = await fetchStorage("subscription");

  if (!authUser || !authUser.token) {
    return;
  }

  // Premium users don't need to track message count
  if (subscription && subscription.status === "active") {
    return;
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

      // Update UI
      updateMessageCountDisplay();
    }
  } catch (error) {
    console.error("Error incrementing message count:", error);
  }
}

// Add function to handle Paystack payment
async function initializePaystackPayment() {
  const authUser = await fetchStorage("authUser");

  if (!authUser || !authUser.token) {
    Swal.fire({
      title: "Authentication Required",
      text: "Please log in to upgrade to premium",
      icon: "warning",
    });
    showAuthModal();
    return;
  }

  try {
    // First, check for recent payments
    const recentPaymentCheck = await fetch(`${API_URL}/paystack/check-recent-payment`, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
    });

    const recentPaymentData = await recentPaymentCheck.json();

    if (!recentPaymentData.success) {
      // Show warning about existing subscription
      Swal.fire({
        title: "Active Subscription",
        text: recentPaymentData.message,
        icon: "warning",
        footer: `Subscription expires on: ${new Date(recentPaymentData.expiryDate).toLocaleDateString()}`
      });
      return;
    }

    // Get premium subscription ID
    const subscriptionsResponse = await fetch(`${API_URL}/subscriptions`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!subscriptionsResponse.ok) {
      throw new Error("Failed to fetch subscriptions");
    }

    const subscriptionsData = await subscriptionsResponse.json();
    console.log("Subscriptions data:", subscriptionsData);
    const premiumSubscription = subscriptionsData.content.find(
      (sub) => sub.name === "Standard Paid Tier" || sub.price === 5000 // Updated from 14.99 to 300
    );

    if (!premiumSubscription) {
      throw new Error("Premium subscription not found");
    }

    // Initialize payment
    const response = await fetch(`${API_URL}/paystack/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscriptionId: premiumSubscription._id,
        email: authUser.email,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to initialize payment");
    }

    const data = await response.json();

    // When payment is initialized, show additional instructions
    if (data.success) {
      window.open(data.data.authorization_url, "_blank");
      paystackModal.hide();

      Swal.fire({
        title: "Payment Initialized",
        html: `
        <p>Please complete your payment in the opened tab.</p>
        <p><strong>Important:</strong> After payment is complete, you'll see a reference code.</p>
        <p>Copy that code and return here to verify your payment.</p>
        <button id="swalVerifyBtn" class="btn btn-info mt-3">Verify Payment</button>
      `,
        icon: "info",
        showConfirmButton: false,
      });

      document.getElementById("swalVerifyBtn").addEventListener("click", () => {
        Swal.close();
        verifyPaymentModal.show();
      });
    }
  } catch (error) {
    console.error("Error initializing payment:", error);
    Swal.fire({
      title: "Payment Error",
      text: error.message || "Failed to initialize payment",
      icon: "error",
    });
  }
}

// Add the verification function
async function verifyPaymentReference(reference) {
  const authUser = await fetchStorage("authUser");
  if (!authUser || !authUser.token) {
    verifyPaymentError.textContent =
      "Authentication required. Please log in again.";
    verifyPaymentError.style.display = "block";
    return false;
  }
  try {
    verifyPaymentBtn.disabled = true;
    verifyPaymentBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      Verifying...
    `;
    verifyPaymentError.style.display = "none";
    const response = await fetch(`${API_URL}/paystack/manual-verify`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ reference }),
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || "Payment verification failed");
    }
    console.log("Payment verification response:", data);
    // Fetch updated user subscription details
    const subscriptionResponse = await fetch(
      `${API_URL}/paystack/user-subscription`,
      {
        method: "GET",
        headers: {
          Authorization: `Bearer ${authUser.token}`,
          "Content-Type": "application/json",
        },
      }
    );
    const subscriptionData = await subscriptionResponse.json();
    console.log("Updated subscription details:", subscriptionData);
    // Update local storage with new subscription details - properly handle unlimited
    await chrome.storage.local.set({
      subscription: {
        status: "active",
        messagesSent: 0,
        messagesLimit: "unlimited", // Store as string to avoid MAX_SAFE_INTEGER issues
        expiry: subscriptionData.data.subscriptionExpiry,
      },
    });
    // Update UI
    verifyPaymentSuccess.textContent =
      "Payment verified successfully! Your subscription is now active.";
    verifyPaymentSuccess.style.display = "block";
    // Update subscription UI
    await updateSubscriptionUI();

    // Update UI elements directly
    if (attachmentLock) {
      attachmentLock.style.display = "none";
    }

    if (subscriptionBadge) {
      subscriptionBadge.textContent = "Premium";
      subscriptionBadge.className = "badge bg-success me-2";
    }

    if (freeMessagesContainer) {
      freeMessagesContainer.style.display = "none";
    }

    // Update contact limit text
    const contactLimitEl = document.getElementById("contactLimit");
    if (contactLimitEl) {
      contactLimitEl.textContent = "Premium user: Max 1000 contacts per batch";
    }

    // Show success message
    setTimeout(() => {
      verifyPaymentModal.hide();
      Swal.fire({
        title: "Premium Activated!",
        text: "You now have unlimited messages and access to all premium features!",
        icon: "success",
      });
    }, 2000);

    return true;
  } catch (error) {
    console.error("Payment verification error:", error);
    verifyPaymentError.textContent =
      error.message || "Failed to verify payment. Please try again.";
    verifyPaymentError.style.display = "block";
    return false;
  } finally {
    verifyPaymentBtn.disabled = false;
    verifyPaymentBtn.textContent = "Verify Payment";
  }
}

// Detect payment reference in URL (for when user returns from payment page)
window.addEventListener("load", async () => {
  // DEFAULT STATE
  chrome.storage.local.set({ state: "stopped" });
  chrome.storage.local.set({ pendingStop: false });

  // GET THE LOGGED IN WHATSAPP NUMBER
  let number = await getLoggedInWhatsApp();
  chrome.storage.local.set({ senderNumber: number });
  chrome.runtime.sendMessage({ message: "got logged in whatsapp" });

  // Check for payment reference in URL (e.g., from a saved tab)
  try {
    // Get all tabs with potential payment return URLs
    const tabs = await chrome.tabs.query({
      url: "*://paystack-callback-api.vercel.app/verify-payment*",
    });

    if (tabs && tabs.length > 0) {
      const tab = tabs[0];
      const url = new URL(tab.url);
      const reference = url.searchParams.get("reference");

      if (reference) {
        console.log("Payment reference detected:", reference);

        // Show login modal if needed
        const authUser = await fetchStorage("authUser");

        if (!authUser || !authUser.token) {
          console.log("No active authentication, storing pending reference");
          showAuthModal();

          // Store reference for later
          await chrome.storage.local.set({
            pendingPaymentReference: reference,
          });

          // Show prompt to user
          Swal.fire({
            title: "Payment Reference Detected",
            text: "Please log in to verify your payment and activate premium features.",
            icon: "info",
            confirmButtonText: "Proceed to Login",
          });
        } else {
          console.log("User authenticated, attempting automatic verification");

          // Verify the payment
          verifyPaymentModal.show();
          paymentReference.value = reference;

          // Auto-submit the form after a short delay
          setTimeout(async () => {
            try {
              await verifyPaymentReference(reference);
            } catch (verificationError) {
              console.error(
                "Automatic verification failed:",
                verificationError
              );
              Swal.fire({
                title: "Verification Failed",
                text: "Could not automatically verify the payment. Please try manual verification.",
                icon: "warning",
              });
            }
          }, 1000);

          // Close the tab
          chrome.tabs.remove(tab.id);
        }
      }
    }
  } catch (error) {
    console.error("Error checking for payment reference:", error);
  }

  // Check for pending payment reference after login
  const authUser = await fetchStorage("authUser");
  const pendingRef = await fetchStorage("pendingPaymentReference");

  if (authUser && authUser.token && pendingRef) {
    console.log("Processing pending payment reference:", pendingRef);

    // Verify the pending payment
    verifyPaymentModal.show();
    paymentReference.value = pendingRef;

    // Auto-submit the form after a short delay
    setTimeout(async () => {
      try {
        await verifyPaymentReference(pendingRef);

        // Clear the pending reference if verification is successful
        await chrome.storage.local.remove("pendingPaymentReference");
      } catch (verificationError) {
        console.error(
          "Pending reference verification failed:",
          verificationError
        );
        Swal.fire({
          title: "Verification Failed",
          text: "Could not verify the pending payment. Please try again.",
          icon: "warning",
        });
      }
    }, 1000);
  }
});


verifyPaymentForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const reference = paymentReference.value.trim();

  if (!reference) {
    verifyPaymentError.textContent = "Please enter a valid payment reference";
    verifyPaymentError.style.display = "block";
    return;
  }

  try {
    const verificationResult = await verifyPaymentReference(reference);

    // If verification is successful and there's a pending reference, clear it
    const pendingRef = await fetchStorage("pendingPaymentReference");
    if (pendingRef === reference) {
      await chrome.storage.local.remove("pendingPaymentReference");
    }
  } catch (error) {
    console.error("Manual verification error:", error);
  }
});

//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////
// MESSAGE LISTENERS
//////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////

// showing selected media files on UI
// *Note: the attachment input is injected to Whatsapp web page*
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  if (request.message === "choosed media") {
    sendResponse(); // BUG FIX
    // avoiding losing focus on UI when opening file picker
    let result = await chrome.storage.local.get("windowID");
    chrome.windows.update(result.windowID, { focused: true });
    let filesText = request.data;

    // Store the actual file data, not just display text
    await chrome.storage.local.set({
      mediaFiles: request.fileData || request.data,
      mediaSelected: true,
    });

    mediaFileName.innerText =
      filesText.length > 50
        ? request.data.substring(0, 50) + " ..."
        : request.data;
  }
});

// adding to report table and updating progress bar
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  sendResponse();
  if (request.message === "report table and progress bar") {
    addToReportTable(request.name, request.number, request.state);
    let value = await fetchStorage("progressBar");
    progressBar.innerText = value;
    progressBar.dispatchEvent(new Event("change", { bubbles: true }));
  }
});

// Stopped App Loop
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  sendResponse();
  if (request.message === "stopped sending") {
    await chrome.storage.local.set({ state: "stopped" });
    sendingBtn.disabled = false;
    sendingBtn.classList.remove("btn-danger");
    sendingBtn.classList.add("btn-success");
    sendingBtn.innerText = "Start sending";
    // STOP URL INTERVAL
    clearInterval(wa_interval);
  }
});
// Started App Loop
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  sendResponse();
  if (request.message === "started sending") {
    await chrome.storage.local.set({ state: "working" });
    sendingBtn.disabled = false;
    sendingBtn.classList.remove("btn-success");
    sendingBtn.classList.add("btn-danger");
    sendingBtn.innerText = "Stop sending";
    reportTab.click();
    // Interval Check If Whatsapp Page URL Changed
    chrome.tabs.query({ url: "https://*.whatsapp.com/*" }).then((wa_tab) => {
      // Back Func
      function go_back() {
        history.back();
      }
      wa_interval = setInterval(async () => {
        let tmp = await chrome.tabs.query({ url: "https://*.whatsapp.com/*" });
        if (wa_tab[0].url !== tmp[0].url) {
          // GOING BACK TO WHATSAPP PAGE
          await chrome.scripting.executeScript({
            target: { tabId: tmp[0].id },
            func: go_back,
          });
          // SYNC CURRENT CONTACT WITH SHEET DATA
          let currentContact = await fetchStorage("currentContact");
          let sheetData = await fetchStorage("sheetData");
          let columnA_checked = await fetchStorage("column");
          for (let i = 0; i < sheetData.length; i++) {
            let rowObj = sheetData[i];
            let phone = columnA_checked === "a" ? rowObj.row[0] : rowObj.row[1];
            if (phone === currentContact.phone) {
              // UPDATE STATE TO NOT FOUND AND SAVE TO STORAGE
              sheetData[i].state = NOTFOUND_STATE;
              await chrome.storage.local.set({ sheetData: sheetData });
            }
          }
          // ADD TO REPORT TABLE
          addToReportTable(
            currentContact.name,
            currentContact.phone,
            NOTFOUND_STATE
          );
          // WAIT FOR PAGE TO LOAD
          await delay(5000);
          // START SENDING REQUEST
          chrome.tabs.sendMessage(tmp[0].id, { message: "start sending" });
          clearInterval(wa_interval);
        }
      }, 2000);
    });
  }
});

// finished sending successfully!
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  sendResponse();
  if (request.message === "finished sending successfully!") {
    await chrome.storage.local.set({ state: "stopped" });
    sendingBtn.disabled = false;
    sendingBtn.classList.remove("btn-danger");
    sendingBtn.classList.add("btn-success");
    sendingBtn.innerText = "Start sending";
    Swal.fire({
      title: "Completed",
      text: "Finished Sending Successfully 👍",
      icon: "success",
    });
  }
});

// Limit Delay Alert - Minutes Count Down
chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
  sendResponse();
  if (request.message === "limit reached") {
    let timerInterval;
    Swal.fire({
      title: "Reached Sending Limit!",
      html: "will conitnue sending in <b></b>",
      timer: request.delay,
      timerProgressBar: true,
      allowOutsideClick: false,
      didOpen: () => {
        Swal.showLoading();
        const b = Swal.getHtmlContainer().querySelector("b");
        timerInterval = setInterval(() => {
          const date = new Date(Swal.getTimerLeft());
          b.textContent = `${date.getMinutes()}:${date.getSeconds()}`;
        }, 1000);
      },
      willClose: () => {
        clearInterval(timerInterval);
      },
    });
  }
});

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
// ELEMENTS LISTENERS
//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////

// *Home Tab*
// Attachments btn clicked
mediaBtn.addEventListener("click", async () => {
  // Authentication check remains the same
  const authUser = await fetchStorage("authUser");
  if (!authUser || !authUser.token) {
    Swal.fire({
      title: "Authentication Required",
      text: "Please log in to upload media",
      icon: "warning",
    });
    showAuthModal();
    return;
  }

  // Check if user has premium subscription for media attachments
  const subscription = await fetchStorage("subscription");
  if (!subscription || subscription.status !== "active") {
    Swal.fire({
      title: "Premium Feature",
      text: "Media attachments are only available for premium users",
      icon: "info",
      showCancelButton: true,
      confirmButtonText: "Upgrade to Premium",
      cancelButtonText: "Not Now",
    }).then((result) => {
      if (result.isConfirmed) {
        paystackModal.show();
      }
    });
    return;
  }

  // Check if WhatsApp Web is loaded - keep this part
  const whatsappTabs = await chrome.tabs.query({
    url: "https://web.whatsapp.com/*",
  });
  if (!whatsappTabs || whatsappTabs.length === 0) {
    // WhatsApp not open, open it
    Swal.fire({
      title: "WhatsApp Web Required",
      text: "Please wait while we open WhatsApp Web",
      icon: "info",
      showConfirmButton: false,
    });

    await chrome.tabs.create({ url: "https://web.whatsapp.com/" });
    // Wait for WhatsApp to load and content scripts to initialize
    await delay(5000);
  }

  const tempFileInput = document.createElement("input");
  tempFileInput.type = "file";
  tempFileInput.multiple = true;
  tempFileInput.accept = "*";

  tempFileInput.addEventListener("change", async () => {
    if (tempFileInput.files.length === 0) return;

    // Add file size validation
    const VIDEO_LIMIT_MB = 64;
    const GENERAL_LIMIT_MB = 100;
    const VIDEO_LIMIT_BYTES = VIDEO_LIMIT_MB * 1024 * 1024;
    const GENERAL_LIMIT_BYTES = GENERAL_LIMIT_MB * 1024 * 1024;

    // Check for oversized files
    const oversizedFiles = [];
    Array.from(tempFileInput.files).forEach((file) => {
      const limitBytes = file.type.startsWith("video/")
        ? VIDEO_LIMIT_BYTES
        : GENERAL_LIMIT_BYTES;
      const limitMB = file.type.startsWith("video/")
        ? VIDEO_LIMIT_MB
        : GENERAL_LIMIT_MB;

      if (file.size > limitBytes) {
        oversizedFiles.push({
          name: file.name,
          size: (file.size / (1024 * 1024)).toFixed(2),
          limit: limitMB,
          type: file.type.startsWith("video/") ? "Video" : "File",
        });
      }
    });

    if (oversizedFiles.length > 0) {
      let oversizedList = "";
      oversizedFiles.forEach((file) => {
        oversizedList += `<li>${file.name} (${file.size} MB) - exceeds ${file.type} limit of ${file.limit} MB</li>`;
      });

      Swal.fire({
        title: "Files Too Large",
        html: `The following file(s) exceed WhatsApp's size limits:<br><ul>${oversizedList}</ul>`,
        icon: "error",
      });
      return;
    }

    // Continue with the existing logic for valid files
    try {
      // Convert files to base64 for transfer
      const fileDataArray = await Promise.all(
        Array.from(tempFileInput.files).map(async (file) => {
          return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => {
              resolve({
                name: file.name,
                type: file.type,
                size: file.size,
                data: reader.result,
              });
            };
            reader.onerror = () => {
              reject(new Error(`Failed to read file: ${file.name}`));
            };
            reader.readAsDataURL(file);
          });
        })
      );

      // Store only metadata in Chrome storage
      await chrome.storage.local.set({
        mediaSelected: true,
        mediaFilesMetadata: Array.from(tempFileInput.files).map((file) => ({
          name: file.name,
          type: file.type,
          size: file.size,
        })),
      });

      // Send data to content script
      const tabs = await chrome.tabs.query({
        url: "https://web.whatsapp.com/*",
      });
      if (tabs && tabs.length > 0) {
        try {
          chrome.tabs.sendMessage(tabs[0].id, {
            message: "transfer_media_files",
            fileData: fileDataArray,
          });
        } catch (error) {
          console.error("Error sending message:", error);
          Swal.fire({
            title: "Connection Error",
            text: "Could not connect to WhatsApp Web. Please make sure it's open and refresh the page.",
            icon: "error",
          });
        }
      } else {
        Swal.fire({
          title: "WhatsApp Not Found",
          text: "Please make sure WhatsApp Web is open",
          icon: "error",
        });
      }

      // Update UI with file names
      let filesText = "";
      Array.from(tempFileInput.files).forEach((file) => {
        filesText += `${file.name} (${(file.size / (1024 * 1024)).toFixed(
          2
        )} MB), `;
      });
      filesText = filesText.slice(0, -2);
      mediaFileName.innerText =
        filesText.length > 50 ? filesText.substring(0, 50) + " ..." : filesText;

      // Return focus to extension window
      let result = await chrome.storage.local.get("windowID");
      chrome.windows.update(result.windowID, { focused: true });
    } catch (error) {
      console.error("Error processing files:", error);
      Swal.fire({
        title: "File Processing Error",
        text: "There was an error processing one or more of the selected files. Please try smaller files or different file formats.",
        icon: "error",
      });
    }
  });

  tempFileInput.click();
});

//event listeners for update premium and payment
if (upgradeToPremiumBtn) {
  upgradeToPremiumBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    paystackModal.show();
  });
}

// Add this to your existing code for initializing payment
payWithPaystackBtn.addEventListener("click", async () => {
  const authUser = await fetchStorage("authUser");

  if (!authUser || !authUser.token) {
    Swal.fire({
      title: "Authentication Required",
      text: "Please log in to upgrade to premium",
      icon: "warning",
    });
    showAuthModal();
    return;
  }

  // Get premium subscription ID
  try {
    // Disable button to prevent double clicks
    payWithPaystackBtn.disabled = true;
    payWithPaystackBtn.innerHTML = `
      <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
      Initializing Payment...
    `;

    const subscriptionsResponse = await fetch(`${API_URL}/subscriptions`, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
      },
    });

    if (!subscriptionsResponse.ok) {
      throw new Error("Failed to fetch subscriptions");
    }

    const subscriptionsData = await subscriptionsResponse.json();
    const premiumSubscription = subscriptionsData.content.find(
      (sub) => sub.name === "Standard Paid Tier" || sub.price === 5000
    );

    if (!premiumSubscription) {
      throw new Error("Premium subscription not found");
    }

    // Initialize payment
    const response = await fetch(`${API_URL}/paystack/initialize`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${authUser.token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        subscriptionId: premiumSubscription._id,
        email: authUser.email,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to initialize payment");
    }

    const data = await response.json();

    // When payment is initialized, open Paystack checkout in a new tab
    if (data.success) {
      window.open(data.data.authorization_url, "_blank");
      paystackModal.hide();

      Swal.fire({
        title: "Payment Initialized",
        html: `
          <p>Please complete your payment in the opened tab.</p>
          <p><strong>Important:</strong> After payment is complete, you'll return to a confirmation page with a reference code.</p>
          <p>Copy that code if needed, but we'll try to detect it automatically.</p>
          <button id="swalVerifyBtn" class="btn btn-info mt-3">Verify Payment</button>
        `,
        icon: "info",
        showConfirmButton: false,
      });

      document.getElementById("swalVerifyBtn").addEventListener("click", () => {
        Swal.close();
        verifyPaymentModal.show();
      });
    }
  } catch (error) {
    console.error("Error initializing payment:", error);
    Swal.fire({
      title: "Payment Error",
      text: error.message || "Failed to initialize payment",
      icon: "error",
    });
  } finally {
    // Re-enable button
    payWithPaystackBtn.disabled = false;
    payWithPaystackBtn.textContent = "Pay with Paystack";
  }
});

// Excel Sheet Button Clicked
if (excelBtn) {
  excelBtn.addEventListener("click", async () => {
    // Check if user is authenticated
    const authUser = await fetchStorage("authUser");
    if (!authUser || !authUser.token) {
      Swal.fire({
        title: "Authentication Required",
        text: "Please log in to upload files",
        icon: "warning",
      });
      showAuthModal();
      return;
    }

    // Check file size limit based on subscription
    const subscription = await fetchStorage("subscription");
    const isPremium = subscription && subscription.status === "active";

    // Set the contact limit for validation when processing the file
    await chrome.storage.local.set({
      contactLimit: isPremium ? 1000 : 50,
    });

    // check if there's sheet data stored
    let sheetData = await chrome.storage.local.get("sheetData");
    if (sheetData.sheetData) {
      Swal.fire({
        title: "Sheet Data Exists",
        text: "The current sheet sending history will be removed, proceed?",
        icon: "warning",
        showCancelButton: true,
        confirmButtonColor: "#3085d6",
        cancelButtonColor: "#d33",
        confirmButtonText: "Yes, Proceed!",
      }).then((result) => {
        if (result.isConfirmed) {
          excelInput.click();
        }
      });
    } else {
      excelInput.click();
    }
  });
}
// Excel Sheet Input Changed
excelInput.addEventListener("change", async () => {
  // setting file name
  let filename = excelInput.files[0].name;
  chrome.storage.local.set({ sheetFileName: filename });
  excelFileName.innerText = filename;
  // showing columns radio buttons
  if (excelInput.files.length > 0) {
    numbersColumns.classList.remove("d-none");
  } else {
    if (!numbersColumns.classList.contains("d-none")) {
      numbersColumns.classList.add("d-none");
    }
  }
  // reset progress bar
  progressBar.innerText = "0%";
  progressBar.dispatchEvent(new Event("change", { bubbles: true }));
  // reset report table
  let tbody = document.querySelector("#reportTable tbody");
  while (tbody.hasChildNodes()) {
    tbody.removeChild(tbody.lastChild);
  }

  // Process sheet data with contact limit enforcement
  readXlsxFile(excelInput.files[0]).then(async (rowsList) => {
    let sheetData = [];
    let numbersCol = await fetchStorage("column");
    const contactLimit = (await fetchStorage("contactLimit")) || 50; // Default to free tier limit

    if (rowsList.length > contactLimit) {
      const subscription = await fetchStorage("subscription");
      const isPremium = subscription && subscription.status === "active";

      if (!isPremium) {
        Swal.fire({
          title: "Contact Limit Exceeded",
          text: `Free users can only import up to ${contactLimit} contacts at once. Upgrade to premium for up to 1000 contacts.`,
          icon: "warning",
          showCancelButton: true,
          confirmButtonText: "Upgrade to Premium",
          cancelButtonText: "Use First 50 Contacts",
        }).then((result) => {
          if (result.isConfirmed) {
            paystackModal.show();
            return;
          } else {
            // Use only the first 50 contacts
            rowsList = rowsList.slice(0, contactLimit);
          }
        });
      }
    }

    for (let i = 0; i < rowsList.length; i++) {
      let phone = numbersCol === "b" ? rowsList[i][1] : rowsList[i][0];
      // SKIP EMPTY ROWS
      if (!phone) {
        continue;
      }
      // CREATING SHEET DATA LIST
      let rowObj = {
        row: rowsList[i],
        state: IDLE_STATE,
      };
      sheetData.push(rowObj);

      // Respect the contact limit
      if (sheetData.length >= contactLimit) {
        break;
      }
    }

    // Save to storage
    chrome.storage.local.set({ sheetData: sheetData });
    // clear the input to avoid data not changing when choosing same sheet
    excelInput.files = new DataTransfer().files;
  });
});

// Message Box TextArea FocusOut
messageBox.addEventListener("change", () => {
  chrome.storage.local.set({ messageContent: messageBox.value });
});

// Clear Button Clicked
clearBtn.addEventListener("click", () => {
  Swal.fire({
    title: "Confim",
    text: "The current sending history and saved data will be removed, proceed?",
    icon: "warning",
    showCancelButton: true,
    confirmButtonColor: "#3085d6",
    cancelButtonColor: "#d33",
    confirmButtonText: "Yes, Proceed!",
  }).then((result) => {
    if (result.isConfirmed) {
      let itemsToRemove = [
        "sheetData",
        "sheetFileName",
        "messageContent",
        "progressBar",
        "numbersTextarea",
        "mediaFiles", // Add this to clear media data
        "mediaSelected", // Add this to clear media selection state
      ];
      chrome.storage.local.remove(itemsToRemove, () => {
        Swal.fire({
          title: "Data Cleared!",
          icon: "success",
          showConfirmButton: false,
          timer: 1500,
        }).then(async () => {
          chrome.tabs
            .query({ url: "https://web.whatsapp.com/*" })
            .then((tabs) => chrome.tabs.reload(tabs[0].id));
          location.reload();
        });
      });
    }
  });
});

// Sending Button Clicked
sendingBtn.addEventListener("click", async () => {
  // Check if user is authenticated
  const authUser = await fetchStorage("authUser");
  if (!authUser || !authUser.token) {
    Swal.fire({
      title: "Authentication Required",
      text: "Please log in to send messages",
      icon: "warning",
    });
    showAuthModal();
    return;
  }

  // CHECK IF CLICKED TO STOP OR START
  let appState = await fetchStorage("state");
  if (appState === "working") {
    // SEND STOP REQUEST TO APP LOOP
    await chrome.storage.local.set({ pendingStop: true });
    sendingBtn.disabled = true;
    return;
  }

  // Check if user can send messages (for free tier limits)
  const canSend = await canSendMessage();
  if (!canSend) {
    Swal.fire({
      title: "Message Limit Reached",
      text: "You've reached your free tier message limit. Upgrade to premium for unlimited messages.",
      icon: "warning",
      showCancelButton: true,
      confirmButtonText: "Upgrade to Premium",
      cancelButtonText: "Not Now",
    }).then((result) => {
      if (result.isConfirmed) {
        paystackModal.show();
      }
    });
    return;
  }

  // Check for numbers in either Excel sheet or textarea
  let sheetData = await fetchStorage("sheetData");
  let numbersTextarea = document.getElementById("numbersTextarea");
  let hasTextareaNumbers =
    numbersTextarea && numbersTextarea.value.trim() !== "";

  // If no sheet data but textarea has numbers, process them
  if (!sheetData && hasTextareaNumbers) {
    sheetData = await processTextareaNumbers();
  }

  // Only show error if both sources are empty
  if (!sheetData) {
    Swal.fire({
      title: "No Numbers Found",
      text: "Please either upload an Excel sheet or enter numbers in the text area",
      icon: "error",
    });
    return false;
  }

  // CHECK IF MESSAGE CONTENT EXISTS
  let messageContent = await fetchStorage("messageContent");
  if (!messageContent) {
    Swal.fire({
      title: "No Message Found",
      icon: "error",
    });
    return false;
  }

  // Verify if media is properly selected when sending order requires it
  const sendingOrder = (await fetchStorage("sendingOrder")) || "textFirst";
  const mediaSelected = await fetchStorage("mediaSelected");

  if (
    (sendingOrder === "attachmentFirst" || sendingOrder === "caption") &&
    !mediaSelected
  ) {
    Swal.fire({
      title: "Media Required",
      text: "Your current sending mode requires media attachments",
      icon: "warning",
    });
    return false;
  }

  // CHECK IF WHATSAPP WEB IS OPENED
  let webTab = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
  if (webTab[0]) {
    chrome.tabs.update(webTab[0].id, { active: true });
  } else {
    // OPEN WHATSAPP AND SET FOCUS BACK ON UI
    await chrome.tabs.create({ url: "https://web.whatsapp.com/" });
    // WAIT FOR WHATSAPP TO OPENS AND LOADS CONTENT SCRIPTS
    await delay(3000);
    webTab = await chrome.tabs.query({ url: "https://web.whatsapp.com/*" });
    chrome.storage.local.get("windowID", (res) => {
      chrome.windows.update(res.windowID, { focused: true });
    });
  }
  // START SENDING REQUEST
  chrome.tabs
    .sendMessage(webTab[0].id, {
      message: "start sending",
      hasMedia: !!mediaSelected,
    })
    .catch((error) => {
      Swal.fire({
        title: "WhatsApp Web Not Found!",
        icon: "error",
      });
    });
});

// Column A radion clicked
radioColA.addEventListener("click", () => {
  chrome.storage.local.set({ column: "a" });
});

// Column B radion clicked
radioColB.addEventListener("click", () => {
  chrome.storage.local.set({ column: "b" });
});

// Sync ProgressBar Label with style value
progressBar.addEventListener("change", () => {
  progressBar.style.width = progressBar.innerText;
  if (progressBar.style.width === "0%") {
    progressBar.parentElement.parentElement.classList.add("d-none");
  } else {
    progressBar.parentElement.parentElement.classList.remove("d-none");
  }
});

// Add Name Button
if (addName) {
  // Check if element exists
  addName.addEventListener("click", () => {
    messageBox.value += "{name}";
    messageBox.dispatchEvent(new Event("change", { bubbles: true }));
  });
}
// *Settings Tab*
// Messages Range Badge
messagesInputRange.addEventListener("input", () => {
  messagesBadge.innerText = messagesInputRange.value;
});

// Saving Messages limits values to storage
let elems = [messagesInputRange, minutesInput];
elems.forEach((item) => {
  item.addEventListener("change", async () => {
    await chrome.storage.local.set({
      messagesLimit: {
        messages: messagesInputRange.value,
        minutes: minutesInput.value,
      },
    });
  });
});

// Saving Sending Text Order Option to storage
sendingOrderRadio.addEventListener("change", async () => {
  if (sendingOrderRadio.querySelector("#textFirst").checked) {
    chrome.storage.local.set({ sendingOrder: "textFirst" });
  } else if (sendingOrderRadio.querySelector("#caption").checked) {
    chrome.storage.local.set({ sendingOrder: "caption" });
  } else {
    chrome.storage.local.set({ sendingOrder: "attachmentFirst" });
  }
});

// Saving Delay Settings
let delayElems = [minDelay, maxDelay];
delayElems.forEach((elem) => {
  elem.addEventListener("change", async () => {
    await chrome.storage.local.set({
      delay: {
        min: minDelay.value,
        max: maxDelay.value,
      },
    });
  });
});

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////
// Functions
//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////

function delay(t = Number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}
// Check If Data Exists in Storage and Returns it
async function fetchStorage(key = String) {
  let data = await chrome.storage.local.get(key);
  if (data[key]) {
    return data[key];
  }
}

// Process numbers from textarea and prepare for sending
async function processTextareaNumbers() {
  const numbersTextarea = document.getElementById("numbersTextarea");
  if (!numbersTextarea || numbersTextarea.value.trim() === "") {
    return null;
  }

  // Split input by commas and remove empty values
  const numbers = numbersTextarea.value
    .trim()
    .split(",")
    .map((num) => num.trim())
    .filter((num) => num !== "");

  let sheetData = [];

  // Create a row for each phone number with default name
  for (let i = 0; i < numbers.length; i++) {
    const phone = numbers[i];
    const name = "Contact " + (i + 1);

    // Create row object similar to Excel sheet structure
    const rowObj = {
      row: [name, phone],
      state: IDLE_STATE,
    };
    sheetData.push(rowObj);
  }

  // Save processed data to storage
  await chrome.storage.local.set({ sheetData: sheetData });

  // Reset progress bar
  progressBar.innerText = "0%";
  progressBar.dispatchEvent(new Event("change", { bubbles: true }));

  // Reset report table
  let tbody = document.querySelector("#reportTable tbody");
  while (tbody.hasChildNodes()) {
    tbody.removeChild(tbody.lastChild);
  }

  return sheetData;
}

// Collect UI Inputs Values
async function getSavedUIData() {
  return (UIdata = {
    sheetData: await fetchStorage("sheetData"),
    sheetFileName: await fetchStorage("sheetFileName"),
    column: await fetchStorage("column"),
    message: await fetchStorage("messageContent"),
    messagesLimit: await fetchStorage("messagesLimit"),
    sendingOrder: await fetchStorage("sendingOrder"),
    progressBar: await fetchStorage("progressBar"),
    delay: await fetchStorage("delay"),
  });
}

// Update UI Inputs with Saved Data
async function updateUI() {
  // CHECK IF APP IS WORKING
  let state = await fetchStorage("state");
  if (state === "working") {
    // CHANGE BUTTON TO STOP SENDING STATE
    sendingBtn.disabled = false;
    sendingBtn.classList.remove("btn-success");
    sendingBtn.classList.add("btn-danger");
    sendingBtn.innerText = "Stop sending";
    reportTab.click();
  }
  let dataObj = await getSavedUIData();
  // SET EXCEL FILE NAME - DEFAULTING IF NO SAVED DATA
  excelFileName.innerText = dataObj.sheetFileName
    ? dataObj.sheetFileName
    : null;
  // SET MESSAGE BOX TEXT - DEFAULTING IF NO SAVED DATA
  messageBox.value = dataObj.message ? dataObj.message : "";
  // SETTING COLUMN  - DEFAULTING TO B IF NO SAVED DATA
  if (!dataObj.column) {
    chrome.storage.local.set({ column: "b" });
  } else {
    dataObj.column === "a"
      ? (radioColA.checked = true)
      : (radioColB.checked = true);
  }
  // SET MESSAGES NUMBER - DEFAULTING IF NO SAVED DATA
  if (!dataObj.messagesLimit) {
    let elems = [messagesInputRange, minutesInput];
    elems.forEach((elem) =>
      elem.dispatchEvent(new Event("change", { bubbles: true }))
    );
  } else {
    messagesInputRange.value = dataObj.messagesLimit.messages;
    messagesInputRange.dispatchEvent(new Event("input", { bubbles: true }));
    minutesInput.value = dataObj.messagesLimit.minutes;
  }
  // SET SENDING ORDER OPTION - DEFAULTING IF NO SAVED DATA
  if (!dataObj.sendingOrder) {
    sendingOrderRadio.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    if (dataObj.sendingOrder === "textFirst") {
      document.querySelector("#textFirst").checked = true;
    } else if (dataObj.sendingOrder === "caption") {
      document.querySelector("#caption").checked = true;
    } else {
      document.querySelector("#attachmentFirst").checked = true;
    }
  }
  // SET DELAY SETTINGS - DEFAULTING IF NO SAVED DATA
  if (!dataObj.delay) {
    let delayElems = [minDelay, maxDelay];
    delayElems.forEach((elem) =>
      elem.dispatchEvent(new Event("change", { bubbles: true }))
    );
  } else {
    minDelay.value = dataObj.delay.min;
    maxDelay.value = dataObj.delay.max;
  }
  // SET PROGRESS BAR VALUE
  progressBar.innerText = dataObj.progressBar
    ? dataObj.progressBar
    : progressBar.innerText;
  progressBar.dispatchEvent(new Event("change", { bubbles: true }));
  // SHOWING COLUMNS NUMBER IF SHEET DATA FOUND
  if (dataObj.sheetData) {
    if (dataObj.sheetData.length > 0) {
      numbersColumns.classList.remove("d-none");
    } else {
      if (!numbersColumns.classList.contains("d-none")) {
        numbersColumns.classList.add("d-none");
      }
    }
  }
  // SETTING REPORT TABLE IF SHEET DATA FOUND
  if (dataObj.sheetData) {
    for (let i = 0; i < dataObj.sheetData.length; i++) {
      if (dataObj.sheetData[i].state !== IDLE_STATE) {
        let numbersCol = await fetchStorage("column");
        let name =
          numbersCol === "b"
            ? dataObj.sheetData[i].row[0]
            : dataObj.sheetData[i].row[1];
        let phone =
          numbersCol === "b"
            ? dataObj.sheetData[i].row[1]
            : dataObj.sheetData[i].row[0];
        addToReportTable(name, phone, dataObj.sheetData[i].state);
      }
    }
  }
}

// Add Row to Report Table
function addToReportTable(name, phone, status) {
  let tr = document.createElement("tr");
  if (status === SENT_STATE) {
    tr.classList.add("table-success");
  } else if (status === NOTFOUND_STATE) {
    tr.classList.add("table-danger");
  } else if (status === NOCODE_STATE) {
    tr.classList.add("table-warning");
  } else if (status === BLOCKED_STATE) {
    tr.classList.add("table-danger");
  }
  let name_td = document.createElement("td");
  name_td.innerText = name;
  let phone_td = document.createElement("td");
  phone_td.innerText = phone;
  let status_td = document.createElement("td");
  status_td.innerText = status;
  tr.appendChild(name_td);
  tr.appendChild(phone_td);
  tr.appendChild(status_td);
  document.querySelector("#reportTable tbody").appendChild(tr);
  tr.scrollIntoView({ behavior: "smooth" });
}

// Change UI For Granted Access Users

//////////////////////////////////////////////////////////////////////
//////////////////////////////////////////////////////////////////////

// Emojis Object
new EmojiPicker({
  trigger: [
    {
      selector: "#emoji",
      insertInto: "#messagebox", // If there is only one '.selector', than it can be used without array
    },
  ],
  closeButton: true,
  specialButtons: "green", // #008000, rgba(0, 128, 0);
});

// Check if user is authenticated
async function checkAuthStatus() {
  const authUser = await fetchStorage("authUser");

  // First, always remove any existing overlay to avoid duplicates
  const existingOverlay = document.querySelector(".auth-overlay");
  if (existingOverlay) {
    existingOverlay.remove();
  }

  if (!authUser || !authUser.token) {
    // User is not authenticated, show login modal
    showAuthModal();

    // Add authentication overlay
    const overlay = document.createElement("div");
    overlay.className = "auth-overlay";
    overlay.innerHTML = `
      <div class="auth-overlay-message">
        <h4>Authentication Required</h4>
        <p>Please login or register to use SwifMsg</p>
      </div>
    `;
    document.body.appendChild(overlay);

    document.getElementById("mainContent").classList.add("not-authenticated");

    return false;
  } else {
    // User is authenticated, remove blur effect
    document
      .getElementById("mainContent")
      .classList.remove("not-authenticated");

    // Show user info
    userInfo.style.display = "flex";
    username.textContent = authUser.name || authUser.email;

    // Check subscription status
    await updateSubscriptionUI();

    // Update message count and upgrade button visibility
    updateMessageCountDisplay();
    updateUpgradeButtonVisibility();

    return true;
  }
}

// Show authentication modal
function showAuthModal() {
  authModal.show();
}

// Handle login form submission
loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const email = document.getElementById("loginEmail").value;
  const password = document.getElementById("loginPassword").value;

  try {
    loginError.style.display = "none";

    const response = await fetch(`${API_URL}/auth/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ email, password }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Login failed");
    }

    // Save auth data to storage
    await chrome.storage.local.set({
      authUser: {
        email: email,
        token: data.token,
      },
    });

    // Hide modal first
    authModal.hide();

    // Force removal of modal backdrop and cleanup
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.remove();
    });
    document.body.classList.remove("modal-open");
    document.body.style.overflow = "";
    document.body.style.paddingRight = "";

    // Then update UI - do this AFTER modal is fully hidden
    await checkAuthStatus();

    // Show success message
    Swal.fire({
      title: "Login Successful",
      text: `Welcome, ${email}!`,
      icon: "success",
      timer: 2000,
      showConfirmButton: false,
    });
  } catch (error) {
    loginError.textContent = error.message;
    loginError.style.display = "block";
  }
});

// Handle registration form submission
registerForm.addEventListener("submit", async (e) => {
  e.preventDefault();

  const name = document.getElementById("registerName").value;
  const email = document.getElementById("registerEmail").value;
  const password = document.getElementById("registerPassword").value;
  const confirmPassword = document.getElementById("confirmPassword").value;

  try {
    registerError.style.display = "none";

    // Check if passwords match
    if (password !== confirmPassword) {
      throw new Error("Passwords do not match");
    }

    const response = await fetch(`${API_URL}/auth/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        name,
        email,
        password,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || "Registration failed");
    }

    // Switch to login tab
    document.getElementById("pills-login-tab").click();

    // Show success message
    Swal.fire({
      title: "Registration Successful",
      text: "You can now log in with your credentials",
      icon: "success",
    });

    // Clear registration form
    registerForm.reset();
  } catch (error) {
    registerError.textContent = error.message;
    registerError.style.display = "block";
  }
});

// Handle logout
logoutBtn.addEventListener("click", async () => {
  // Clear auth data
  await chrome.storage.local.remove("authUser");

  // Update UI
  checkAuthStatus();

  // Show message
  Swal.fire({
    title: "Logged Out",
    text: "You have been logged out successfully",
    icon: "info",
    timer: 2000,
    showConfirmButton: false,
  });
});

// Function to ensure free messages are displayed correctly
function updateFreeMessagesDisplay() {
  const freeMessagesContainer = document.getElementById("freeMessages");
  if (freeMessagesContainer) {
    // Make sure to use inline style for immediate effect
    if (freeMessagesContainer.style.display === "none") {
      freeMessagesContainer.style.display = "flex";
    }
  }
}

// Update the premium tier price in the modal
const premiumCardHtml = `
<div class="card-header bg-primary text-white">
    <h5 class="mb-0">Standard Paid Tier - 300 ZAR/month</h5>
</div>
`;

// Make sure all upgrade buttons work properly
document.addEventListener("DOMContentLoaded", function () {
  // Main upgrade button (the new one we added)
  const mainUpgradeButton = document.getElementById("mainUpgradeToPremium");
  if (mainUpgradeButton) {
    mainUpgradeButton.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      showPaystackModal();
    });
  }

  // Original upgrade buttons (keep these for backward compatibility)
  const upgradeButtons = document.querySelectorAll("[id='upgradeToPremium']");
  upgradeButtons.forEach((button) => {
    button.addEventListener("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      showPaystackModal();
    });
  });
});

function showPaystackModal() {
  // Hide any currently visible modals properly
  const visibleModals = document.querySelectorAll(".modal.show");
  visibleModals.forEach((modal) => {
    const modalInstance = bootstrap.Modal.getInstance(modal);
    if (modalInstance) {
      modalInstance.hide();
    }
  });

  // Remove any lingering backdrops after a short delay
  setTimeout(() => {
    document.querySelectorAll(".modal-backdrop").forEach((backdrop) => {
      backdrop.remove();
    });

    // Show the paystack modal
    const paystackModalEl = document.getElementById("paystackModal");
    const paystackModalInstance = new bootstrap.Modal(paystackModalEl);
    paystackModalInstance.show();
  }, 150); // Small delay to ensure previous modals are fully hidden
}
