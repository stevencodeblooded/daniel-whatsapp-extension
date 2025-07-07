// file name => whatsapp.js
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
      '[data-icon="attach-menu-plus"]',
    ];
    this.sendButton = 'button[aria-label="Send"]';
    this.imageInput =
      'input[type="file"][accept*="image/*,video/mp4"], input[type="file"][accept*="image"]';
    this.documentInput = 'input[type="file"][accept="*"]';
    this.textInput = '[contenteditable="true"]';
  }

  sendDocument(extensionInput, withCaption = false, message = null) {
    return new Promise((resolve) => {
      // Blocked Contact Check
      let blockedcheck = document.querySelector(
        'div[data-testid="block-message"]'
      );
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
      clipBtn.click();

      setTimeout(() => {
        // Try to find document button
        const docSelectors = [
          'li[data-animate-dropdown-item="true"]:has(span:contains("Document"))',
          'li[role="button"]:has(svg path[fill*="attachment-type-documents-color"])',
          'li[data-animate-dropdown-item="true"]:nth-child(2)',
          'div:has(span:contains("Document"))',
        ];

        let docButton = null;
        for (const selector of docSelectors) {
          try {
            const elements = document.querySelectorAll(selector);
            if (elements.length > 0) {
              docButton = elements[0];
              break;
            }
          } catch (e) {
            console.log(`Error with selector ${selector}:`, e);
          }
        }

        if (!docButton) {
          const allDropdownItems = document.querySelectorAll(
            'li[data-animate-dropdown-item="true"]'
          );
          for (const item of allDropdownItems) {
            if (item.textContent && item.textContent.includes("Document")) {
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

        setTimeout(() => {
          let fileInput = document.querySelector(this.documentInput);

          if (!fileInput) {
            fileInput = document.querySelector(
              'input[type="file"][accept="*"]'
            );
          }

          if (!fileInput) {
            console.error("Document input element not found");
            resolve(false);
            return;
          }

          console.log(
            "Setting files and dispatching change event for document"
          );

          try {
            fileInput.files = extensionInput.files;
            fileInput.dispatchEvent(new Event("change", { bubbles: true }));

            setTimeout(() => {
              if (withCaption) {
                console.log("Sending with caption");
                this.sendText(message, true).then(() => resolve(true));
              } else {
                let sendBtn = document.querySelector(this.sendButton);
                if (!sendBtn) {
                  sendBtn = document.querySelector(
                    'div[role="button"][aria-label="Send"]'
                  );
                }
                if (!sendBtn) {
                  sendBtn = document
                    .querySelector('[data-icon="send"]')
                    ?.closest('[role="button"]');
                }

                if (!sendBtn) {
                  console.error("Send button not found");
                  resolve(false);
                  return;
                }

                console.log("Clicking send button");
                sendBtn.click();

                // Wait for document to be sent and UI to reset
                setTimeout(() => {
                  // Close any preview modals
                  const closeButtons = document.querySelectorAll(
                    '[data-icon="x"], [aria-label="Close"]'
                  );
                  closeButtons.forEach((btn) => {
                    if (btn.offsetParent !== null) {
                      btn.click();
                    }
                  });
                  resolve(true);
                }, 2000);
              }
            }, 3000);
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
        // Find the main message input more reliably
        const editableElements = document.querySelectorAll(
          '[contenteditable="true"]'
        );
        messageBox = editableElements[editableElements.length - 1];
      }

      // Add a check to ensure we found the right element
      if (!messageBox || messageBox.getAttribute("data-tab") === "10") {
        const allEditables = Array.from(
          document.querySelectorAll('[contenteditable="true"]')
        );
        messageBox =
          allEditables.find(
            (el) =>
              !el.closest('[data-testid="conversation-compose-box-input"]') ===
              false
          ) || allEditables[allEditables.length - 1];
      }

      if (messageBox) {
        // Focus the element first
        messageBox.focus();
        messageBox.click();

        // Wait a moment for focus to be established
        setTimeout(() => {
          try {
            // Clear any existing content
            messageBox.innerHTML = "";

            // Create a text node with the full message content
            // This preserves emojis properly
            const textNode = document.createTextNode(message);
            messageBox.appendChild(textNode);

            // Move cursor to the end
            const selection = window.getSelection();
            const range = document.createRange();
            range.selectNodeContents(messageBox);
            range.collapse(false);
            selection.removeAllRanges();
            selection.addRange(range);

            // Trigger input events for WhatsApp to recognize the content
            messageBox.dispatchEvent(new Event("input", { bubbles: true }));
            messageBox.dispatchEvent(
              new InputEvent("input", {
                inputType: "insertText",
                data: message,
                bubbles: true,
                cancelable: true,
              })
            );

            // Force WhatsApp to update its internal state
            const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
              window.HTMLElement.prototype,
              "textContent"
            );
            if (nativeInputValueSetter && nativeInputValueSetter.set) {
              nativeInputValueSetter.set.call(messageBox, message);
            }
          } catch (error) {
            console.error("Error setting message:", error);
            resolve(false);
            return;
          }

          // Wait for WhatsApp to process the input
          setTimeout(() => {
            // Find and click the send button
            let sendBtn = document.querySelector(this.sendButton);

            if (!sendBtn) {
              sendBtn = document.querySelector(
                'div[role="button"][aria-label="Send"]'
              );
            }

            if (!sendBtn) {
              sendBtn = document
                .querySelector('[data-icon="send"]')
                ?.closest('[role="button"]');
            }

            if (!sendBtn) {
              sendBtn = document.querySelector(
                '[data-testid="send"], [data-icon="send"], button[aria-label*="Send"]'
              );
            }

            if (!sendBtn) {
              const buttons = document.querySelectorAll(
                'button[role="button"], div[role="button"]'
              );
              for (const btn of buttons) {
                if (
                  btn.querySelector('[data-icon="send"]') ||
                  btn.getAttribute("aria-label")?.toLowerCase().includes("send")
                ) {
                  sendBtn = btn;
                  break;
                }
              }
            }

            if (!sendBtn) {
              console.error("Send button not found with any selector");
              resolve(false);
              return;
            }

            console.log(
              "Clicking send button for",
              asCaption ? "caption" : "regular text"
            );

            // Click the send button only once
            sendBtn.click();

            // Wait a bit to ensure the message is sent before resolving
            setTimeout(() => {
              resolve(true);
            }, 1000);
          }, 1500);
        }, 300);
      } else {
        console.error("Message box not found");
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
      let blockedcheck = document.querySelector(
        'div[data-testid="block-message"]'
      );
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
      clipBtn.click();

      setTimeout(() => {
        let fileInput = document.querySelector(
          'input[accept*="image/*,video/mp4"][type="file"]'
        );

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
                // Wait for the send button to appear after image preview loads
                setTimeout(() => {
                  let sendBtn = document.querySelector(this.sendButton);
                  if (!sendBtn) {
                    sendBtn = document.querySelector(
                      'div[role="button"][aria-label="Send"]'
                    );
                  }
                  if (!sendBtn) {
                    sendBtn = document
                      .querySelector('[data-icon="send"]')
                      ?.closest('[role="button"]');
                  }

                  if (!sendBtn) {
                    console.error("Send button not found");
                    resolve(false);
                    return;
                  }

                  console.log("Clicking send button");
                  sendBtn.click();

                  // Wait for the media to be sent and UI to reset
                  setTimeout(() => {
                    // Close any media preview that might still be open
                    const closeButtons = document.querySelectorAll(
                      '[data-icon="x"], [aria-label="Close"]'
                    );
                    closeButtons.forEach((btn) => {
                      if (btn.offsetParent !== null) {
                        btn.click();
                      }
                    });
                    resolve(true);
                  }, 2000);
                }, 2000);
              }
            }, 2000);
            return;
          } catch (err) {
            console.error("Error setting files directly:", err);
            resolve(false);
          }
        } else {
          console.error("File input not found");
          resolve(false);
        }
      }, 1500);
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
