; Seven Bits Coffee Desktop - custom NSIS install/uninstall hooks.
;
; ${PRODUCT_NAME} is electron-builder's own define, set from whatever
; `productName` this specific build used (see package.json's dist:*:demo
; scripts, which override it to "Seven Bits Coffee (Demo)") - Electron uses
; that exact same string to name the %APPDATA% userData folder, so it's
; also the right path to a shop's real data here, for either installer.
;
; A shop's data (menu, orders, staff accounts) lives in one SQLite file,
; data\app.db, under %APPDATA% - separate from the Program Files folder
; this installer/uninstaller manages, so a normal install-over-install
; update already leaves it alone with no extra code. Uploaded photos live
; either on local disk (data\..\uploads, the default) or in S3 (opt-in,
; see s3.js) - the local uploads folder is wiped alongside data\app.db
; below since both together are "this shop's saved state" from a clean-
; install point of view; S3-hosted uploads are untouched either way (this
; installer has no way to reach them, nor should it). These two hooks only
; add an explicit choice on top of the default "just leave it alone", and
; only when there's actually existing data to ask about (a first-time
; install never sees either prompt).

!macro customInstall
  IfFileExists "$APPDATA\${PRODUCT_NAME}\data\app.db" 0 sbc_skip_wipe_prompt
    MessageBox MB_YESNO|MB_ICONQUESTION "Existing shop data was found from a previous install of ${PRODUCT_NAME} (menu, orders, staff accounts, locally-stored photos).$\r$\n$\r$\nKeep it? Choose No to erase it and start completely fresh (you'll see the first-run setup wizard again)." IDYES sbc_skip_wipe_prompt
      RMDir /r "$APPDATA\${PRODUCT_NAME}\data"
      RMDir /r "$APPDATA\${PRODUCT_NAME}\uploads"
  sbc_skip_wipe_prompt:
!macroend

!macro customUnInstall
  IfFileExists "$APPDATA\${PRODUCT_NAME}\data\app.db" 0 sbc_skip_delete_prompt
    MessageBox MB_YESNO|MB_ICONQUESTION "Do you want to permanently delete this shop's saved data too (menu, orders, staff accounts, locally-stored photos)?$\r$\n$\r$\nThis can't be undone." IDNO sbc_skip_delete_prompt
      RMDir /r "$APPDATA\${PRODUCT_NAME}"
  sbc_skip_delete_prompt:
!macroend
