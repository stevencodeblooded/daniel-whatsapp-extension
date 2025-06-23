// util functions START
function randint(min = Number, max = Number) {
  return Math.floor(Math.random() * (max - min)) + min;
}

function delay(t = Number) {
  return new Promise((resolve) => setTimeout(resolve, t));
}

// Returns false if number doens't have country code
function formatPhone(phone) {
  phone = phone.toString();
  let symbols = [/\-/g, /\(/g, /\)/g, / /g, /\+/g, /\:/g];
  symbols.forEach((sym) => {
    phone = phone.replace(sym, "");
  });
  while (phone[0] === "0") {
    phone = phone.replace("0", "");
  }
  return phone;
}
// util functions END

// check for element appearance every {delay} millieseconds
class Whatsapp {
  constructor() {
    // Updated selectors with fallbacks
    this.clipButtonSelectors = [
      'button[data-tab="10"][title="Attach"]',
      'button[title="Attach"]',
      'span[data-icon="plus"]',
      'button:has(span[data-icon="plus"])',
      '[data-icon="plus"]',
      '[data-icon="attach"]',
      '[data-testid="attach-clip"]',
      '[data-testid="clip"]',
      '[aria-label="Attach"]',
      '[data-icon="attach-menu-plus"]'
    ];
    this.sendButton = '[data-icon="send"]';
    this.imageInput = 'input[type="file"][accept*="image/*,video/mp4"], input[type="file"][accept*="image"]';
    this.documentInput = 'input[type="file"][accept="*"]';
    this.textInput = '[contenteditable="true"]';
  }

