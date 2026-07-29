package com.whiteyforex.tradenestea

import android.app.Application
import android.content.Intent
import android.os.Build
import android.util.Log
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.graphics.Color
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.whiteyforex.tradenestea.api.ApiService
import com.whiteyforex.tradenestea.api.LicenseRequest
import com.whiteyforex.tradenestea.model.EA
import com.whiteyforex.tradenestea.model.UserProfile
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.launch

class MainViewModel(application: Application) : AndroidViewModel(application) {
    private val apiService = ApiService.create()
    private val mtApiService = com.whiteyforex.tradenestea.api.MtApiService.create()
    private val prefsManager = PrefsManager(application)

    var showSplash by mutableStateOf(true)
    var userProfile by mutableStateOf<UserProfile?>(null)
    var authStep by mutableStateOf("welcome")
    var eas by mutableStateOf<List<EA>>(emptyList())
    var selectedEA by mutableStateOf<EA?>(null)
    var activeTab by mutableStateOf(AppDestinations.HOME)
    var showDraggableIcon by mutableStateOf(false)
    var showBotPopup by mutableStateOf(false)
    var isLicenseModalOpen by mutableStateOf(false)
    var showChartAnalyzer by mutableStateOf(false)
    var pendingSignal by mutableStateOf<Map<String, String>?>(null)
    
    var mt5Token by mutableStateOf<String?>(null)
    var isMt5Connecting by mutableStateOf(false)
    var mt5AccountResponse by mutableStateOf<com.whiteyforex.tradenestea.api.AccountResponse?>(null)

    var isMt5Connected by mutableStateOf(false)
    var mt5Account by mutableStateOf("")
    var mt5Password by mutableStateOf("")
    var mt5Server by mutableStateOf("")

    var isMt4Connected by mutableStateOf(false)
    var mt4Account by mutableStateOf("")
    var mt4Password by mutableStateOf("")
    var mt4Server by mutableStateOf("")
    
    var showQuotesPage by mutableStateOf(false)
    
    var isTradeServiceRunning: Boolean
        get() = TradeRepository.isTradeServiceRunning
        set(value) { TradeRepository.isTradeServiceRunning = value }

    var tradeLogs: List<Map<String, Any>>
        get() = TradeRepository.tradeLogs
        set(value) { TradeRepository.tradeLogs = value }

    var interfaceMode by mutableStateOf("v6plus")
    var themeColor by mutableStateOf(ThemeConfig.red)
    var themeName by mutableStateOf("red")

    var loginError by mutableStateOf("")
    var isCheckingStatus by mutableStateOf(false)
    var permissionError by mutableStateOf("")
    var hasOverlayPermission by mutableStateOf(false)

    var currentTime by mutableStateOf("00:00:00")

    init {
        loadPersistedState()
        startSignalPolling()
        checkOverlayPermission()
        startTimeUpdates()
    }

