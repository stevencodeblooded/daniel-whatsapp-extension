////////////////////////////////////////////////////////////////
/////// Util
function randint(min = Number, max = Number) {
    return Math.floor(Math.random() * (max - min)) + min;
}
function delay(t = Number) {
    return new Promise(resolve => setTimeout(resolve, t));
}
// Check If Data Exists in Storage and Returns it
async function fetchStorage(key = String) {
    let data = await chrome.storage.local.get(key)
    if (data[key]) {
        return data[key]
    } else {
        return null
    }
}

function generateId() {
    return Math.random().toString(36).substring(2) +
        (new Date()).getTime().toString(36);
}
////////////////////////////////////////////////////////////////


// INITIALIZE USER ID IF NOT FOUND
// chrome.runtime.onInstalled.addListener(() => {
//     fetchStorage("userid")
//         .then((userid) => {
//             if (!userid) {
//                 let id = generateId()
//                 chrome.storage.local.set({ "userid": id })
//             }
//         })
// }) 


// opens pop up interface window or set focus on it if it's already opened
chrome.action.onClicked.addListener(async () => {
    // CHECK IF WHATSAPP WEB IS OPENED
    let webTab = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
    if (webTab[0]) {
        chrome.tabs.update(webTab[0].id, { active: true })
        // // CHECK IF CONTENT SCRIPT IS INJECTED
        // chrome.tabs.sendMessage(webTab[0].id, { message: "is content script injected?" }).catch((error) => {
        //     console.log("content script is not injected!.. Reloading...")
        //     chrome.tabs.reload(webTab[0].id)
        // })
    } else {
        // OPEN WHATSAPP
        await chrome.tabs.create({ url:"https://web.whatsapp.com/"})
        // WAIT FOR WHATSAPP TO OPENS AND LOADS CONTENT SCRIPTS
        await delay(3000)
        webTab = await chrome.tabs.query({ url: 'https://web.whatsapp.com/*' })
    }
    // GETTING CURRENT UI WINDOW
    let response = await chrome.storage.local.get("windowID")
    if (!response.windowID) {
        // AVOIDING THROWING ERROR WHEN UI NOT FOUND
        response.windowID = 0
    }
    // OPENS UI
    chrome.windows.update(response.windowID, {focused:true}, () => {
        if (chrome.runtime.lastError) {
            chrome.windows.create({
                url: chrome.runtime.getURL("index.html"),
                type: "panel",
                focused: true,
                height: 670,
                width: 550,
            }, (createdwindow) => {
                // saving window ID
                chrome.storage.local.set({ "windowID": createdwindow.id });
            })
        }
    })    
})




chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    try {
        console.log('Message received in background:', request);
        
        // Always call sendResponse to prevent port closure
        sendResponse({ status: 'received' });
    } catch (error) {
        console.error('Error in background message listener:', error);
        sendResponse({ status: 'error', message: error.toString() });
    }
    
    // Return true to indicate you wish to send a response asynchronously
    return true;
});