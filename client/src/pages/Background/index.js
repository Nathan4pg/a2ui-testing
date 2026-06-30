// Open the side panel when the user clicks the toolbar icon.
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error('[background] setPanelBehavior failed', error));

chrome.runtime.onInstalled.addListener(() => {
  console.log('[background] Agent Side Panel installed.');
});