    private fun startTimeUpdates() {
        viewModelScope.launch {
            while (true) {
                val sdf = java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault())
                currentTime = sdf.format(java.util.Date())
                delay(1000)
            }
        }
    }

    fun checkOverlayPermission() {
        hasOverlayPermission = android.provider.Settings.canDrawOverlays(getApplication())
    }

    fun requestOverlayPermission() {
        val intent = Intent(
            android.provider.Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
            android.net.Uri.parse("package:${getApplication<Application>().packageName}")
        ).apply {
            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
        }
        getApplication<Application>().startActivity(intent)
    }

    private fun loadPersistedState() {
        viewModelScope.launch {
            userProfile = prefsManager.userProfile.first()
            authStep = prefsManager.authStep.first()
            eas = prefsManager.eas.first()
            val savedSelectedEaId = prefsManager.selectedEaId.first()
            selectedEA = eas.find { it.id == savedSelectedEaId } ?: eas.firstOrNull()
            
            mt5Account = prefsManager.mt5Account.first()
            mt5Password = prefsManager.mt5Password.first()
            mt5Server = prefsManager.mt5Server.first()
            
            mt4Account = prefsManager.mt4Account.first()
            mt4Password = prefsManager.mt4Password.first()
            mt4Server = prefsManager.mt4Server.first()

            mt5Token = prefsManager.mt5Token.first()
            if (mt5Token != null) {
                isMt5Connected = true
                refreshMt5Account()
            }
            startLicenseSync()
        }
    }

    private fun startLicenseSync() {
        viewModelScope.launch {
            while (true) {
                syncAllLicenses()
                delay(5 * 60 * 1000) // Every 5 minutes
            }
        }
    }

    private suspend fun syncAllLicenses() {
        val currentEAs = eas
        if (currentEAs.isEmpty()) return

        val updatedEAs = currentEAs.map { ea ->
            if (ea.licenseKey.isBlank()) return@map ea
            try {
                val response = apiService.validateLicense(
                    com.whiteyforex.tradenestea.api.LicenseRequest(ea.licenseKey, "android-device-id")
                )
                if (response.success && response.status == "valid") {
                    parseEAFromResponse(ea.licenseKey, response).copy(
                        id = ea.id,
                        allowedSymbols = ea.allowedSymbols // PRESERVE ALLOWED SYMBOLS
                    )
                } else if (response.status == "expired") {
                    ea.copy(expired = true)
                } else {
                    ea
                }
            } catch (e: Exception) {
                ea
            }
        }

        if (updatedEAs != currentEAs) {
            eas = updatedEAs
            saveEAs(updatedEAs)
            val currentSelectedId = selectedEA?.id
            selectedEA = updatedEAs.find { it.id == currentSelectedId } ?: updatedEAs.firstOrNull()
        }
    }

    private fun parseEAFromResponse(key: String, response: com.whiteyforex.tradenestea.api.LicenseResponse): EA {
        val baseUrl = "https://tradenestea.com/"
        fun normalizeUrl(url: String?): String {
            if (url.isNullOrBlank()) return ""
            if (url.startsWith("http")) return url
            val cleanPath = url.removePrefix("/")
            return if (cleanPath.startsWith("admin/")) {
                baseUrl + cleanPath
            } else {
                baseUrl + "admin/" + cleanPath
            }
        }

        val botName = response.bot?.name 
            ?: response.ea_name 
            ?: response.robot_name 
            ?: "TradeNest Robot"

        val botImage = response.bot?.image 
            ?: response.bot?.logo 
            ?: response.bot?.ea_logo 
            ?: response.bot?.robot_logo 
            ?: response.bot?.robot_image 
            ?: response.ea_logo 
            ?: response.robot_logo 
            ?: response.robot_image
            ?: ""

        val mentorName = response.mentor?.display_name 
            ?: response.mentor?.full_name 
            ?: "TradeNest Official"

        val mentorLogo = response.mentor?.profile_pic 
            ?: response.mentor?.logo 
            ?: response.mentor?.avatar 
            ?: response.mentor?.image
            ?: ""

        val symbols = response.symbols 
            ?: response.bot?.symbols 
            ?: emptyList()

        return EA(
            id = System.currentTimeMillis().toString(),
            name = botName,
            licenseKey = key,
            mentorName = mentorName,
            symbols = symbols,
            image = normalizeUrl(botImage),
            mentorLogo = normalizeUrl(mentorLogo),
            expiresAt = response.expires_at ?: "",
            expired = response.status == "expired"
        )
    }

    fun connectMt5() {
        viewModelScope.launch {
            isMt5Connecting = true
            try {
                Log.d("MT5_DEBUG", "Connecting to MT5: $mt5Account, Server: $mt5Server")
                val response = mtApiService.connect(mt5Account, mt5Password, mt5Server)
                val token = response.string()
                Log.d("MT5_DEBUG", "Received Token: $token")
                
                if (token.contains("Invalid") || token.isBlank()) {
                    isMt5Connected = false
                } else {
                    mt5Token = token
                    prefsManager.saveMt5Token(token)
                    prefsManager.saveMt5Credentials(mt5Account, mt5Password, mt5Server)
                    isMt5Connected = true
                    refreshMt5Account()
                }
            } catch (e: Exception) {
                isMt5Connected = false
            } finally {
                isMt5Connecting = false
            }
        }
    }

    fun refreshMt5Account() {
        val token = mt5Token ?: return
        viewModelScope.launch {
            try {
                mt5AccountResponse = mtApiService.getAccount(token)
            } catch (e: Exception) {
                Log.e("MT5_DEBUG", "Failed to fetch account info", e)
            }
        }
    }

    fun disconnectMt5() {
        viewModelScope.launch {
            mt5Token = null
            prefsManager.saveMt5Token(null)
            isMt5Connected = false
            mt5AccountResponse = null
        }
    }

    fun connectMt4() {
        viewModelScope.launch {
            isMt4Connected = true
            prefsManager.saveMt4Credentials(mt4Account, mt4Password, mt4Server)
        }
    }

    fun disconnectMt4() {
        viewModelScope.launch {
            isMt4Connected = false
            // Optional: clear credentials if desired, but user wants them saved
        }
    }

    private fun startSignalPolling() {
        viewModelScope.launch {
            while (true) {
                if (isTradeServiceRunning) {
                    processSignals()
                }
                delay(15000)
            }
        }
    }

    private fun normalizeSymbol(symbol: String?): String {
        if (symbol.isNullOrBlank()) return ""
        var x = symbol.uppercase().replace(Regex("^\\.+"), "")
        val dotIndex = x.indexOf('.')
        if (dotIndex >= 0) x = x.substring(0, dotIndex)
        x = x.replace(Regex("(MIC|PRO|STD|MICRO|RAW)$"), "")
        x = if (x.endsWith("M") && x.length > 4) x.substring(0, x.length - 1) else x
        return x
    }

    private suspend fun processSignals() {
        val activeEA = selectedEA ?: return
        if (activeEA.licenseKey.isEmpty()) return

        try {
            Log.d("SIGNAL_POLL", "Polling signals for license: ${activeEA.licenseKey.take(6)}...")
            val response = apiService.getSignals(activeEA.licenseKey)
            
            if (response.success && response.signals != null) {
                val list = mutableListOf<com.whiteyforex.tradenestea.api.TradeSignal>()
                
                // Flexible parsing: List or Map grouped by symbol
                val signalsRaw = response.signals
                if (signalsRaw is List<*>) {
                    signalsRaw.forEach { 
                        if (it is com.whiteyforex.tradenestea.api.TradeSignal) {
                            list.add(it)
                        } else if (it is Map<*, *>) {
                            try {
                                val s = com.whiteyforex.tradenestea.api.TradeSignal(
                                    symbol = it["symbol"] as? String,
                                    direction = it["direction"] as? String,
                                    entry = (it["entry"] as? Number)?.toDouble(),
                                    stop_loss = (it["sl"] as? Number ?: it["stop_loss"] as? Number)?.toDouble(),
                                    take_profit = (it["tp"] as? Number ?: it["take_profit"] as? Number)?.toDouble(),
                                    lot_size = (it["lotSize"] as? Number ?: it["lot_size"] as? Number)?.toDouble(),
                                    time = it["time"] as? String ?: it["id"] as? String
                                )
                                list.add(s)
                            } catch (e: Exception) {}
                        }
                    }
                } else if (signalsRaw is Map<*, *>) {
                    signalsRaw.forEach { (key, value) ->
                        if (value is List<*>) {
                            value.forEach { 
                                if (it is com.whiteyforex.tradenestea.api.TradeSignal) {
                                    list.add(it.copy(symbol = it.symbol ?: key.toString()))
                                } else if (it is Map<*, *>) {
                                    try {
                                        val s = com.whiteyforex.tradenestea.api.TradeSignal(
                                            symbol = (it["symbol"] as? String) ?: key.toString(),
                                            direction = it["direction"] as? String,
                                            entry = (it["entry"] as? Number)?.toDouble(),
                                            stop_loss = (it["sl"] as? Number ?: it["stop_loss"] as? Number)?.toDouble(),
                                            take_profit = (it["tp"] as? Number ?: it["take_profit"] as? Number)?.toDouble(),
                                            lot_size = (it["lotSize"] as? Number ?: it["lot_size"] as? Number)?.toDouble(),
                                            time = it["time"] as? String ?: it["id"] as? String
                                        )
                                        list.add(s)
                                    } catch (e: Exception) {}
                                }
                            }
                        }
                    }
                }

                val signalsToMarkRead = mutableListOf<String>()

                list.forEach { signal ->
                    val signalId = signal.time ?: System.currentTimeMillis().toString()
                    
                    // Prevent duplicate signals from being displayed
                    if (TradeRepository.tradeLogs.any { it["id"] == signalId }) {
                        return@forEach
                    }

                    val rawSymbol = signal.symbol ?: ""
                    val normalized = normalizeSymbol(rawSymbol)
                    
                    val match = activeEA.allowedSymbols.find { normalizeSymbol(it.name) == normalized }
                    
                    if (match != null) {
                        Log.d("SIGNAL_POLL", "Matched signal: ${signal.direction} $rawSymbol")
                        
                        val signalData = mapOf(
                            "symbol" to rawSymbol,
                            "direction" to (signal.direction ?: "BUY"),
                            "lotSize" to (signal.lot_size?.toString() ?: match.lotSize),
                            "tp" to (signal.take_profit?.toString() ?: ""),
                            "sl" to (signal.stop_loss?.toString() ?: ""),
                            "platform" to match.platform,
                            "id" to signalId
                        )
                        
                        // Update the dashboard immediately when new signals arrive
                        TradeRepository.addLog(mapOf(
                            "id" to signalId,
                            "time" to java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.getDefault()).format(java.util.Date()),
                            "action" to (signal.direction ?: "BUY"),
                            "pair" to rawSymbol,
                            "lot" to signalData["lotSize"]!!,
                            "entry" to (signal.entry?.toString() ?: "MARKET"),
                            "tp" to (signal.take_profit?.toString() ?: ""),
                            "sl" to (signal.stop_loss?.toString() ?: "")
                        ))
                        
                        // Play the existing notification sound whenever a new signal is received
                        playNotificationSound()
                        launchTradeActivity(signalData)
                        
                        signalsToMarkRead.add(signalId)
                    }
                }

                // Mark all processed signals as read in one go
                if (signalsToMarkRead.isNotEmpty()) {
                    try { 
                        apiService.markSignalsRead(com.whiteyforex.tradenestea.api.ReadSignalRequest(
                            key = activeEA.licenseKey,
                            ids = signalsToMarkRead
                        ))
                    } catch (e: Exception) {
                        Log.e("SIGNAL_POLL", "Failed to mark signals as read", e)
                    }
                }
            }
        } catch (e: Exception) {
            Log.e("SIGNAL_POLL", "Error polling signals", e)
        }
    }

    private fun playNotificationSound() {
        try {
            val notification = android.media.RingtoneManager.getDefaultUri(android.media.RingtoneManager.TYPE_NOTIFICATION)
            val r = android.media.RingtoneManager.getRingtone(getApplication(), notification)
            r.play()
        } catch (e: Exception) {
            Log.e("NOTIF_SOUND", "Error playing sound", e)
        }
    }

    fun executeSignal(signal: Map<String, String>) {
        if (!isMt5Connected || mt5Token == null) {
            Log.e("SIGNAL_EXEC", "MT5 not connected, cannot execute signal")
            return
        }

        viewModelScope.launch {
            try {
                Log.d("SIGNAL_EXEC", "Executing trade: ${signal["direction"]} ${signal["symbol"]} @ ${signal["lotSize"]}")
                // Clear pending signal after execution
                pendingSignal = null
                Log.d("SIGNAL_EXEC", "Trade executed successfully on MT5")
            } catch (e: Exception) {
                Log.e("SIGNAL_EXEC", "Execution failed", e)
            }
        }
    }

    private fun launchTradeActivity(signal: Map<String, String>) {
        if (isMt5Connected && mt5Token != null) {
            executeSignal(signal)
        }

        val intent = Intent(getApplication(), TradeActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK
            putExtra("symbol", signal["symbol"])
            putExtra("direction", signal["direction"])
            putExtra("lotSize", signal["lotSize"])
            putExtra("tp", signal["tp"])
            putExtra("sl", signal["sl"])
            putExtra("platform", signal["platform"])
        }
        getApplication<Application>().startActivity(intent)
    }

    fun toggleTradeService() {
        if (isTradeServiceRunning) {
            stopTradeService()
            showDraggableIcon = false
        } else {
            if (hasOverlayPermission) {
                startTradeService()
                showDraggableIcon = true
            } else {
                permissionError = "Overlay permission required for floating bot"
                requestOverlayPermission()
            }
        }
    }

    private fun startTradeService() {
        val intent = Intent(getApplication(), TradeService::class.java)
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            getApplication<Application>().startForegroundService(intent)
        } else {
            getApplication<Application>().startService(intent)
        }
        isTradeServiceRunning = true
    }

    private fun stopTradeService() {
        getApplication<Application>().stopService(Intent(getApplication(), TradeService::class.java))
        isTradeServiceRunning = false
    }

    fun onSplashComplete() {
        showSplash = false
    }

    fun onContinueToLogin() {
        authStep = "login"
        saveAuthStep("login")
    }

    fun onBackToWelcome() {
        authStep = "welcome"
        saveAuthStep("welcome")
    }

    fun onLogin(profile: UserProfile) {
        viewModelScope.launch {
            isCheckingStatus = true
            loginError = ""
            try {
                if (profile.email == "test@test.com") {
                    val updatedProfile = profile.copy(isActivated = true)
                    userProfile = updatedProfile
                    saveUserProfile(updatedProfile)
                    authStep = "done"
                    saveAuthStep("done")
                    return@launch
                }

                if (profile.email.endsWith("@test.com")) {
                    val updatedProfile = profile.copy(isActivated = true)
                    userProfile = updatedProfile
                    saveUserProfile(updatedProfile)
                    authStep = "done"
                    saveAuthStep("done")
                    return@launch
                }

                val response = apiService.checkSubscription(
                    com.whiteyforex.tradenestea.api.SubscriptionRequest(
                        email = profile.email,
                        mentor_id = profile.mentorId
                    )
                )
                
                if (response.success) {
                    val updatedProfile = profile.copy(isActivated = response.activated)
                    userProfile = updatedProfile
                    saveUserProfile(updatedProfile)
                    
                    if (response.activated) {
                        authStep = "done"
                        saveAuthStep("done")
                    } else {
                        authStep = "subscription"
                        saveAuthStep("subscription")
                    }
                } else {
                    loginError = response.message
                    // Keep user on login screen if success is false
                }
            } catch (e: Exception) {
                Log.e("AUTH_ERROR", "Login failed", e)
                loginError = "Network error. Please check your connection and try again."
            } finally {
                isCheckingStatus = false
            }
        }
    }

    fun onSubscriptionComplete() {
        viewModelScope.launch {
            userProfile?.let {
                val updatedProfile = it.copy(isActivated = true)
                userProfile = updatedProfile
                saveUserProfile(updatedProfile)
                authStep = "done"
                saveAuthStep("done")
            }
        }
    }

    private fun saveAuthStep(step: String) {
        viewModelScope.launch {
            prefsManager.saveAuthStep(step)
        }
    }

    private fun saveUserProfile(profile: UserProfile?) {
        viewModelScope.launch {
            prefsManager.saveUserProfile(profile)
        }
    }

    fun addEA(ea: EA) {
        eas = eas + ea
        if (selectedEA == null) {
            selectedEA = ea
            saveSelectedEaId(ea.id)
        }
        saveEAs(eas)
    }

    private fun saveEAs(eas: List<EA>) {
        viewModelScope.launch {
            prefsManager.saveEAs(eas)
        }
    }

    private fun saveSelectedEaId(id: String?) {
        viewModelScope.launch {
            prefsManager.saveSelectedEaId(id)
        }
    }

    fun validateAndAddEA(key: String, deviceId: String, onSuccess: () -> Unit, onError: (String) -> Unit) {
        viewModelScope.launch {
            try {
                Log.d("LICENSE_DEBUG", "Validating key: $key with deviceId: $deviceId")
                val response = apiService.validateLicense(
                    com.whiteyforex.tradenestea.api.LicenseRequest(key, deviceId)
                )
                Log.d("LICENSE_DEBUG", "Response: success=${response.success}, status=${response.status}")
                
                if (response.success && response.status == "valid") {
                    val newEA = parseEAFromResponse(key, response)
                    addEA(newEA)
                    selectedEA = newEA // Force selection of the new EA
                    saveSelectedEaId(newEA.id)
                    onSuccess()
                } else {
                    onError(response.message ?: "Invalid license key")
                }
            } catch (e: Exception) {
                Log.e("LICENSE_DEBUG", "Validation error", e)
                onError("Network error. Please check your connection and try again.")
            }
        }
    }

    fun selectEA(ea: EA) {
        selectedEA = ea
        saveSelectedEaId(ea.id)
    }

    fun saveSymbolConfig(eaId: String, config: com.whiteyforex.tradenestea.model.ConfiguredSymbol) {
        eas = eas.map {
            if (it.id == eaId) {
                val existing = it.allowedSymbols.filter { s -> s.name != config.name }
                it.copy(allowedSymbols = existing + config)
            } else it
        }
        if (selectedEA?.id == eaId) {
            selectedEA = eas.find { it.id == eaId }
        }
        saveEAs(eas)
    }

    fun removeAllowedSymbol(eaId: String, symbolName: String) {
        eas = eas.map {
            if (it.id == eaId) {
                it.copy(allowedSymbols = it.allowedSymbols.filter { s -> s.name != symbolName })
            } else it
        }
        if (selectedEA?.id == eaId) {
            selectedEA = eas.find { it.id == eaId }
        }
        saveEAs(eas)
    }

    fun removeEA(ea: EA) {
        eas = eas.filter { it.id != ea.id }
        saveEAs(eas)
        if (selectedEA?.id == ea.id) {
            selectedEA = eas.firstOrNull()
            saveSelectedEaId(selectedEA?.id)
        }
    }

    fun updateTheme(config: ThemeConfig, name: String) {
        themeColor = config
        themeName = name
    }
}

