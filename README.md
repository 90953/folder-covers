# Folder Covers

Give Spotify playlist folders custom cover images with Spicetify.

## Features

- Set a different image for every playlist folder
- Preview the image before saving
- Covers stay after restarting Spotify
- Manage saved covers from **Profile → Folder Covers**
- Export and import a backup of your covers

## Install

1. Download `folder-covers.js` from this repository.
2. Press **Windows + R**, paste the following, then press Enter:

```
%appdata%\spicetify\Extensions
```

3. Put `folder-covers.js` in that folder.
4. Open PowerShell and run:

```powershell
spicetify config extensions folder-covers.js
spicetify apply
```

5. Fully restart Spotify.

## Use

Right-click a playlist folder in Spotify's left library, select **Set folder cover**, choose an image, preview it, then select **Save cover**.

To manage, export, or import your covers, click your Spotify profile picture and choose **Folder Covers**.

## Notes

- Works with the Spotify desktop app and Spicetify.
- Covers are stored locally on the computer where you install the extension. They do not sync to mobile or Spotify Web.
- Spotify updates can change its UI and may need an extension update.
