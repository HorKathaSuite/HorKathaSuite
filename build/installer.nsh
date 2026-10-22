; ============================================================
; 📦 NSIS Installer Custom Script
; BOSC Tech & Edu · Hoṛ Katha Suite v3.7.4 Pro Ultra
; ============================================================

; ═══════════════════════════════════════════════════════════
; 🚀 PRE-INIT — Runs before installer initializes
; ═══════════════════════════════════════════════════════════
!macro preInit
    SetRegView 64
    WriteRegExpandStr HKLM "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
    WriteRegExpandStr HKCU "${INSTALL_REGISTRY_KEY}" InstallLocation "$INSTDIR"
!macroend

; ═══════════════════════════════════════════════════════════
; 🎨 CUSTOM INIT
; ═══════════════════════════════════════════════════════════
!macro customInit
    ; Custom initialization logic
!macroend

; ═══════════════════════════════════════════════════════════
; ✅ CUSTOM INSTALL — After files are installed
; ═══════════════════════════════════════════════════════════
!macro customInstall
    DetailPrint "Hoṛ Katha Suite Pro installed successfully!"
    DetailPrint "Location: $INSTDIR"
!macroend

; ═══════════════════════════════════════════════════════════
; 🗑️ CUSTOM UNINSTALL — During uninstall
; ═══════════════════════════════════════════════════════════
!macro customUnInstall
    DetailPrint "Hoṛ Katha Suite Pro uninstalled successfully!"
!macroend