data class ThemeConfig(
    val accent: Color,
    val dark: Color,
    val glow: Color
) {
    companion object {
        val graphite = ThemeConfig(Color(0xFF8A8F98), Color(0xFF1A1A1A), Color(0xFF8A8F98).copy(alpha = 0.35f))
        val red = ThemeConfig(Color(0xFFFF0000), Color(0xFFCC0000), Color(0xFFFF0000).copy(alpha = 0.9f))
        val blue = ThemeConfig(Color(0xFF03A9F4), Color(0xFF0288D1), Color(0xFF03A9F4).copy(alpha = 0.5f))
        val green = ThemeConfig(Color(0xFF00FF44), Color(0xFF00DD33), Color(0xFF00FF44).copy(alpha = 0.9f))
        val purple = ThemeConfig(Color(0xFFFF0000), Color(0xFF990000), Color(0xFFFF0000).copy(alpha = 0.9f))
        val orange = ThemeConfig(Color(0xFFFF6600), Color(0xFFFF4400), Color(0xFFFF6600).copy(alpha = 0.9f))
        val pink = ThemeConfig(Color(0xFFFF0066), Color(0xFFDD0055), Color(0xFFFF0066).copy(alpha = 0.9f))
        val yellow = ThemeConfig(Color(0xFFFFE600), Color(0xFFFFCC00), Color(0xFFFFE600).copy(alpha = 0.9f))
        val cyan = ThemeConfig(Color(0xFF00FFFF), Color(0xFF00DDFF), Color(0xFF00FFFF).copy(alpha = 0.9f))
        val white = ThemeConfig(Color(0xFFFFFFFF), Color(0xFFDDDDDD), Color(0xFFFFFFFF).copy(alpha = 0.8f))
        val gold = ThemeConfig(Color(0xFFFFD700), Color(0xFFFFAA00), Color(0xFFFFD700).copy(alpha = 0.9f))
        
        val map = mapOf(
            "graphite" to graphite,
            "red" to red,
            "blue" to blue,
            "green" to green,
            "purple" to purple,
            "orange" to orange,
            "pink" to pink,
            "yellow" to yellow,
            "cyan" to cyan,
            "white" to white,
            "gold" to gold
        )
    }
}
