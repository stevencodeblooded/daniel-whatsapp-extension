// In background.js, modify the configuration loading
chrome.runtime.onInstalled.addListener(() => {
    const config = {
        development: {
            // apiUrl: "http://swiftmsg.southafricanorth.cloudapp.azure.com/api",
            apiUrl: "http://localhost:80/api",
            callbackUrl: "https://paystack-callback-api.vercel.app"
        },
        production: {
            // apiUrl: "http://swiftmsg.southafricanorth.cloudapp.azure.com/api",
            apiUrl: "http://localhost:80/api",
            callbackUrl: "https://paystack-callback-api.vercel.app"
        }
    };

    const currentEnv = "production"; // Change to 'production' when deploying

    chrome.storage.local.set({ 
        appConfig: config[currentEnv] 
    }, () => {
        console.log("App configuration saved to chrome.storage");
    });
});


// Ensure modals close properly without affecting layout
document.addEventListener('DOMContentLoaded', function() {
  // Function to clean up modal effects
  function fixModalPadding() {
    document.body.classList.remove('modal-open');
    document.body.style.paddingRight = '';
    document.body.style.overflow = '';
    
    // Remove any lingering backdrops
    const backdrops = document.querySelectorAll('.modal-backdrop');
    backdrops.forEach(backdrop => backdrop.remove());
  }
  
  // Listen for modal hidden event
  const modals = document.querySelectorAll('.modal');
  modals.forEach(modal => {
    modal.addEventListener('hidden.bs.modal', function() {
      setTimeout(fixModalPadding, 100);
    });
  });
  
  // Fix padding issues when clicking outside modal to close
  document.addEventListener('click', function(e) {
    if (e.target.classList.contains('modal')) {
      setTimeout(fixModalPadding, 100);
    }
  });
});