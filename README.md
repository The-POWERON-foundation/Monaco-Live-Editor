# Monaco Live Editor
**Monaco Live Editor** is an extension for the web-based Monaco editor that allows real-time code collaboration. 

![screenshot](./intro/screenshot.png)

## Features
- Real-time **text update**
- Shows other user's **cursors** and **selected text areas**
- **Multicursor** / multiselection support
- **Multiple workspace** support
- Everything is hosted **locally** on a Node.js server (no 3rd party services)
- Edited files are **saved** on the server
- **New files** can be created
- New users can connect after stream start

## Hosting
1. Download the code in ZIP, extract it and enter the extracted directory. 
2. Run `npm install`
3. Run `npm start` to start the server
4. Visit `http://localhost/`

## Storage
Shared files are stored under `files` directory. All files are auto-saved every 10 seconds or after all users are disconnected from the workspace. 

## Credits
- Monaco editor: `microsoft/monaco-editor` 
- Inspired by: `tbvjaos510/monaco-editor-socket-io` 