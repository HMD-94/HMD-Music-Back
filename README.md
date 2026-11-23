<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/3ce437e8-c72c-4d5f-a9a9-4d2875dfc3c1

## Run Locally

**Prerequisites:**  Node.js


1. Install dependencies:
   `npm install`
2. Set the `GEMINI_API_KEY` in [.env.local](.env.local) to your Gemini API key
3. Run the app:
   `npm run dev`


## Android background audio (FreeWebToApk / AppMint)

The player starts `WebToApk.startBackgroundService(...)` when playback becomes active
and stops that foreground service when playback is paused or stopped. The existing
Media Session API continues to publish track metadata and lock-screen media controls.

When rebuilding the APK, enable **Background Audio Playback** in the Look step and
enable **Keep running in background** in Access > Background with the **mediaPlayback**
service type. Also enable **Media Notification** if you want Android lock-screen
controls. Android notification permission must be allowed for the notification to show.