  sendDocument(extensionInput, withCaption = false, message = null) {
    return new Promise((resolve) => {
      // Blocked Contact Check
      let blockedcheck = document.querySelector('div[data-testid="block-message"]');
      if (blockedcheck) {
        console.error("Contact is blocked");
        resolve(false);
        return false;
      }
  
      // Find attachment button
      let clipBtn = this.findElement(this.clipButtonSelectors);
      if (!clipBtn) {
        console.error("Attachment button not found");
        resolve(false);
        return false;
      }
  
      console.log("Found attachment button, clicking...");
      // Click to open the attachment menu
      clipBtn.click();
      
      // Wait for attachment menu to appear
      setTimeout(() => {
        // Try to find document button based on inspection
        const docSelectors = [
          'li[data-animate-dropdown-item="true"]:has(span:contains("Document"))',
          'li[role="button"]:has(svg path[fill*="attachment-type-documents-color"])',
          'li[data-animate-dropdown-item="true"]:nth-child(2)',
          'div:has(span:contains("Document"))'
        ];
        
        let docButton = null;
        for (const selector of docSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            console.log(`Doc selector ${selector} found ${elements.length} elements`);
            if (elements.length > 0) {
              docButton = elements[0];
              break;
            }
          } catch (e) {
            console.log(`Error with selector ${selector}:`, e);
          }
        }
        
        // If still not found, try by text content
        if (!docButton) {
          const allDropdownItems = document.querySelectorAll('li[data-animate-dropdown-item="true"]');
          for (const item of allDropdownItems) {
            if (item.textContent && item.textContent.includes('Document')) {
              docButton = item;
              break;
            }
          }
        }
        
        if (!docButton) {
          console.error("Document upload button not found");
          resolve(false);
          return;
        }
  
        console.log("Found document button, clicking...");
        docButton.click();
        
        // Now find the file input that appears
        setTimeout(() => {
          let fileInput = document.querySelector(this.documentInput);
          
          if (!fileInput) {
            // Try more generic selector
            fileInput = document.querySelector('input[type="file"][accept="*"]');
          }
          
          if (!fileInput) {
            console.error("Document input element not found");
            resolve(false);
            return;
          }
  
          console.log("Setting files and dispatching change event for document");
          
          try {
            fileInput.files = extensionInput.files;
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
            
            setTimeout(() => {
              if (withCaption) {
                console.log("Sending with caption");
                this.sendText(message, true).then(() => resolve(true));
              } else {
                const sendBtn = document.querySelector(this.sendButton);
                if (!sendBtn) {
                  console.error("Send button not found");
                  resolve(false);
                  return;
                }
                
                console.log("Clicking send button");
                sendBtn.click();
                resolve(true);
              }
            }, 3000); // Longer delay to ensure document is processed
          } catch (error) {
            console.error("Error setting files:", error);
            resolve(false);
          }
        }, 2000);
      }, 1500);
    });
  }

  isElementVisible(selector, every) {
    return new Promise((resolve) => {
      let interval = setInterval(() => {
        let element = document.querySelector(selector);
        if (element) {
          console.log("found it!");
          clearInterval(interval);
          resolve();
        } else {
          console.log("searching....");
        }
      }, every);
    });
  }

  async clickElement(element) {
    element.dispatchEvent(
      new MouseEvent("mouseover", {
        view: window,
        bubbles: true,
        cancelable: true,
      })
    );
    await delay(randint(500, 1500));
    element.dispatchEvent(
      new MouseEvent("mousedown", {
        view: window,
        bubbles: true,
        cancelable: true,
      })
    );
    await delay(randint(10, 50));
    element.dispatchEvent(
      new MouseEvent("mouseup", {
        view: window,
        bubbles: true,
        cancelable: true,
      })
    );
    element.dispatchEvent(
      new MouseEvent("click", { view: window, bubbles: true, cancelable: true })
    );
    return new Promise((resolve) => resolve());
  }

  openChat(phone = String) {
    // for later to click on OK button if chat was not opened
    // document.querySelector('[data-animate-modal-popup="true"] div[role="button"]').click()
    return new Promise((resolve) => {
      let webApiEelem = document.getElementById("#chatOpener");
      if (!webApiEelem) {
        webApiEelem = document.createElement("a");
        webApiEelem.setAttribute("id", "chatOpener");
        document.body.appendChild(webApiEelem);
      }

      phone = formatPhone(phone);
      webApiEelem.setAttribute(
        "href",
        `https://api.whatsapp.com/send?phone=${phone}`
      );

      setTimeout(() => {
        webApiEelem.click();
        console.log("clicked api link!");
        resolve(true);
      }, randint(1000, 2500));
    });
  }

  // returns false if number is invalid
  isChatOpened() {
    return new Promise((resolve) => {
      // RANDOM DELAY
      delay(randint(1000, 2000)).then(() => {
        let interval = setInterval(() => {
          if (document.querySelector('[data-animate-modal-body="true"] svg')) {
            console.log("waiting for chat...");
          } else {
            clearInterval(interval);
            let btn = document.querySelector(
              '[data-animate-modal-popup="true"] button'
            );
            if (btn) {
              delay(1000).then(() => {
                btn.click();
                resolve(false);
                console.log("Resolved False!");
              });
            } else {
              resolve(true);
              console.log("Resolved!");
            }
          }
        }, 500);
      });
    });
  }

  // returns false if number is blocking the sender
  sendText(message, asCaption = false) {
    return new Promise((resolve) => {
      // Blocked Contact Check
      let blockedcheck = document.querySelector(
        'div[data-testid="block-message"]'
      );
      if (blockedcheck) {
        resolve(false);
        return false;
      }
      let messageBox;
      if (asCaption) {
        messageBox = document.querySelectorAll('[contenteditable="true"]')[0];
      } else {
        messageBox = document.querySelectorAll('[contenteditable="true"]')[1];
      }
      if (messageBox) {
        messageBox.dispatchEvent(
          new InputEvent("input", {
            data: message,
            bubbles: true,
            cancelable: false,
            cancelBubble: false,
            currentTarget: null,
            inputType: "insertText",
            dataTransfer: null,
            defaultPrevented: false,
            detail: 0,
            eventPhase: 0,
            isComposing: false,
            returnValue: true,
            sourceCapabilities: null,
            type: "input",
            view: null,
            which: 0,
            composed: true,
            view: window,
            detail: 1,
          })
        );
        delay(randint(1000, 2000)).then(() => {
          document.querySelector(this.sendButton).click();
          resolve(true);
        });
      } else {
        resolve(false);
      }
    });
  }

  // Helper method to find the first matching selector
  findElement(selectors) {
    if (Array.isArray(selectors)) {
      for (const selector of selectors) {
        try {
          const element = document.querySelector(selector);
          if (element) {
            console.log(`Found element with selector: ${selector}`);
            return element;
          }
        } catch (e) {
          console.log(`Error with selector ${selector}:`, e);
        }
      }
      console.error("No matching element found for selectors:", selectors);
      return null;
    }
    return document.querySelector(selectors);
  }

  sendImage(extensionInput, withCaption = false, message = null) {
    return new Promise((resolve) => {
      // Blocked Contact Check
      let blockedcheck = document.querySelector('div[data-testid="block-message"]');
      if (blockedcheck) {
        console.error("Contact is blocked");
        resolve(false);
        return false;
      }
  
      // Find attachment button
      let clipBtn = this.findElement(this.clipButtonSelectors);
      if (!clipBtn) {
        console.error("Attachment button not found");
        resolve(false);
        return false;
      }
  
      console.log("Found attachment button, clicking...");
      // Click to open the attachment menu
      clipBtn.click();
      
      // Wait for attachment menu to appear
      setTimeout(() => {
        // Updated selectors based on your inspection
        const photoSelectors = [
          'li[data-animate-dropdown-item="true"] div[role="button"]',
          'li[role="button"] div:has(svg)',
          'li[tabindex="0"][role="button"]',
          'div:has(span:contains("Photos & videos"))',
          'input[accept*="image/*,video/mp4"]',
          'input[type="file"][accept*="image/*"]'
        ];
        
        // Try direct input selector first (most reliable)
        let fileInput = document.querySelector('input[accept*="image/*,video/mp4"][type="file"]');
        
        if (fileInput) {
          console.log("Found file input directly, using it");
          try {
            fileInput.files = extensionInput.files;
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
            
            setTimeout(() => {
              if (withCaption) {
                console.log("Sending with caption");
                this.sendText(message, true).then(() => resolve(true));
              } else {
                setTimeout(() => {
                  const sendBtn = document.querySelector(this.sendButton);
                  if (sendBtn) {
                    console.log("Clicking send button");
                    sendBtn.click();
                    resolve(true);
                  } else {
                    console.error("Send button not found");
                    resolve(false);
                  }
                }, 2000);
              }
            }, 2000);
            return;
          } catch (err) {
            console.error("Error setting files directly:", err);
          }
        }
        
        // If direct input not found or failed, try to find and click the photo button
        let photoButton = null;
        
        // Based on your inspection, look for the Photos & videos list item
        photoButton = document.querySelector('li[tabindex="0"][role="button"]:has(span:contains("Photos & videos"))');
        if (!photoButton) {
          photoButton = document.querySelector('li[data-animate-dropdown-item="true"]');
        }
        
        // Fallback to more generic selectors
        if (!photoButton) {
          for (const selector of photoSelectors) {
            try {
              const elements = document.querySelectorAll(selector);
              console.log(`Selector ${selector} found ${elements.length} elements`);
              if (elements.length > 0) {
                photoButton = elements[0];
                break;
              }
            } catch (e) {
              console.log(`Error with selector ${selector}:`, e);
            }
          }
        }
        
        // If still not found, try looking for elements with "Photos" text
        if (!photoButton) {
          const allElements = document.querySelectorAll('*');
          for (const elem of allElements) {
            if (elem.textContent && 
                (elem.textContent.includes('Photos') || 
                 elem.textContent.includes('photos') || 
                 elem.textContent.includes('image'))) {
              const parent = elem.closest('[role="button"]') || elem;
              photoButton = parent;
              console.log("Found photo button by text content:", elem.textContent);
              break;
            }
          }
        }
        
        if (!photoButton) {
          console.error("Photo upload button not found");
          resolve(false);
          return;
        }
  
        console.log("Found photo button, clicking...");
        photoButton.click();
        
        // Now find the file input that appears
        setTimeout(() => {
          let fileInput = document.querySelector('input[type="file"][accept*="image/*,video/mp4"], input[type="file"][accept*="image"]');
          
          if (!fileInput) {
            console.error("File input element not found");
            resolve(false);
            return;
          }
  
          console.log("Setting files and dispatching change event");
          
          try {
            fileInput.files = extensionInput.files;
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));
            
            setTimeout(() => {
              if (withCaption) {
                console.log("Sending with caption");
                this.sendText(message, true).then(() => resolve(true));
              } else {
                const sendBtn = document.querySelector(this.sendButton);
                if (!sendBtn) {
                  console.error("Send button not found");
                  resolve(false);
                  return;
                }
                
                console.log("Clicking send button");
                sendBtn.click();
                resolve(true);
              }
            }, 3000); // Longer delay to ensure image is processed
          } catch (error) {
            console.error("Error setting files:", error);
            resolve(false);
          }
        }, 2000); // Longer delay to ensure file input is ready
      }, 1500); // Longer delay to ensure menu appears
    });
  }
}

// Inject hidden file input for media uploads
if (!document.getElementById("mediaInput")) {
  const fileInput = document.createElement("input");
  fileInput.type = "file";
  fileInput.id = "mediaInput";
  fileInput.accept = "*"; // Accept all file types
  fileInput.multiple = true;
  fileInput.style.display = "none";
  document.body.appendChild(fileInput);
}

// Handle message to open media picker
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.message === "open_media_picker") {
    const input = document.getElementById("mediaInput");
    if (input) {
      input.click();
    }
  }
});
